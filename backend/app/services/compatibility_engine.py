"""
Compatibility-Based Maximum Weight Matching Algorithm.

Stages:
1. Hard constraint filtering
2. Pairwise weighted scoring
3. Graph construction
4. Mutual preference priority
5. Maximum weight matching
6. Low-score flagging
"""

import itertools

import networkx as nx

WEIGHTS = {
    "wake_time": 12,
    "sleep_time": 12,
    "noise_tolerance": 12,
    "cleanliness_level": 10,
    "guest_policy": 10,
    "bathroom_schedule": 6,
    "introvert_extrovert": 10,
    "vaping_habit": 10,
    "hobbies": 10,
    "field_of_study": 8,
}

assert sum(WEIGHTS.values()) == 100, "Weights must sum to 100"

LOW_COMPATIBILITY_THRESHOLD = 40

FIELD_GROUPS = {
    "stem": "group_1",
    "medicine": "group_1",
    "business": "group_2",
    "social_sciences": "group_2",
    "law": "group_2",
    "arts_humanities": "group_3",
    "education": "group_3",
    "other": "group_other",
}

VALID_HOBBIES = {
    "reading",
    "gaming",
    "sports",
    "music",
    "cooking",
    "art_drawing",
    "photography",
    "travel",
    "fitness_gym",
    "movies_series",
    "dancing",
    "volunteering",
    "coding",
    "fashion",
    "nature_hiking",
}

_REASON_TAG_THRESHOLD = 0.75
_REASON_TAG_LABELS = {
    "wake_time": "Similar wake-up time",
    "sleep_time": "Similar sleep schedule",
    "noise_tolerance": "Similar noise tolerance",
    "cleanliness_level": "Similar cleanliness habits",
    "guest_policy": "Similar guest preference",
    "bathroom_schedule": "Compatible bathroom schedule",
    "introvert_extrovert": "Similar social energy",
    "vaping_habit": "Compatible vaping habits",
    "hobbies": "Shared hobbies",
    "field_of_study": "Related field of study",
}


def _get(obj, field, default=None):
    if isinstance(obj, dict):
        return obj.get(field, default)
    return getattr(obj, field, default)


def _linear_score(val_a, val_b, max_points, scale_max=5):
    if val_a is None or val_b is None:
        return max_points * 0.5
    diff = abs(int(val_a) - int(val_b))
    max_diff = scale_max - 1
    if max_diff == 0:
        return float(max_points)
    return round(max_points * (1 - diff / max_diff), 4)


def _bathroom_score(val_a, val_b):
    max_pts = WEIGHTS["bathroom_schedule"]
    if val_a is None or val_b is None:
        return max_pts * 0.5
    if val_a == val_b:
        return float(max_pts)
    if val_a == 3 or val_b == 3:
        return float(max_pts)
    return max_pts * 0.5


def _vaping_score(val_a, val_b):
    max_pts = WEIGHTS["vaping_habit"]
    if val_a is None or val_b is None:
        return max_pts * 0.5
    diff = abs(int(val_a) - int(val_b))
    max_diff = 2
    return round(max_pts * (1 - diff / max_diff), 4)


def _hobbies_score(hobbies_a, hobbies_b):
    max_pts = WEIGHTS["hobbies"]

    set_a = set(hobbies_a) if hobbies_a else set()
    set_b = set(hobbies_b) if hobbies_b else set()

    set_a = set_a & VALID_HOBBIES
    set_b = set_b & VALID_HOBBIES

    if not set_a or not set_b:
        return max_pts * 0.5

    intersection = len(set_a & set_b)
    union = len(set_a | set_b)

    if union == 0:
        return max_pts * 0.5

    jaccard = intersection / union
    return round(max_pts * jaccard, 4)


def _field_of_study_score(field_a, field_b):
    max_pts = WEIGHTS["field_of_study"]

    if field_a is None or field_b is None:
        return max_pts * 0.5

    if field_a == field_b:
        return float(max_pts)

    if field_a == "other" or field_b == "other":
        return max_pts * 0.5

    group_a = FIELD_GROUPS.get(field_a)
    group_b = FIELD_GROUPS.get(field_b)

    if group_a and group_b and group_a == group_b:
        return max_pts * 0.5

    return 0.0


