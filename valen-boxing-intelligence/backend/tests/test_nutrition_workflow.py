def test_nutrition_profile_and_daily_tracking(client):
    boxer = client.post(
        "/api/v1/boxers",
        json={
            "full_name": "Jordan Boxer",
            "date_of_birth": "2000-04-21",
            "stance": "orthodox",
            "experience_level": "amateur",
        },
    ).json()["data"]

    profile = client.post(
        f"/api/v1/nutrition/boxers/{boxer['id']}/profile",
        json={
            "age": 25,
            "height_cm": 178,
            "current_weight_kg": 74.5,
            "target_weight_kg": 72,
            "target_competition_weight_category": "Welterweight",
            "dietary_preferences": "High protein and whole foods",
            "nutrition_goals": "Fuel rounds and recover between sessions",
            "target_calories": 2800,
            "target_protein_g": 170,
            "target_carbs_g": 300,
            "target_fat_g": 75,
            "target_fibre_g": 35,
        },
    )
    assert profile.status_code == 201, profile.text
    assert profile.json()["data"]["target_calories"] == 2800

    breakfast = client.post(
        f"/api/v1/nutrition/boxers/{boxer['id']}/food-diary",
        json={
            "entry_date": "2026-11-02",
            "meal_type": "breakfast",
            "food_name": "Oats and eggs",
            "quantity": "1 bowl",
            "serving_size": "large bowl",
            "calories": 350,
            "protein_g": 22,
            "carbs_g": 40,
            "fat_g": 12,
            "fibre_g": 7,
            "meal_time": "08:00",
        },
    )
    assert breakfast.status_code == 201, breakfast.text

    post_training = client.post(
        f"/api/v1/nutrition/boxers/{boxer['id']}/food-diary",
        json={
            "entry_date": "2026-11-02",
            "meal_type": "post_training",
            "food_name": "Chicken rice bowl",
            "quantity": "1 box",
            "serving_size": "standard meal",
            "calories": 540,
            "protein_g": 42,
            "carbs_g": 55,
            "fat_g": 15,
            "fibre_g": 9,
            "meal_time": "18:30",
        },
    )
    assert post_training.status_code == 201, post_training.text

    hydration = client.post(
        f"/api/v1/nutrition/boxers/{boxer['id']}/hydration",
        json={
            "entry_date": "2026-11-02",
            "drink_name": "Water",
            "amount_ml": 1200,
            "time_of_day": "morning",
        },
    )
    assert hydration.status_code == 201, hydration.text

    weight = client.post(
        f"/api/v1/nutrition/boxers/{boxer['id']}/weights",
        json={
            "entry_date": "2026-11-02",
            "weight_kg": 74.2,
            "is_official": False,
            "notes": "After training",
        },
    )
    assert weight.status_code == 201, weight.text

    summary = client.get(
        f"/api/v1/nutrition/boxers/{boxer['id']}/summary",
        params={"entry_date": "2026-11-02"},
    )
    assert summary.status_code == 200, summary.text

    body = summary.json()["data"]
    assert body["totals"]["calories"] == 890.0
    assert body["totals"]["protein_g"] == 64.0
    assert body["totals"]["hydration_ml"] == 1200
    assert body["profile"]["target_weight_kg"] == 72.0
    assert body["weight_history"][0]["weight_kg"] == 74.2
