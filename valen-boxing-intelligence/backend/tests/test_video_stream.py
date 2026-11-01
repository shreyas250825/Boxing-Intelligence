from app.core.database import get_db
from app.main import app as fastapi_app
from app.models.video import Video


def test_stream_route_rejects_non_file_storage_path(client, monkeypatch, tmp_path):
    boxer = client.post(
        "/api/v1/boxers",
        json={
            "full_name": "Stream Test Boxer",
            "stance": "orthodox",
            "experience_level": "amateur",
        },
    ).json()["data"]

    monkeypatch.setattr("app.core.config.settings.STORAGE_DIR", str(tmp_path))
    video_path = tmp_path / "directory-video.mp4"
    video_path.mkdir()

    video_id = "22222222-2222-2222-2222-222222222222"
    gen = fastapi_app.dependency_overrides[get_db]()
    db = next(gen)
    db.add(
        Video(
            id=video_id,
            boxer_id=boxer["id"],
            storage_filename="directory-video.mp4",
            original_filename_safe="stream-test.mp4",
            mime_type="video/mp4",
            file_size_bytes=1234,
            status="uploaded",
        )
    )
    db.commit()
    db.close()

    response = client.get(f"/api/v1/videos/{video_id}/stream")

    assert response.status_code == 404
    assert response.json()["detail"]["code"] == "VIDEO_FILE_NOT_FOUND"
