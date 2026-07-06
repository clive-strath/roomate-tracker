from app.extensions import db
from app.models import (
    Student,
    StudentPreference,
    StudentAllergy,
    PreferredRoommate,
    Room,
    RoomAssignment,
)
from app.services.compatibility_engine import (
    calculate_compatibility,
    build_compatibility_graph,
    run_maximum_weight_matching,
    run_full_matching,
    is_flagged
)
from app.services.email_service import send_allocation_email

import networkx as nx


def _append_notification(target, student, room, semester, assignment_status, roommate=None, compatibility_score=None):
    if not student or not student.email:
        return
    target.append({
        "student": student,
        "room": room,
        "semester": semester,
        "assignment_status": assignment_status,
        "roommate": roommate,
        "compatibility_score": compatibility_score,
    })

def get_waiting_students(semester):
    """
    Students with status = 'awaiting_roommate' in this semester.
    They already have a room — they do NOT need a new empty room found,
    they need student_id_2 filled in on their EXISTING assignment row.
    """
    return RoomAssignment.query.filter_by(
        semester=semester, status="awaiting_roommate"
    ).all()


def get_eligible_students(semester, waiting_student_ids=None):
    """
    Returns eligible students list for the compatibility graph matching pool.
    Eligible students:
    1. Active student status
    2. Preference row exists
    3. Not in any active/awaiting assignment for this semester,
       except students already awaiting_roommate (explicitly re-included).
    """
    waiting_student_ids = waiting_student_ids or set()

    # Query all active/verified students who have preferences submitted.
    students = Student.query.filter(
        Student.status == "active",
        Student.email_verified.is_(True),
        Student.verification_status == "approved",
    ).join(StudentPreference).all()

    # Get all active or awaiting assignments for this semester
    semester_assignments = RoomAssignment.query.filter(
        RoomAssignment.semester == semester,
        RoomAssignment.status.in_(["active", "awaiting_roommate"])
    ).all()

    assigned_ids = set()
    for assignment in semester_assignments:
        assigned_ids.add(assignment.student_id_1)
        if assignment.student_id_2:
            assigned_ids.add(assignment.student_id_2)

    student_ids = [s.student_id for s in students]
    allergy_rows = StudentAllergy.query.filter(StudentAllergy.student_id.in_(student_ids)).all() if student_ids else []
    allergy_map = {row.student_id: row for row in allergy_rows}

    pref_rows = PreferredRoommate.query.filter(PreferredRoommate.student_id.in_(student_ids)).all() if student_ids else []
    mutual_map = {}
    for row in pref_rows:
        mutual_map.setdefault(row.student_id, set()).add(row.preferred_student_id)

    eligible = []
    for s in students:
        if s.student_id not in assigned_ids or s.student_id in waiting_student_ids:
            eligible.append({
                "student_id": s.student_id,
                "name": s.name,
                "gender": s.gender,
                "year": s.year,
                "student_number": s.student_number,
                "preferences": s.preferences,
                "allergies": allergy_map.get(s.student_id),
                "mutual_pairs": mutual_map.get(s.student_id, set()),
            })

    return eligible


