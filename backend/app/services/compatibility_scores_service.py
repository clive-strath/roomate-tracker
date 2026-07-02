from app.extensions import db
from app.models import CompatibilityScore, Student, StudentAllergy
from app.services.compatibility_engine import compute_storage_rows


def _overlaps_dates(student_a, student_b):
    start_a = student_a.expected_start_date
    end_a = student_a.expected_end_date
    start_b = student_b.expected_start_date
    end_b = student_b.expected_end_date

    # If either side has incomplete dates, do not hard-block.
    if not start_a or not end_a or not start_b or not end_b:
        return True

    return max(start_a, start_b) < min(end_a, end_b)


def refresh_compatibility_scores_for_student(student_id):
    student = Student.query.get(student_id)
    if not student or student.status != "active" or not student.preferences:
        return 0

    active_students = Student.query.filter(Student.status == "active").all()
    student_map = {s.student_id: s for s in active_students}
    student_ids = [s.student_id for s in active_students]
    allergy_rows = StudentAllergy.query.filter(StudentAllergy.student_id.in_(student_ids)).all() if student_ids else []
    allergy_map = {a.student_id: a for a in allergy_rows}

    eligible = []
    for s in active_students:
        if not s.preferences:
            continue

        eligible.append({
            "student_id": s.student_id,
            "gender": s.gender,
            "preferences": s.preferences,
            "allergies": allergy_map.get(s.student_id),
            "email_verified": s.email_verified,
            "verification_status": s.verification_status,
            "expected_start_date": s.expected_start_date,
            "expected_end_date": s.expected_end_date,
        })

    target = next((s for s in eligible if s["student_id"] == student_id), None)
    if not target:
        return 0

    rows_to_save = []
    for candidate in eligible:
        if candidate["student_id"] == student_id:
            continue

        row_a = {
            "student_id": target["student_id"],
            "gender": target["gender"],
            "preferences": target["preferences"],
            "allergies": target["allergies"],
        }
        row_b = {
            "student_id": candidate["student_id"],
            "gender": candidate["gender"],
            "preferences": candidate["preferences"],
            "allergies": candidate["allergies"],
        }

        computed = compute_storage_rows([row_a, row_b])
        for entry in computed:
            if (
                not target["email_verified"]
                or not candidate["email_verified"]
                or target.get("verification_status") != "approved"
                or candidate.get("verification_status") != "approved"
            ):
                entry["score"] = 0
                entry["is_hard_blocked"] = True
                entry["block_reason"] = "unverified"
            elif not _overlaps_dates(student, student_map.get(candidate["student_id"])):
                entry["score"] = 0
                entry["is_hard_blocked"] = True
                entry["block_reason"] = "stay_dates"
            rows_to_save.append(entry)

    touched = 0
    for row in rows_to_save:
        existing = CompatibilityScore.query.filter_by(
            student_id=row["student_id"],
            candidate_id=row["candidate_id"],
        ).first()
        if existing:
            existing.score = row["score"]
            existing.is_hard_blocked = row["is_hard_blocked"]
            existing.block_reason = row["block_reason"]
            existing.computed_at = db.func.now()
        else:
            db.session.add(CompatibilityScore(
                student_id=row["student_id"],
                candidate_id=row["candidate_id"],
                score=row["score"],
                is_hard_blocked=row["is_hard_blocked"],
                block_reason=row["block_reason"],
                computed_at=db.func.now(),
            ))
        touched += 1

    db.session.commit()
    return touched
