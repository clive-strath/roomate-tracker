import networkx as nx
from app.services.compatibility_engine import run_maximum_weight_matching, build_compatibility_graph

def test_four_students_max_weight():
    # A-B=100, A-C=95, A-D=95, B-C=94, B-D=94, C-D=5
    G = nx.Graph()
    G.add_node("A", gender="male")
    G.add_node("B", gender="male")
    G.add_node("C", gender="male")
    G.add_node("D", gender="male")

    G.add_edge("A", "B", weight=100, breakdown={})
    G.add_edge("A", "C", weight=95, breakdown={})
    G.add_edge("A", "D", weight=95, breakdown={})
    G.add_edge("B", "C", weight=94, breakdown={})
    G.add_edge("B", "D", weight=94, breakdown={})
    G.add_edge("C", "D", weight=5, breakdown={})

    matched_pairs, unmatched_ids = run_maximum_weight_matching(G)

    # We should have two pairs, and no unmatched IDs
    assert len(matched_pairs) == 2
    assert len(unmatched_ids) == 0

    # The matched pairs should not be A-B (100) and C-D (5) because max weight matching with maxcardinality
    # will optimize for A-C (95) + B-D (94) = 189, or A-D (95) + B-C (94) = 189.
    # Total score for {A-B, C-D} is 105, which is lower than 189.
    pairs = set()
    for pair in matched_pairs:
        pair_set = frozenset([pair["student_id_1"], pair["student_id_2"]])
        pairs.add(pair_set)

    option1 = {frozenset(["A", "C"]), frozenset(["B", "D"])}
    option2 = {frozenset(["A", "D"]), frozenset(["B", "C"])}

    assert pairs == option1 or pairs == option2

def test_odd_number_of_students():
    G = nx.Graph()
    G.add_node("A", gender="female")
    G.add_node("B", gender="female")
    G.add_node("C", gender="female")

    G.add_edge("A", "B", weight=80, breakdown={})
    G.add_edge("B", "C", weight=70, breakdown={})
    G.add_edge("A", "C", weight=60, breakdown={})

    matched_pairs, unmatched_ids = run_maximum_weight_matching(G)

    assert len(matched_pairs) == 1
    assert len(unmatched_ids) == 1
    assert unmatched_ids[0] == "C"  # A-B (80) is selected, leaving C unmatched

def test_different_genders_no_edges():
    students = [
        {
            "student_id": 1,
            "gender": "male",
            "preferences": {
                "wake_time": 3, "sleep_time": 3, "noise_tolerance": 3,
                "cleanliness_level": 3, "guest_policy": 3, "bathroom_schedule": 1
            }
        },
        {
            "student_id": 2,
            "gender": "female",
            "preferences": {
                "wake_time": 3, "sleep_time": 3, "noise_tolerance": 3,
                "cleanliness_level": 3, "guest_policy": 3, "bathroom_schedule": 1
            }
        }
    ]

    G = build_compatibility_graph(students)
    assert G.number_of_nodes() == 2
    assert G.number_of_edges() == 0  # no cross-gender edges

    matched_pairs, unmatched_ids = run_maximum_weight_matching(G)
    assert len(matched_pairs) == 0
    assert len(unmatched_ids) == 2
    assert set(unmatched_ids) == {1, 2}