def run_prioritized_matching(eligible_students, waiting_student_ids):
    """
    Priority rule:
    1) Match waiting students against fresh eligible students first.
    2) Then match remaining fresh students among themselves.

    Waiting students left unmatched remain awaiting_roommate and are not
    treated as fresh singles requiring a new room.
    """
    waiting_student_ids = set(waiting_student_ids)

    if not eligible_students:
        return [], [], []

    by_id = {s["student_id"]: s for s in eligible_students}
    fresh_students = [s for s in eligible_students if s["student_id"] not in waiting_student_ids]
    waiting_students = [s for s in eligible_students if s["student_id"] in waiting_student_ids]

    matched_pairs = []
    matched_ids = set()

    # Step 1: waiting-vs-fresh priority matching only
    if waiting_students and fresh_students:
        priority_graph = nx.Graph()

        for s in waiting_students + fresh_students:
            priority_graph.add_node(s["student_id"], gender=s["gender"])

        for waiting in waiting_students:
            for fresh in fresh_students:
                if waiting["gender"] != fresh["gender"]:
                    continue

                score, breakdown = calculate_compatibility(waiting["preferences"], fresh["preferences"])
                priority_graph.add_edge(
                    waiting["student_id"],
                    fresh["student_id"],
                    weight=score,
                    breakdown=breakdown,
                )

        priority_pairs, _ = run_maximum_weight_matching(priority_graph)
        matched_pairs.extend(priority_pairs)
        for pair in priority_pairs:
            matched_ids.add(pair["student_id_1"])
            matched_ids.add(pair["student_id_2"])

    # Step 2: match remaining fresh students among themselves
    remaining_fresh = [s for s in fresh_students if s["student_id"] not in matched_ids]
    if remaining_fresh:
        # Apply mutual preferred-roommate priority before algorithmic pairing.
        fresh_result = run_full_matching(remaining_fresh)
        fresh_pairs = fresh_result["all_pairs"]
        fresh_unmatched = fresh_result["unmatched_ids"]
        matched_pairs.extend(fresh_pairs)
    else:
        fresh_unmatched = []

    matched_waiting_ids = {
        sid for sid in matched_ids if sid in waiting_student_ids
    }
    unmatched_waiting_ids = sorted(waiting_student_ids - matched_waiting_ids)

    # Ensure unmatched fresh IDs always reference current eligible IDs
    valid_ids = set(by_id.keys())
    unmatched_fresh_ids = sorted(sid for sid in fresh_unmatched if sid in valid_ids)

    return matched_pairs, unmatched_fresh_ids, unmatched_waiting_ids


def generate_allocation_preview(semester):
    """
    Read-only. Computes everything but writes nothing to the database.
    Returns a structure the frontend can review before confirmation.
    """
    waiting_assignments = get_waiting_students(semester)
    waiting_student_ids = {wa.student_id_1 for wa in waiting_assignments}

    eligible = get_eligible_students(semester, waiting_student_ids=waiting_student_ids)

    # We need to map student details for frontend display
    student_map = {s["student_id"]: s for s in eligible}

    matched_pairs, unmatched_fresh_ids, unmatched_waiting_ids = run_prioritized_matching(
        eligible,
        waiting_student_ids,
    )

    # Process pairs and inject details
    formatted_pairs = []
    for pair in matched_pairs:
        s1 = student_map.get(pair["student_id_1"])
        s2 = student_map.get(pair["student_id_2"])
        
        score = pair["score"]
        flagged = is_flagged(score)
        
        joins_existing = (
            pair["student_id_1"] in waiting_student_ids or
            pair["student_id_2"] in waiting_student_ids
        )

        formatted_pairs.append({
            "student_id_1": pair["student_id_1"],
            "student_id_2": pair["student_id_2"],
            "student_1_name": s1["name"] if s1 else "Unknown",
            "student_2_name": s2["name"] if s2 else "Unknown",
            "student_1_gender": s1["gender"] if s1 else "Unknown",
            "student_2_gender": s2["gender"] if s2 else "Unknown",
            "student_1_number": s1["student_number"] if s1 else "",
            "student_2_number": s2["student_number"] if s2 else "",
            "student_1_year": s1["year"] if s1 else 1,
            "student_2_year": s2["year"] if s2 else 1,
            "score": score,
            "breakdown": pair["breakdown"],
            "is_flagged": flagged,
            "joins_existing_room": joins_existing
        })

    # Process unmatched (singles)
    formatted_singles = []
    for sid in unmatched_fresh_ids:
        s = student_map.get(sid)
        formatted_singles.append({
            "student_id": sid,
            "name": s["name"] if s else "Unknown",
            "gender": s["gender"] if s else "Unknown",
            "student_number": s["student_number"] if s else "",
            "year": s["year"] if s else 1
        })

    empty_rooms_needed = sum(1 for p in formatted_pairs if not p["joins_existing_room"])
    empty_rooms_needed += len(unmatched_fresh_ids)

    available_empty_rooms = Room.query.filter_by(status="empty").count()

    return {
        "matched_pairs": formatted_pairs,
        "unmatched_student_ids": unmatched_fresh_ids,
        "unmatched_students": formatted_singles,
        "waiting_unmatched_student_ids": unmatched_waiting_ids,
        "rooms_required": empty_rooms_needed,
        "rooms_available": available_empty_rooms,
        "sufficient_rooms": available_empty_rooms >= empty_rooms_needed,
    }


