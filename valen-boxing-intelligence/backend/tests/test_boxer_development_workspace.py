def test_boxer_development_dashboard_tracks_goals_journal_and_recovery(client):
    boxer = client.post(
        "/api/v1/boxers",
        json={
            "full_name": "Ava Boxer",
            "date_of_birth": "2001-02-02",
            "stance": "orthodox",
            "experience_level": "amateur",
        },
    ).json()["data"]

    goal = client.post(
        f"/api/v1/development/boxers/{boxer['id']}/goals",
        json={
            "title": "Improve jab volume",
            "description": "Increase jab accuracy and consistency.",
            "start_date": "2026-11-01",
            "target_date": "2026-12-15",
            "success_criteria": "6/10 coach rating and 20% more jabs in 3 sessions",
            "assigned_coach": "Coach Patel",
            "is_primary": True,
        },
    )
    assert goal.status_code == 201, goal.text
    assert goal.json()["data"]["title"] == "Improve jab volume"

    journal = client.post(
        f"/api/v1/development/boxers/{boxer['id']}/journal",
        json={
            "session_date": "2026-11-01",
            "session_type": "sparring",
            "duration_minutes": 75,
            "focus": "Jab timing",
            "what_went_well": "Kept the lead hand busy and backing up with discipline.",
            "needs_improvement": "Settle feet on the second jab.",
            "questions_for_coach": "Can we sharpen the range cue on the left hook?",
            "notes": "Good rhythm after the break.",
            "coach_visible": True,
        },
    )
    assert journal.status_code == 201, journal.text

    recovery = client.post(
        f"/api/v1/development/boxers/{boxer['id']}/recovery-checkins",
        json={
            "entry_date": "2026-11-01",
            "energy_level": 7,
            "sleep_hours": 7.5,
            "recovery_score": 76,
            "stress_level": 4,
            "readiness_rating": 8,
            "notes": "Felt strong in pad work.",
        },
    )
    assert recovery.status_code == 201, recovery.text

    dashboard = client.get(f"/api/v1/development/boxers/{boxer['id']}/dashboard")
    assert dashboard.status_code == 200, dashboard.text
    body = dashboard.json()["data"]
    assert body["primary_goal"]["title"] == "Improve jab volume"
    assert len(body["journal_entries"]) == 1
    assert body["recovery_checkins"][0]["recovery_score"] == 76


def test_boxer_development_skill_and_competition_data_persists(client):
    boxer = client.post(
        "/api/v1/boxers",
        json={
            "full_name": "Sam Fighter",
            "date_of_birth": "1998-07-10",
            "stance": "southpaw",
            "experience_level": "semi-pro",
        },
    ).json()["data"]

    skill = client.post(
        f"/api/v1/development/boxers/{boxer['id']}/skill-assessments",
        json={
            "skill_name": "jab",
            "current_level": "developing",
            "development_goal": "Increase volume and speed",
            "coach_notes": "Eliminate telegraphing and improve reset posture.",
            "video_reference": "session-004.mp4",
            "assigned_drill": "Double jab ladder",
            "coach_assessed": True,
        },
    )
    assert skill.status_code == 201, skill.text

    competition = client.post(
        f"/api/v1/development/boxers/{boxer['id']}/competition-plans",
        json={
            "competition_name": "City Title Showdown",
            "competition_date": "2027-02-20",
            "weight_category": "Welterweight",
            "timeline": "8-week block with taper and travel planning",
            "milestones": "Increase volume, sharpen range management, recovery windows",
            "coach_checklist": "Final medical clearance, gloves, mouthguard",
            "equipment_checklist": "Headgear, gloves, towel, water bottle",
            "travel_notes": "Travel Friday PM, check-in Saturday morning",
            "status": "planned",
        },
    )
    assert competition.status_code == 201, competition.text

    skills = client.get(f"/api/v1/development/boxers/{boxer['id']}/skill-assessments")
    assert skills.status_code == 200, skills.text
    assert skills.json()["data"][0]["skill_name"] == "jab"

    plans = client.get(f"/api/v1/development/boxers/{boxer['id']}/competition-plans")
    assert plans.status_code == 200, plans.text
    assert plans.json()["data"][0]["competition_name"] == "City Title Showdown"
