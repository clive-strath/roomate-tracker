"""
Pairwise compatibility scoring between two students' preference records.
Pure function — no Flask, no database access, fully unit-testable in isolation.
"""

WEIGHTS = {
    "wake_time":         20,
    "sleep_time":        20,
    "noise_tolerance":   20,
    "cleanliness_level": 15,
    "guest_policy":      15,
    "bathroom_schedule": 10,
}

def _scaled_diff_score(val_a, val_b, max_points, scale_max):
    """
    Generic 'closer is better' scorer.
    scale_max is the maximum possible value on that dimension's scale (5 for most, 3 for bathroom).
    """
    diff = abs(val_a - val_b)
    max_diff = scale_max - 1
    if max_diff == 0:
        return max_points
    return round(max_points * (1 - diff / max_diff), 2)


def calculate_compatibility(pref_a, pref_b):
    """
    pref_a, pref_b: dicts or ORM objects exposing the six preference attributes.
    Returns (total_score: int 0-100, breakdown: dict)
    """
    def get(p, field):
        return p[field] if isinstance(p, dict) else getattr(p, field)

    breakdown = {}

    breakdown["wake_time"] = _scaled_diff_score(
        get(pref_a, "wake_time"), get(pref_b, "wake_time"), WEIGHTS["wake_time"], 5
    )
    breakdown["sleep_time"] = _scaled_diff_score(
        get(pref_a, "sleep_time"), get(pref_b, "sleep_time"), WEIGHTS["sleep_time"], 5
    )
    breakdown["noise_tolerance"] = _scaled_diff_score(
        get(pref_a, "noise_tolerance"), get(pref_b, "noise_tolerance"), WEIGHTS["noise_tolerance"], 5
    )
    breakdown["cleanliness_level"] = _scaled_diff_score(
        get(pref_a, "cleanliness_level"), get(pref_b, "cleanliness_level"), WEIGHTS["cleanliness_level"], 5
    )
    breakdown["guest_policy"] = _scaled_diff_score(
        get(pref_a, "guest_policy"), get(pref_b, "guest_policy"), WEIGHTS["guest_policy"], 5
    )

    # Bathroom schedule is categorical (1=morning, 2=evening, 3=flexible), not linear distance.
    bath_a, bath_b = get(pref_a, "bathroom_schedule"), get(pref_b, "bathroom_schedule")
    if bath_a == bath_b or bath_a == 3 or bath_b == 3:
        breakdown["bathroom_schedule"] = WEIGHTS["bathroom_schedule"]
    else:
        breakdown["bathroom_schedule"] = WEIGHTS["bathroom_schedule"] * 0.5

    total = round(sum(breakdown.values()))
    total = max(0, min(100, total))

    return total, breakdown


LOW_COMPATIBILITY_THRESHOLD = 40

def is_flagged(score):
    return score < LOW_COMPATIBILITY_THRESHOLD


import networkx as nx
import itertools


def build_compatibility_graph(eligible_students):
    """
    eligible_students: list of dicts/objects each with:
        student_id, gender, preferences (object with the 6 fields)

    Returns: networkx.Graph with one node per student and one weighted
    edge per SAME-GENDER pair, weight = compatibility score.
    """
    G = nx.Graph()

    for s in eligible_students:
        G.add_node(s["student_id"], gender=s["gender"])

    for s1, s2 in itertools.combinations(eligible_students, 2):
        if s1["gender"] != s2["gender"]:
            continue  # hard constraint — never create cross-gender edges

        score, breakdown = calculate_compatibility(s1["preferences"], s2["preferences"])
        G.add_edge(
            s1["student_id"], s2["student_id"],
            weight=score, breakdown=breakdown
        )

    return G


def run_maximum_weight_matching(G):
    """
    Returns a list of dicts, one per matched pair:
        { student_id_1, student_id_2, score, breakdown }
    Also returns the list of student_ids left unmatched.
    """
    matching = nx.max_weight_matching(G, maxcardinality=True, weight="weight")

    matched_pairs = []
    matched_ids = set()

    for a, b in matching:
        edge_data = G.get_edge_data(a, b)
        matched_pairs.append({
            "student_id_1": a,
            "student_id_2": b,
            "score": edge_data["weight"],
            "breakdown": edge_data["breakdown"],
        })
        matched_ids.add(a)
        matched_ids.add(b)

    all_ids = set(G.nodes)
    unmatched_ids = list(all_ids - matched_ids)

    return matched_pairs, unmatched_ids