def confirm_allocation(semester, admin_id, confirmed_pairs, confirmed_singles):
    """
    Writes everything. Called only after admin reviews the preview and confirms,
    optionally after manual overrides on the frontend.

    confirmed_pairs: list of { student_id_1, student_id_2, score, breakdown, joins_existing_room }
    confirmed_singles: list of student_ids with no match this round
    """
    confirmed_pairs = confirmed_pairs or []
    confirmed_singles = confirmed_singles or []
    results = {"created": [], "updated": [], "failed": []}
    reusable_statuses = ["cancelled", "completed", "archived"]
    notifications = []

    required_empty_rooms = (
        sum(1 for p in confirmed_pairs if not p.get("joins_existing_room"))
        + len(confirmed_singles)
    )
    available_empty_rooms = Room.query.filter_by(status="empty").count()
    if available_empty_rooms < required_empty_rooms:
        raise ValueError("Allocation cannot be completed. Please add additional rooms.")

    seen_students = set()
    normalized_pairs = []

    for pair in confirmed_pairs:
        sid1 = pair.get("student_id_1")
        sid2 = pair.get("student_id_2")

        if not sid1 or not sid2:
            raise ValueError("Each confirmed pair must include student_id_1 and student_id_2")
        if sid1 == sid2:
            raise ValueError("Cannot pair a student with themselves")
        if sid1 in seen_students or sid2 in seen_students:
            raise ValueError("A student appears multiple times in the same approval request")

        seen_students.add(sid1)
        seen_students.add(sid2)

        normalized_pairs.append({
            "student_id_1": sid1,
            "student_id_2": sid2,
            "score": pair.get("score"),
            "breakdown": pair.get("breakdown"),
            "joins_existing_room": bool(pair.get("joins_existing_room")),
        })

    for student_id in confirmed_singles:
        if not student_id:
            raise ValueError("Invalid student_id in confirmed_singles")
        if student_id in seen_students:
            raise ValueError("A student cannot be both paired and single in the same approval request")
        seen_students.add(student_id)

    empty_rooms = Room.query.filter_by(status="empty").order_by(Room.room_id.asc()).all()
    room_iter = iter(empty_rooms)

    try:
        for pair in normalized_pairs:
            sid1 = pair["student_id_1"]
            sid2 = pair["student_id_2"]

            if pair["joins_existing_room"]:
                existing = RoomAssignment.query.filter(
                    RoomAssignment.semester == semester,
                    RoomAssignment.status == "awaiting_roommate",
                    db.or_(
                        RoomAssignment.student_id_1 == sid1,
                        RoomAssignment.student_id_1 == sid2,
                    )
                ).first()

                if not existing:
                    raise ValueError("Waiting record not found for one of the approved pairs")

                new_student_id = sid2 if existing.student_id_1 == sid1 else sid1

                already_assigned_new = RoomAssignment.query.filter(
                    RoomAssignment.semester == semester,
                    RoomAssignment.status.in_(["active", "awaiting_roommate"]),
                    db.or_(
                        RoomAssignment.student_id_1 == new_student_id,
                        RoomAssignment.student_id_2 == new_student_id,
                    )
                ).filter(RoomAssignment.assignment_id != existing.assignment_id).first()

                if already_assigned_new:
                    raise ValueError(f"Student {new_student_id} already assigned")

                existing.student_id_2 = new_student_id
                existing.compatibility_score = pair["score"]
                existing.score_breakdown = pair["breakdown"]
                existing.is_flagged = is_flagged(pair["score"]) if pair["score"] is not None else False
                existing.status = "active"
                results["updated"].append(existing.assignment_id)

                waiting_student = Student.query.get(existing.student_id_1)
                new_student = Student.query.get(new_student_id)
                room = Room.query.get(existing.room_id)
                _append_notification(
                    notifications,
                    waiting_student,
                    room,
                    semester,
                    existing.status,
                    roommate=new_student,
                    compatibility_score=pair["score"],
                )
                _append_notification(
                    notifications,
                    new_student,
                    room,
                    semester,
                    existing.status,
                    roommate=waiting_student,
                    compatibility_score=pair["score"],
                )

                for sid in (existing.student_id_1, new_student_id):
                    pref = StudentPreference.query.filter_by(student_id=sid).first()
                    if pref:
                        pref.is_locked = True

                continue

            already_assigned = RoomAssignment.query.filter(
                RoomAssignment.semester == semester,
                RoomAssignment.status.in_(["active", "awaiting_roommate"]),
                db.or_(
                    RoomAssignment.student_id_1 == sid1,
                    RoomAssignment.student_id_2 == sid1,
                    RoomAssignment.student_id_1 == sid2,
                    RoomAssignment.student_id_2 == sid2,
                )
            ).first()

            if already_assigned:
                raise ValueError("One or both students already assigned")

            room = next(room_iter, None)
            if not room:
                raise ValueError("Allocation cannot be completed. Please add additional rooms.")

            reusable_assignment = RoomAssignment.query.filter(
                RoomAssignment.semester == semester,
                RoomAssignment.status.in_(reusable_statuses),
                db.or_(
                    db.and_(
                        RoomAssignment.student_id_1 == sid1,
                        RoomAssignment.student_id_2 == sid2,
                    ),
                    db.and_(
                        RoomAssignment.student_id_1 == sid2,
                        RoomAssignment.student_id_2 == sid1,
                    ),
                ),
            ).order_by(RoomAssignment.updated_at.desc()).first()

            if not reusable_assignment:
                reusable_assignment = RoomAssignment.query.filter(
                    RoomAssignment.semester == semester,
                    RoomAssignment.room_id == room.room_id,
                    RoomAssignment.status.in_(reusable_statuses),
                ).order_by(RoomAssignment.updated_at.desc()).first()

            if reusable_assignment:
                reusable_assignment.student_id_1 = sid1
                reusable_assignment.student_id_2 = sid2
                reusable_assignment.room_id = room.room_id
                reusable_assignment.compatibility_score = pair["score"]
                reusable_assignment.score_breakdown = pair["breakdown"]
                reusable_assignment.assignment_type = "algorithm"
                reusable_assignment.override_reason = None
                reusable_assignment.overridden_by = None
                reusable_assignment.overridden_at = None
                reusable_assignment.status = "active"
                reusable_assignment.is_flagged = is_flagged(pair["score"]) if pair["score"] is not None else False
                reusable_assignment.assigned_by = admin_id
                results["updated"].append(reusable_assignment.assignment_id)

                s1 = Student.query.get(sid1)
                s2 = Student.query.get(sid2)
                _append_notification(
                    notifications,
                    s1,
                    room,
                    semester,
                    reusable_assignment.status,
                    roommate=s2,
                    compatibility_score=pair["score"],
                )
                _append_notification(
                    notifications,
                    s2,
                    room,
                    semester,
                    reusable_assignment.status,
                    roommate=s1,
                    compatibility_score=pair["score"],
                )
            else:
                assignment = RoomAssignment(
                    student_id_1=sid1,
                    student_id_2=sid2,
                    room_id=room.room_id,
                    semester=semester,
                    compatibility_score=pair["score"],
                    score_breakdown=pair["breakdown"],
                    assignment_type="algorithm",
                    status="active",
                    is_flagged=is_flagged(pair["score"]) if pair["score"] is not None else False,
                    assigned_by=admin_id,
                )
                db.session.add(assignment)
                db.session.flush()
                results["created"].append(assignment.assignment_id)

                s1 = Student.query.get(sid1)
                s2 = Student.query.get(sid2)
                _append_notification(
                    notifications,
                    s1,
                    room,
                    semester,
                    assignment.status,
                    roommate=s2,
                    compatibility_score=pair["score"],
                )
                _append_notification(
                    notifications,
                    s2,
                    room,
                    semester,
                    assignment.status,
                    roommate=s1,
                    compatibility_score=pair["score"],
                )

            for sid in (sid1, sid2):
                pref = StudentPreference.query.filter_by(student_id=sid).first()
                if pref:
                    pref.is_locked = True

        for student_id in confirmed_singles:
            already_assigned = RoomAssignment.query.filter(
                RoomAssignment.semester == semester,
                RoomAssignment.status.in_(["active", "awaiting_roommate"]),
                db.or_(
                    RoomAssignment.student_id_1 == student_id,
                    RoomAssignment.student_id_2 == student_id,
                )
            ).first()

            if already_assigned:
                raise ValueError(f"Student {student_id} already assigned")

            room = next(room_iter, None)
            if not room:
                raise ValueError("Allocation cannot be completed. Please add additional rooms.")

            reusable_assignment = RoomAssignment.query.filter(
                RoomAssignment.semester == semester,
                RoomAssignment.status.in_(reusable_statuses),
                RoomAssignment.room_id == room.room_id,
            ).order_by(RoomAssignment.updated_at.desc()).first()

            if reusable_assignment:
                reusable_assignment.student_id_1 = student_id
                reusable_assignment.student_id_2 = None
                reusable_assignment.room_id = room.room_id
                reusable_assignment.compatibility_score = None
                reusable_assignment.score_breakdown = None
                reusable_assignment.assignment_type = "algorithm"
                reusable_assignment.override_reason = None
                reusable_assignment.overridden_by = None
                reusable_assignment.overridden_at = None
                reusable_assignment.status = "awaiting_roommate"
                reusable_assignment.is_flagged = False
                reusable_assignment.assigned_by = admin_id
                results["updated"].append(reusable_assignment.assignment_id)

                student = Student.query.get(student_id)
                _append_notification(
                    notifications,
                    student,
                    room,
                    semester,
                    reusable_assignment.status,
                    roommate=None,
                    compatibility_score=None,
                )
            else:
                assignment = RoomAssignment(
                    student_id_1=student_id,
                    student_id_2=None,
                    room_id=room.room_id,
                    semester=semester,
                    compatibility_score=None,
                    score_breakdown=None,
                    assignment_type="algorithm",
                    status="awaiting_roommate",
                    is_flagged=False,
                    assigned_by=admin_id,
                )
                db.session.add(assignment)
                db.session.flush()
                results["created"].append(assignment.assignment_id)

                student = Student.query.get(student_id)
                _append_notification(
                    notifications,
                    student,
                    room,
                    semester,
                    assignment.status,
                    roommate=None,
                    compatibility_score=None,
                )

            pref = StudentPreference.query.filter_by(student_id=student_id).first()
            if pref:
                pref.is_locked = True
    except Exception:
        db.session.rollback()
        raise

    db.session.commit()

    notification_failures = []
    notification_success = 0
    for payload in notifications:
        try:
            send_allocation_email(
                student=payload["student"],
                room=payload["room"],
                semester=payload["semester"],
                assignment_status=payload["assignment_status"],
                roommate=payload["roommate"],
                compatibility_score=payload["compatibility_score"],
            )
            notification_success += 1
        except Exception as exc:
            notification_failures.append({
                "student_id": payload["student"].student_id,
                "email": payload["student"].email,
                "error": str(exc),
            })

    results["notifications_sent"] = notification_success
    results["notification_failures"] = notification_failures

    return results
