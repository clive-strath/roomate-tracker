import pytest
from app.services.compatibility_engine import calculate_compatibility, is_flagged

def test_identical_preferences():
    pref = {
        "wake_time": 3,
        "sleep_time": 3,
        "noise_tolerance": 3,
        "cleanliness_level": 3,
        "guest_policy": 3,
        "bathroom_schedule": 1
    }
    score, breakdown = calculate_compatibility(pref, pref)
    assert score == 100
    assert breakdown["wake_time"] == 20
    assert breakdown["sleep_time"] == 20
    assert breakdown["noise_tolerance"] == 20
    assert breakdown["cleanliness_level"] == 15
    assert breakdown["guest_policy"] == 15
    assert breakdown["bathroom_schedule"] == 10

def test_maximally_opposite_preferences():
    pref_a = {
        "wake_time": 1,
        "sleep_time": 1,
        "noise_tolerance": 1,
        "cleanliness_level": 1,
        "guest_policy": 1,
        "bathroom_schedule": 1
    }
    pref_b = {
        "wake_time": 5,
        "sleep_time": 5,
        "noise_tolerance": 5,
        "cleanliness_level": 5,
        "guest_policy": 5,
        "bathroom_schedule": 2
    }
    score, breakdown = calculate_compatibility(pref_a, pref_b)
    # Expected:
    # numeric fields difference is 4 (max diff), so score is 0 on all.
    # Bathroom schedule is 1 vs 2, which is fixed but different, so 5 points.
    # Total = 5
    assert score == 5
    assert breakdown["wake_time"] == 0
    assert breakdown["sleep_time"] == 0
    assert breakdown["noise_tolerance"] == 0
    assert breakdown["cleanliness_level"] == 0
    assert breakdown["guest_policy"] == 0
    assert breakdown["bathroom_schedule"] == 5.0
    assert is_flagged(score) is True

def test_bathroom_schedule_flexible():
    # flexible vs fixed (3 vs 1) -> full 10 points
    pref_a = {
        "wake_time": 3,
        "sleep_time": 3,
        "noise_tolerance": 3,
        "cleanliness_level": 3,
        "guest_policy": 3,
        "bathroom_schedule": 3
    }
    pref_b = {
        "wake_time": 3,
        "sleep_time": 3,
        "noise_tolerance": 3,
        "cleanliness_level": 3,
        "guest_policy": 3,
        "bathroom_schedule": 1
    }
    score, breakdown = calculate_compatibility(pref_a, pref_b)
    assert score == 100
    assert breakdown["bathroom_schedule"] == 10

def test_bathroom_schedule_different_fixed():
    # both fixed but different (1 vs 2) -> half points (5)
    pref_a = {
        "wake_time": 3,
        "sleep_time": 3,
        "noise_tolerance": 3,
        "cleanliness_level": 3,
        "guest_policy": 3,
        "bathroom_schedule": 1
    }
    pref_b = {
        "wake_time": 3,
        "sleep_time": 3,
        "noise_tolerance": 3,
        "cleanliness_level": 3,
        "guest_policy": 3,
        "bathroom_schedule": 2
    }
    score, breakdown = calculate_compatibility(pref_a, pref_b)
    assert score == 95
    assert breakdown["bathroom_schedule"] == 5.0
