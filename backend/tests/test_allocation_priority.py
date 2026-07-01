from app.services.allocation_service import run_prioritized_matching


def _prefs(value, bathroom=1):
    return {
        "wake_time": value,
        "sleep_time": value,
        "noise_tolerance": value,
        "cleanliness_level": value,
        "guest_policy": value,
        "bathroom_schedule": bathroom,
    }


def test_waiting_students_are_prioritized_against_fresh_pool():
    # Fresh-fresh is the strongest pair, but waiting must be matched first.
    eligible = [
        {"student_id": 1, "gender": "male", "preferences": _prefs(2)},  # waiting
        {"student_id": 2, "gender": "male", "preferences": _prefs(3)},
        {"student_id": 3, "gender": "male", "preferences": _prefs(3)},
    ]

    matched_pairs, unmatched_fresh_ids, unmatched_waiting_ids = run_prioritized_matching(
        eligible_students=eligible,
        waiting_student_ids={1},
    )

    assert len(matched_pairs) == 1
    pair_ids = {matched_pairs[0]["student_id_1"], matched_pairs[0]["student_id_2"]}
    assert 1 in pair_ids
    assert unmatched_waiting_ids == []
    assert len(unmatched_fresh_ids) == 1


def test_waiting_without_compatible_fresh_edges_remains_waiting():
    eligible = [
        {"student_id": 10, "gender": "male", "preferences": _prefs(2)},  # waiting
        {"student_id": 20, "gender": "female", "preferences": _prefs(3)},
        {"student_id": 30, "gender": "female", "preferences": _prefs(3)},
    ]

    matched_pairs, unmatched_fresh_ids, unmatched_waiting_ids = run_prioritized_matching(
        eligible_students=eligible,
        waiting_student_ids={10},
    )

    assert len(matched_pairs) == 1
    pair_ids = {matched_pairs[0]["student_id_1"], matched_pairs[0]["student_id_2"]}
    assert pair_ids == {20, 30}
    assert unmatched_fresh_ids == []
    assert unmatched_waiting_ids == [10]