def is_hard_incompatible(student_a, student_b):
    """
    Returns (True, reason) when the pair must be excluded.

    Expected reason values:
    gender_policy, fragrance, nut_allergy, smoke_respiratory.
    """
    gender_a = _get(student_a, "gender")
    gender_b = _get(student_b, "gender")

    if gender_a and gender_b and gender_a != gender_b:
        return True, "gender_policy"

    allergy_a = _get(student_a, "allergies") or {}
    allergy_b = _get(student_b, "allergies") or {}

    frag_sensitive_a = _get(allergy_a, "has_fragrance_sensitivity", False)
    frag_sensitive_b = _get(allergy_b, "has_fragrance_sensitivity", False)
    heavy_frag_a = _get(allergy_a, "heavy_fragrance_user", False)
    heavy_frag_b = _get(allergy_b, "heavy_fragrance_user", False)

    same_fragrance_allergy = frag_sensitive_a and frag_sensitive_b

    if frag_sensitive_a and heavy_frag_b and not same_fragrance_allergy:
        return True, "fragrance"
    if frag_sensitive_b and heavy_frag_a and not same_fragrance_allergy:
        return True, "fragrance"

    nut_allergy_a = _get(allergy_a, "has_severe_nut_allergy", False)
    nut_allergy_b = _get(allergy_b, "has_severe_nut_allergy", False)
    nuts_in_room_a = _get(allergy_a, "stores_or_eats_nuts_in_room", False)
    nuts_in_room_b = _get(allergy_b, "stores_or_eats_nuts_in_room", False)

    same_nut_allergy = nut_allergy_a and nut_allergy_b

    if nut_allergy_a and nuts_in_room_b and not same_nut_allergy:
        return True, "nut_allergy"
    if nut_allergy_b and nuts_in_room_a and not same_nut_allergy:
        return True, "nut_allergy"

    smoke_sensitive_a = _get(allergy_a, "has_smoke_sensitivity", False)
    smoke_sensitive_b = _get(allergy_b, "has_smoke_sensitivity", False)
    asthma_a = _get(allergy_a, "has_asthma_or_respiratory_condition", False)
    asthma_b = _get(allergy_b, "has_asthma_or_respiratory_condition", False)
    smokes_a = _get(allergy_a, "smoking_habit", "no") != "no"
    smokes_b = _get(allergy_b, "smoking_habit", "no") != "no"

    same_smoke_related_allergy = (smoke_sensitive_a and smoke_sensitive_b) or (asthma_a and asthma_b)

    if (smoke_sensitive_a or asthma_a) and smokes_b and not same_smoke_related_allergy:
        return True, "smoke_respiratory"
    if (smoke_sensitive_b or asthma_b) and smokes_a and not same_smoke_related_allergy:
        return True, "smoke_respiratory"

    return False, None


def get_allergy_warnings(student_a, student_b, pref_a, pref_b):
    warnings = []
    allergy_a = _get(student_a, "allergies") or {}
    allergy_b = _get(student_b, "allergies") or {}

    if _get(allergy_a, "has_dust_mould_allergy") and _get(pref_b, "cleanliness_level", 3) <= 2:
        warnings.append("Student A has dust/mould allergy; Student B has low cleanliness rating")
    if _get(allergy_b, "has_dust_mould_allergy") and _get(pref_a, "cleanliness_level", 3) <= 2:
        warnings.append("Student B has dust/mould allergy; Student A has low cleanliness rating")

    if _get(allergy_a, "has_food_allergy") and _get(allergy_b, "cooks_strong_smelling_food"):
        warnings.append("Student A has food allergy; Student B frequently cooks strong-smelling food")
    if _get(allergy_b, "has_food_allergy") and _get(allergy_a, "cooks_strong_smelling_food"):
        warnings.append("Student B has food allergy; Student A frequently cooks strong-smelling food")

    if _get(allergy_a, "has_chemical_sensitivity") and _get(allergy_b, "uses_strong_cleaning_products"):
        warnings.append("Student A has chemical sensitivity; Student B uses strong cleaning products")
    if _get(allergy_b, "has_chemical_sensitivity") and _get(allergy_a, "uses_strong_cleaning_products"):
        warnings.append("Student B has chemical sensitivity; Student A uses strong cleaning products")

    return warnings


def calculate_compatibility(pref_a, pref_b):
    breakdown = {}

    breakdown["wake_time"] = _linear_score(
        _get(pref_a, "wake_time"), _get(pref_b, "wake_time"), WEIGHTS["wake_time"], scale_max=5
    )
    breakdown["sleep_time"] = _linear_score(
        _get(pref_a, "sleep_time"), _get(pref_b, "sleep_time"), WEIGHTS["sleep_time"], scale_max=5
    )
    breakdown["noise_tolerance"] = _linear_score(
        _get(pref_a, "noise_tolerance"), _get(pref_b, "noise_tolerance"), WEIGHTS["noise_tolerance"], scale_max=5
    )
    breakdown["cleanliness_level"] = _linear_score(
        _get(pref_a, "cleanliness_level"), _get(pref_b, "cleanliness_level"), WEIGHTS["cleanliness_level"], scale_max=5
    )
    breakdown["guest_policy"] = _linear_score(
        _get(pref_a, "guest_policy"), _get(pref_b, "guest_policy"), WEIGHTS["guest_policy"], scale_max=5
    )
    breakdown["introvert_extrovert"] = _linear_score(
        _get(pref_a, "introvert_extrovert"), _get(pref_b, "introvert_extrovert"), WEIGHTS["introvert_extrovert"], scale_max=5
    )
    breakdown["bathroom_schedule"] = _bathroom_score(
        _get(pref_a, "bathroom_schedule"), _get(pref_b, "bathroom_schedule")
    )
    breakdown["vaping_habit"] = _vaping_score(
        _get(pref_a, "vaping_habit"), _get(pref_b, "vaping_habit")
    )
    breakdown["hobbies"] = _hobbies_score(
        _get(pref_a, "hobbies"), _get(pref_b, "hobbies")
    )
    breakdown["field_of_study"] = _field_of_study_score(
        _get(pref_a, "field_of_study"), _get(pref_b, "field_of_study")
    )

    total = round(sum(breakdown.values()))
    total = max(0, min(100, total))

    return total, breakdown


