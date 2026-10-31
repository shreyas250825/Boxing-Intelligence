import json


def _tracking(boxer_id: str, extra_boxer=None):
    samples_a = [
        {
            "t": 0.0, "cx": 0.20, "cy": 0.50, "x": 0.10, "y": 0.30, "w": 0.20, "h": 0.40,
            "confidence": 0.8, "status": "TRACKING", "displacement": 0.0,
            "valid_points": 22, "camera_reliable": False,
        },
        {
            "t": 0.1, "cx": 0.35, "cy": 0.50, "x": 0.25, "y": 0.30, "w": 0.20, "h": 0.40,
            "confidence": 0.78, "status": "TRACKING", "displacement": 0.12,
            "valid_points": 20, "camera_reliable": False,
        },
    ]
    boxers = [{
        "label": "A",
        "boxer_id": boxer_id,
        "name": "Test Boxer",
        "color": "#3b82f6",
        "bbox": {"x": 0.10, "y": 0.30, "w": 0.20, "h": 0.40},
        "total_movement": 0.12,
        "valid_sample_count": 2,
        "samples": samples_a,
        "loss_intervals": [],
        "identify_time": 3.0,
        "identify_video_width": 640,
        "identify_video_height": 360,
    }]
    if extra_boxer:
        boxers.append(extra_boxer)
    return {
        "version": "lk-pyramid-v1",
        "measurement": "normalized_image_plane_movement",
        "camera_compensated": False,
        "video_width": 640,
        "video_height": 360,
        "boxers": boxers,
    }


def test_missing_analysis_is_empty_not_404(client, seeded):
    res = client.get(f"/api/v1/videos/{seeded['video_id']}/browser-analysis")
    assert res.status_code == 200
    assert res.json()["data"] is None


def test_save_and_reload_tracking(client, seeded):
    video_id = seeded["video_id"]
    payload = {
        "video_id": video_id,
        "boxer_id": seeded["boxer"]["id"],
        "processed_frames": 2,
        "duration_seconds": 12.0,
        "action_events": [{
            "id": "e1", "timestamp": 1.2, "action_type": "jab", "label": "Jab",
            "boxer_label": "A", "round_num": 1,
        }],
        "coach_summary": {"went_well": "Guard stayed high"},
        "tracking": _tracking(seeded["boxer"]["id"]),
    }
    created = client.post(f"/api/v1/videos/{video_id}/browser-analysis", json=payload)
    assert created.status_code == 201, created.text
    data = created.json()["data"]
    assert data["tracking_json"]
    saved = json.loads(data["tracking_json"])
    assert saved["boxers"][0]["total_movement"] == 0.12
    assert len(saved["boxers"][0]["samples"]) == 2

    loaded = client.get(f"/api/v1/videos/{video_id}/browser-analysis")
    assert loaded.status_code == 200
    again = json.loads(loaded.json()["data"]["tracking_json"])
    assert again == saved
    events = json.loads(loaded.json()["data"]["action_events_json"])
    assert events[0]["action_type"] == "jab"


def test_two_boxers_independent_totals(client, seeded):
    b_id = seeded["boxer"]["id"]
    extra = {
        "label": "B",
        "boxer_id": "opponent",
        "name": "Opponent",
        "color": "#f59e0b",
        "bbox": {"x": 0.6, "y": 0.3, "w": 0.2, "h": 0.4},
        "total_movement": 0.01,
        "valid_sample_count": 2,
        "samples": [
            {
                "t": 0.0, "cx": 0.70, "cy": 0.50, "x": 0.60, "y": 0.30, "w": 0.20, "h": 0.40,
                "confidence": 0.7, "status": "TRACKING", "displacement": 0.0,
                "valid_points": 18, "camera_reliable": False,
            },
            {
                "t": 0.1, "cx": 0.71, "cy": 0.50, "x": 0.61, "y": 0.30, "w": 0.20, "h": 0.40,
                "confidence": 0.7, "status": "TRACKING", "displacement": 0.01,
                "valid_points": 17, "camera_reliable": False,
            },
        ],
        "loss_intervals": [],
    }
    res = client.post(
        f"/api/v1/videos/{seeded['video_id']}/browser-analysis",
        json={
            "video_id": seeded["video_id"],
            "boxer_id": b_id,
            "tracking": _tracking(b_id, extra),
        },
    )
    assert res.status_code == 201, res.text
    boxers = json.loads(res.json()["data"]["tracking_json"])["boxers"]
    assert boxers[0]["total_movement"] == 0.12
    assert boxers[1]["total_movement"] == 0.01


def test_rejects_mismatched_totals(client, seeded):
    tracking = _tracking(seeded["boxer"]["id"])
    tracking["boxers"][0]["total_movement"] = 9.99
    res = client.post(
        f"/api/v1/videos/{seeded['video_id']}/browser-analysis",
        json={
            "video_id": seeded["video_id"],
            "boxer_id": seeded["boxer"]["id"],
            "tracking": tracking,
        },
    )
    assert res.status_code == 422


def test_rejects_out_of_range_coordinates(client, seeded):
    tracking = _tracking(seeded["boxer"]["id"])
    tracking["boxers"][0]["samples"][1]["cx"] = 4.0
    res = client.post(
        f"/api/v1/videos/{seeded['video_id']}/browser-analysis",
        json={
            "video_id": seeded["video_id"],
            "boxer_id": seeded["boxer"]["id"],
            "tracking": tracking,
        },
    )
    assert res.status_code == 422


def test_saves_report_payload_and_identify_time(client, seeded):
    video_id = seeded["video_id"]
    tracking = _tracking(seeded["boxer"]["id"])
    tracking["report_status"] = "complete"
    tracking["report"] = {"title": "Boxing Performance Report", "status": "complete"}
    res = client.post(
        f"/api/v1/videos/{video_id}/browser-analysis",
        json={
            "video_id": video_id,
            "boxer_id": seeded["boxer"]["id"],
            "report_status": "complete",
            "report": {"title": "Boxing Performance Report", "insufficientData": False},
            "tracking": tracking,
        },
    )
    assert res.status_code == 201, res.text
    data = res.json()["data"]
    assert data["report_status"] == "complete"
    assert data["report_json"]
    saved = json.loads(data["tracking_json"])
    assert saved["boxers"][0]["identify_time"] == 3.0
    loaded = client.get(f"/api/v1/videos/{video_id}/browser-analysis")
    body = loaded.json()["data"]
    assert json.loads(body["report_json"])["title"] == "Boxing Performance Report"


def test_rejects_video_id_mismatch(client, seeded):
    res = client.post(
        f"/api/v1/videos/{seeded['video_id']}/browser-analysis",
        json={
            "video_id": "22222222-2222-2222-2222-222222222222",
            "boxer_id": seeded["boxer"]["id"],
        },
    )
    assert res.status_code == 422
