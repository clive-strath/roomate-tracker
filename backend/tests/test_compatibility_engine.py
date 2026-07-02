from app.services.compatibility_engine import (
    calculate_compatibility,
    is_flagged,
    is_hard_incompatible,
    get_reason_tags,
)


def _full_pref(**overrides):
    base = {
        "wake_time": 3,
        "sleep_time": 3,
        "noise_tolerance": 3,
        "cleanliness_level": 3,
        "guest_policy": 3,
        "bathroom_schedule": 1,
        "introvert_extrovert": 3,
        "vaping_habit": 1,
        "hobbies": ["reading", "gaming"],
        "field_of_study": "stem",
    }
    base.update(overrides)
    return base


def test_identical_preferences_score_100():
    pref = _full_pref()
    score, breakdown = calculate_compatibility(pref, pref)

    assert score == 100
    assert breakdown["wake_time"] == 12
    assert breakdown["sleep_time"] == 12
    assert breakdown["noise_tolerance"] == 12
    assert breakdown["cleanliness_level"] == 10
    assert breakdown["guest_policy"] == 10
    assert breakdown["bathroom_schedule"] == 6
    assert breakdown["introvert_extrovert"] == 10
    assert breakdown["vaping_habit"] == 10
    assert breakdown["hobbies"] == 10
    assert breakdown["field_of_study"] == 8


def test_maximally_opposite_preferences_low_score():
    pref_a = _full_pref(
        wake_time=1,
        sleep_time=1,
        noise_tolerance=1,
        cleanliness_level=1,
        guest_policy=1,
        bathroom_schedule=1,
        introvert_extrovert=1,
        vaping_habit=1,
        hobbies=["reading"],
        field_of_study="stem",
    )
    pref_b = _full_pref(
        wake_time=5,
        sleep_time=5,
        noise_tolerance=5,
        cleanliness_level=5,
        guest_policy=5,
        bathroom_schedule=2,
        introvert_extrovert=5,
        vaping_habit=3,
        hobbies=["gaming"],
        field_of_study="arts_humanities",
    )

    score, _ = calculate_compatibility(pref_a, pref_b)
    assert score == 3
    assert is_flagged(score) is True


def test_fragrance_hard_constraint():
    s_a = {
        "student_id": 1,
        "gender": "male",
        "preferences": _full_pref(),
        "allergies": {"has_fragrance_sensitivity": True, "heavy_fragrance_user": False},
    }
    s_b = {
        "student_id": 2,
        "gender": "male",
        "preferences": _full_pref(),
        "allergies": {"has_fragrance_sensitivity": False, "heavy_fragrance_user": True},
    }

    incompatible, reason = is_hard_incompatible(s_a, s_b)
    assert incompatible is True
    assert reason == "fragrance"


def test_smoke_hard_constraint_with_missing_other_allergy_row():
    s_a = {
        "student_id": 1,
        "gender": "male",
        "preferences": _full_pref(),
        "allergies": {"has_smoke_sensitivity": True, "smoking_habit": "no"},
    }
    s_b = {
        "student_id": 2,
        "gender": "male",
        "preferences": _full_pref(),
        "allergies": {"smoking_habit": "occasionally"},
    }

    incompatible, reason = is_hard_incompatible(s_a, s_b)
    assert incompatible is True
    assert reason == "smoke_respiratory"


def test_reason_tags_are_non_sensitive_and_dimension_based():
    pref_a = _full_pref()
    pref_b = _full_pref(hobbies=["reading", "gaming"])

    _, breakdown = calculate_compatibility(pref_a, pref_b)
    tags = get_reason_tags(breakdown)

    assert "Similar sleep schedule" in tags
    assert "Shared hobbies" in tags


def test_same_fragrance_allergy_not_hard_blocked():
    s_a = {
        "student_id": 1,
        "gender": "male",
        "preferences": _full_pref(),
        "allergies": {"has_fragrance_sensitivity": True, "heavy_fragrance_user": False},
    }
    s_b = {
        "student_id": 2,
        "gender": "male",
        "preferences": _full_pref(),
        "allergies": {"has_fragrance_sensitivity": True, "heavy_fragrance_user": True},
    }

    incompatible, reason = is_hard_incompatible(s_a, s_b)
    assert incompatible is False
    assert reason is None


def test_same_nut_allergy_not_hard_blocked():
    s_a = {
        "student_id": 1,
        "gender": "male",
        "preferences": _full_pref(),
        "allergies": {"has_severe_nut_allergy": True, "stores_or_eats_nuts_in_room": False},
    }
    s_b = {
        "student_id": 2,
        "gender": "male",
        "preferences": _full_pref(),
        "allergies": {"has_severe_nut_allergy": True, "stores_or_eats_nuts_in_room": True},
    }

    incompatible, reason = is_hard_incompatible(s_a, s_b)
    assert incompatible is False
    assert reason is None


def test_same_smoke_sensitivity_not_hard_blocked():
    s_a = {
        "student_id": 1,
        "gender": "male",
        "preferences": _full_pref(),
        "allergies": {"has_smoke_sensitivity": True, "smoking_habit": "no"},
    }
    s_b = {
        "student_id": 2,
        "gender": "male",
        "preferences": _full_pref(),
        "allergies": {"has_smoke_sensitivity": True, "smoking_habit": "occasionally"},
    }

    incompatible, reason = is_hard_incompatible(s_a, s_b)
    assert incompatible is False
    assert reason is None