def is_flagged(score):
    return score is not None and score < LOW_COMPATIBILITY_THRESHOLD


def build_compatibility_graph(eligible_students):
    G = nx.Graph()
    excluded_pairs = []
    soft_warnings = {}

    for s in eligible_students:
        G.add_node(s["student_id"])

    for s1, s2 in itertools.combinations(eligible_students, 2):
        id1 = s1["student_id"]
        id2 = s2["student_id"]

        incompatible, reason = is_hard_incompatible(s1, s2)
        if incompatible:
            excluded_pairs.append({
                "student_id_1": id1,
                "student_id_2": id2,
                "reason": reason,
            })
            continue

        score, breakdown = calculate_compatibility(s1["preferences"], s2["preferences"])
        warnings = get_allergy_warnings(s1, s2, s1["preferences"], s2["preferences"])
        if warnings:
            soft_warnings[(id1, id2)] = warnings

        G.add_edge(id1, id2, weight=score, breakdown=breakdown)

    return G, excluded_pairs, soft_warnings


def extract_mutual_pairs(eligible_students, G):
    confirmed_mutual_pairs = []
    nodes_to_remove = set()
    by_id = {s["student_id"]: s for s in eligible_students}

    for s in eligible_students:
        sid = s["student_id"]
        mutual_ids = s.get("mutual_pairs", set())

        for other_id in mutual_ids:
            if sid >= other_id:
                continue

            other_student = by_id.get(other_id)
            if not other_student:
                continue

            if sid not in other_student.get("mutual_pairs", set()):
                continue

            if not G.has_edge(sid, other_id):
                continue

            edge = G.get_edge_data(sid, other_id)
            score = edge["weight"]
            breakdown = edge["breakdown"]

            if score < LOW_COMPATIBILITY_THRESHOLD:
                continue

            confirmed_mutual_pairs.append({
                "student_id_1": sid,
                "student_id_2": other_id,
                "score": score,
                "breakdown": breakdown,
                "is_flagged": False,
                "assignment_type": "mutual_preference",
            })
            nodes_to_remove.add(sid)
            nodes_to_remove.add(other_id)

    G.remove_nodes_from(nodes_to_remove)
    return confirmed_mutual_pairs, G


def run_maximum_weight_matching(G):
    if len(G.nodes) == 0:
        return [], []

    matching = nx.max_weight_matching(G, maxcardinality=True, weight="weight")
    matched_ids = set()
    pairs = []

    for a, b in matching:
        edge = G.get_edge_data(a, b) or {}
        score = edge.get("weight", 0)
        pairs.append({
            "student_id_1": a,
            "student_id_2": b,
            "score": score,
            "breakdown": edge.get("breakdown", {}),
            "is_flagged": is_flagged(score),
            "assignment_type": "algorithm",
        })
        matched_ids.add(a)
        matched_ids.add(b)

    unmatched_ids = [n for n in G.nodes if n not in matched_ids]
    return pairs, unmatched_ids


def compute_storage_rows(eligible_students):
    rows = []

    for s1, s2 in itertools.combinations(eligible_students, 2):
        id1, id2 = s1["student_id"], s2["student_id"]

        incompatible, reason = is_hard_incompatible(s1, s2)
        if incompatible:
            score, blocked, block_reason = 0, True, reason
        else:
            score, _ = calculate_compatibility(s1["preferences"], s2["preferences"])
            blocked, block_reason = False, None

        rows.append({
            "student_id": id1,
            "candidate_id": id2,
            "score": score,
            "is_hard_blocked": blocked,
            "block_reason": block_reason,
        })
        rows.append({
            "student_id": id2,
            "candidate_id": id1,
            "score": score,
            "is_hard_blocked": blocked,
            "block_reason": block_reason,
        })

    return rows


def get_reason_tags(breakdown):
    tags = []
    for dimension, points in breakdown.items():
        max_pts = WEIGHTS.get(dimension)
        if max_pts and points >= max_pts * _REASON_TAG_THRESHOLD:
            tags.append(_REASON_TAG_LABELS.get(dimension, dimension))
    return tags


def run_full_matching(eligible_students):
    G, excluded_pairs, soft_warnings = build_compatibility_graph(eligible_students)
    mutual_pairs, G = extract_mutual_pairs(eligible_students, G)
    algorithm_pairs, unmatched_ids = run_maximum_weight_matching(G)
    all_pairs = mutual_pairs + algorithm_pairs

    return {
        "mutual_pairs": mutual_pairs,
        "algorithm_pairs": algorithm_pairs,
        "all_pairs": all_pairs,
        "unmatched_ids": unmatched_ids,
        "excluded_pairs": excluded_pairs,
        "soft_warnings": {f"{k[0]}-{k[1]}": v for k, v in soft_warnings.items()},
        "total_students": len(eligible_students),
        "total_pairs": len(all_pairs),
    }
