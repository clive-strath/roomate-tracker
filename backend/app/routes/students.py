import os
import uuid

from flask import Blueprint, jsonify, request, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from werkzeug.utils import secure_filename
from ..extensions import db
from ..models import (
    Student,
    StudentAllergy,
    CompatibilityScore,
    PreferredRoommate,
    StayDateChangeRequest,
    RoomAssignment,
    Room,
)
from ..services.compatibility_scores_service import refresh_compatibility_scores_for_student
from ..services.compatibility_engine import calculate_compatibility, get_reason_tags

students_bp = Blueprint("students", __name__)

ALLOWED_IMAGE_EXTENSIONS = {"png", "jpg", "jpeg", "webp"}
ALLOWED_DOC_EXTENSIONS = {"png", "jpg", "jpeg", "webp", "pdf"}


def _require_student_identity(student_id):
    claims = get_jwt()
    role = claims.get("role")
    current_uid = int(get_jwt_identity())

    if role == "student" and current_uid != student_id:
        return None, (jsonify({"error": "Access denied"}), 403)
    return role, None


def _save_upload(file_storage, subdir, allowed_extensions):
    filename = secure_filename(file_storage.filename or "")
    if not filename or "." not in filename:
        return None, "Invalid file name"

    ext = filename.rsplit(".", 1)[1].lower()
    if ext not in allowed_extensions:
        return None, "Unsupported file type"

    try:
        file_storage.stream.seek(0, os.SEEK_END)
        size = file_storage.stream.tell()
        file_storage.stream.seek(0)
    except Exception:
        size = None

    max_bytes = current_app.config.get("MAX_UPLOAD_BYTES")
    if max_bytes and size and size > max_bytes:
        return None, "File exceeds maximum upload size"

    base_upload_dir = current_app.config.get("UPLOADS_DIR") or os.path.join(current_app.root_path, "..", "uploads")
    target_dir = os.path.abspath(os.path.join(base_upload_dir, subdir))
    os.makedirs(target_dir, exist_ok=True)

    stored_name = f"{uuid.uuid4().hex}.{ext}"
    full_path = os.path.join(target_dir, stored_name)
    file_storage.save(full_path)

    return os.path.relpath(full_path, start=os.path.abspath(os.path.join(current_app.root_path, ".."))), None


def _is_matching_eligible(student):
    return (
        student.status == "active"
        and bool(student.email_verified)
        and student.verification_status == "approved"
        and student.preferences is not None
    )


@students_bp.route("/<int:student_id>", methods=["GET"])
@jwt_required()
def get_student(student_id):
    _, error = _require_student_identity(student_id)
    if error:
        return error

    student = Student.query.get_or_404(student_id)
    return jsonify(student.to_dict()), 200


@students_bp.route("/<int:student_id>/assignment", methods=["GET"])
@jwt_required()
def get_student_assignment(student_id):
    _, error = _require_student_identity(student_id)
    if error:
        return error

    semester = request.args.get("semester")
    q = RoomAssignment.query.filter(
        RoomAssignment.status.in_(["active", "awaiting_roommate"]),
        db.or_(
            RoomAssignment.student_id_1 == student_id,
            RoomAssignment.student_id_2 == student_id,
        ),
    )
    if semester:
        q = q.filter(RoomAssignment.semester == semester)

    assignment = q.order_by(RoomAssignment.created_at.desc()).first()
    if not assignment:
        return jsonify({"assignment": None}), 200

    room = Room.query.get(assignment.room_id)
    roommate_id = assignment.student_id_2 if assignment.student_id_1 == student_id else assignment.student_id_1
    roommate = Student.query.get(roommate_id) if roommate_id else None

    return jsonify({
        "assignment": {
            "assignment_id": assignment.assignment_id,
            "semester": assignment.semester,
            "status": assignment.status,
            "compatibility_score": assignment.compatibility_score,
            "room_id": assignment.room_id,
            "room_number": room.room_number if room else None,
            "hostel_block": room.hostel_block if room else None,
            "roommate": roommate.to_dict() if roommate else None,
        }
    }), 200


@students_bp.route("/<int:student_id>/allergies", methods=["GET", "PUT"])
@jwt_required()
def student_allergies(student_id):
    role, error = _require_student_identity(student_id)
    if error:
        return error

    Student.query.get_or_404(student_id)
    allergy = StudentAllergy.query.filter_by(student_id=student_id).first()

    if request.method == "GET":
        if not allergy:
            return jsonify({"allergies": None}), 200
        return jsonify({
            "allergies": {
                "has_dust_mould_allergy": allergy.has_dust_mould_allergy,
                "has_fragrance_sensitivity": allergy.has_fragrance_sensitivity,
                "has_food_allergy": allergy.has_food_allergy,
                "food_allergy_detail": allergy.food_allergy_detail,
                "has_latex_allergy": allergy.has_latex_allergy,
                "has_chemical_sensitivity": allergy.has_chemical_sensitivity,
                "chemical_sensitivity_detail": allergy.chemical_sensitivity_detail,
                "has_severe_nut_allergy": allergy.has_severe_nut_allergy,
                "has_smoke_sensitivity": allergy.has_smoke_sensitivity,
                "has_asthma_or_respiratory_condition": allergy.has_asthma_or_respiratory_condition,
                "heavy_fragrance_user": allergy.heavy_fragrance_user,
                "cooks_strong_smelling_food": allergy.cooks_strong_smelling_food,
                "uses_strong_cleaning_products": allergy.uses_strong_cleaning_products,
                "stores_or_eats_nuts_in_room": allergy.stores_or_eats_nuts_in_room,
                "smoking_habit": allergy.smoking_habit,
            }
        }), 200

    if role != "student":
        return jsonify({"error": "Only students can update allergies"}), 403

    data = request.get_json(silent=True) or {}
    valid_smoking_habits = {"no", "occasionally", "frequently"}
    smoking_habit = data.get("smoking_habit", "no")
    if smoking_habit not in valid_smoking_habits:
        return jsonify({"error": "smoking_habit must be no, occasionally, or frequently"}), 400

    if not allergy:
        allergy = StudentAllergy(student_id=student_id)
        db.session.add(allergy)

    bool_fields = [
        "has_dust_mould_allergy", "has_fragrance_sensitivity", "has_food_allergy",
        "has_latex_allergy", "has_chemical_sensitivity", "has_severe_nut_allergy",
        "has_smoke_sensitivity", "has_asthma_or_respiratory_condition", "heavy_fragrance_user",
        "cooks_strong_smelling_food", "uses_strong_cleaning_products", "stores_or_eats_nuts_in_room",
    ]

    for field in bool_fields:
        if field in data:
            setattr(allergy, field, bool(data.get(field)))

    allergy.food_allergy_detail = data.get("food_allergy_detail") or None
    allergy.chemical_sensitivity_detail = data.get("chemical_sensitivity_detail") or None
    allergy.smoking_habit = smoking_habit

    db.session.commit()
    refresh_compatibility_scores_for_student(student_id)
    return jsonify({"message": "Allergy profile updated"}), 200


@students_bp.route("/<int:student_id>/preferred-roommates", methods=["GET", "PUT"])
@jwt_required()
def preferred_roommates(student_id):
    role, error = _require_student_identity(student_id)
    if error:
        return error

    Student.query.get_or_404(student_id)

    if request.method == "GET":
        rows = PreferredRoommate.query.filter_by(student_id=student_id).order_by(PreferredRoommate.created_at.asc()).all()
        result = []
        for row in rows:
            target = Student.query.get(row.preferred_student_id)
            result.append({
                "preferred_student_id": row.preferred_student_id,
                "name": target.name if target else None,
                "student_number": target.student_number if target else None,
                "profile_photo_path": target.profile_photo_path if target else None,
            })
        return jsonify({"preferred_roommates": result}), 200

    if role != "student":
        return jsonify({"error": "Only students can update preferred roommates"}), 403

    data = request.get_json(silent=True) or {}
    preferred_ids = data.get("preferred_student_ids") or []
    if not isinstance(preferred_ids, list):
        return jsonify({"error": "preferred_student_ids must be an array"}), 400
    if len(preferred_ids) > 3:
        return jsonify({"error": "You can select at most 3 preferred roommates"}), 400

    deduped = []
    seen = set()
    for sid in preferred_ids:
        try:
            sid = int(sid)
        except (TypeError, ValueError):
            return jsonify({"error": "preferred_student_ids must contain valid student IDs"}), 400
        if sid == student_id:
            return jsonify({"error": "You cannot select yourself as preferred roommate"}), 400
        if sid not in seen:
            seen.add(sid)
            deduped.append(sid)

    if deduped:
        existing = Student.query.filter(Student.student_id.in_(deduped), Student.status == "active").count()
        if existing != len(deduped):
            return jsonify({"error": "One or more preferred students are invalid"}), 400

    PreferredRoommate.query.filter_by(student_id=student_id).delete()
    for sid in deduped:
        db.session.add(PreferredRoommate(student_id=student_id, preferred_student_id=sid))

    db.session.commit()
    refresh_compatibility_scores_for_student(student_id)
    return jsonify({"message": "Preferred roommates updated", "count": len(deduped)}), 200


@students_bp.route("/<int:student_id>/compatibility-candidates", methods=["GET"])
@jwt_required()
def compatibility_candidates(student_id):
    role, error = _require_student_identity(student_id)
    if error:
        return error

    requester = Student.query.get_or_404(student_id)
    if not _is_matching_eligible(requester):
        return jsonify({"error": "Student is not eligible for matching yet"}), 403

    try:
        limit = int(request.args.get("limit", 15))
    except ValueError:
        return jsonify({"error": "limit must be an integer"}), 400
    limit = max(1, min(limit, 25))

    include_blocked = (request.args.get("include_blocked") or "false").lower() == "true"
    if role == "student":
        include_blocked = False

    q = CompatibilityScore.query.filter_by(student_id=student_id)
    if not include_blocked:
        q = q.filter(CompatibilityScore.is_hard_blocked.is_(False))

    rows = q.order_by(CompatibilityScore.score.desc(), CompatibilityScore.computed_at.desc()).limit(limit).all()
    if not rows:
        refresh_compatibility_scores_for_student(student_id)
        q2 = CompatibilityScore.query.filter_by(student_id=student_id)
        if not include_blocked:
            q2 = q2.filter(CompatibilityScore.is_hard_blocked.is_(False))
        rows = q2.order_by(CompatibilityScore.score.desc(), CompatibilityScore.computed_at.desc()).limit(limit).all()

    year_filter = request.args.get("year")
    result = []
    for row in rows:
        candidate = Student.query.get(row.candidate_id)
        if not candidate:
            continue
        if not _is_matching_eligible(candidate):
            continue
        if year_filter and str(candidate.year) != str(year_filter):
            continue
        if requester and candidate.gender != requester.gender:
            continue

        score = float(row.score) if row.score is not None else 0.0
        reason_tags = []
        if requester and requester.preferences and candidate.preferences and not row.is_hard_blocked:
            _, breakdown = calculate_compatibility(requester.preferences, candidate.preferences)
            reason_tags = get_reason_tags(breakdown)

        result.append({
            "candidate_student_id": candidate.student_id,
            "name": candidate.name,
            "student_number": candidate.student_number,
            "year": candidate.year,
            "gender": candidate.gender,
            "profile_photo_path": candidate.profile_photo_path,
            "score": score,
            "is_hard_blocked": row.is_hard_blocked,
            "block_reason": row.block_reason if role != "student" else None,
            "reason_tags": reason_tags,
        })

    return jsonify({"candidates": result}), 200


@students_bp.route("/<int:student_id>/compatibility/refresh", methods=["POST"])
@jwt_required()
def refresh_student_compatibility_scores(student_id):
    role, error = _require_student_identity(student_id)
    if error:
        return error

    student = Student.query.get_or_404(student_id)
    if role == "student" and not _is_matching_eligible(student):
        return jsonify({"error": "Student is not eligible for matching yet"}), 403

    touched = refresh_compatibility_scores_for_student(student_id)
    return jsonify({"message": "Compatibility scores refreshed", "rows_touched": touched}), 200


@students_bp.route("/<int:student_id>/compatibility/summary", methods=["GET"])
@jwt_required()
def student_compatibility_summary(student_id):
    role, error = _require_student_identity(student_id)
    if error:
        return error

    student = Student.query.get_or_404(student_id)
    eligible = _is_matching_eligible(student)

    rows = CompatibilityScore.query.filter_by(student_id=student_id).all()
    total = len(rows)
    blocked = sum(1 for r in rows if r.is_hard_blocked)

    by_reason = {}
    for row in rows:
        if not row.is_hard_blocked:
            continue
        reason = row.block_reason or "unknown"
        by_reason[reason] = by_reason.get(reason, 0) + 1

    top_score = None
    recent = sorted(
        rows,
        key=lambda r: (r.computed_at is not None, r.computed_at),
        reverse=True,
    )
    for row in recent:
        if row.is_hard_blocked:
            continue
        score = float(row.score) if row.score is not None else 0.0
        if top_score is None or score > top_score:
            top_score = score

    return jsonify({
        "student_id": student_id,
        "role": role,
        "is_matching_eligible": eligible,
        "eligibility": {
            "status_active": student.status == "active",
            "email_verified": bool(student.email_verified),
            "verification_approved": student.verification_status == "approved",
            "has_preferences": student.preferences is not None,
        },
        "total_candidates": total,
        "blocked_candidates": blocked,
        "eligible_candidates": max(0, total - blocked),
        "top_non_blocked_score": top_score,
        "by_reason": by_reason,
    }), 200


@students_bp.route("/<int:student_id>/stay-requests", methods=["GET", "POST"])
@jwt_required()
def stay_requests(student_id):
    role, error = _require_student_identity(student_id)
    if error:
        return error

    student = Student.query.get_or_404(student_id)

    if request.method == "GET":
        rows = StayDateChangeRequest.query.filter_by(student_id=student_id).order_by(StayDateChangeRequest.created_at.desc()).all()
        return jsonify({
            "requests": [
                {
                    "request_id": r.request_id,
                    "requested_start": r.requested_start.isoformat() if r.requested_start else None,
                    "requested_end": r.requested_end.isoformat() if r.requested_end else None,
                    "reason": r.reason,
                    "status": r.status,
                    "admin_note": r.admin_note,
                    "created_at": r.created_at.isoformat() if r.created_at else None,
                }
                for r in rows
            ]
        }), 200

    if role != "student":
        return jsonify({"error": "Only students can submit stay-date requests"}), 403

    data = request.get_json(silent=True) or {}
    requested_start = data.get("requested_start")
    requested_end = data.get("requested_end")
    reason = data.get("reason")

    if not requested_start or not requested_end:
        return jsonify({"error": "requested_start and requested_end are required"}), 400

    try:
        from datetime import date

        start_date = date.fromisoformat(requested_start)
        end_date = date.fromisoformat(requested_end)
    except ValueError:
        return jsonify({"error": "Dates must use ISO format YYYY-MM-DD"}), 400

    if end_date <= start_date:
        return jsonify({"error": "requested_end must be after requested_start"}), 400

    pending_exists = StayDateChangeRequest.query.filter_by(student_id=student_id, status="pending").first()
    if pending_exists:
        return jsonify({"error": "You already have a pending stay-date request"}), 409

    req = StayDateChangeRequest(
        student_id=student.student_id,
        requested_start=start_date,
        requested_end=end_date,
        reason=reason,
        status="pending",
    )
    db.session.add(req)
    db.session.commit()

    return jsonify({"message": "Stay-date change request submitted", "request_id": req.request_id}), 201


@students_bp.route("/<int:student_id>/profile-photo", methods=["POST"])
@jwt_required()
def upload_profile_photo(student_id):
    role, error = _require_student_identity(student_id)
    if error:
        return error
    if role != "student":
        return jsonify({"error": "Only students can upload profile photos"}), 403

    student = Student.query.get_or_404(student_id)
    file = request.files.get("file")
    if not file:
        return jsonify({"error": "file is required"}), 400

    stored_path, upload_error = _save_upload(file, "profile_photos", ALLOWED_IMAGE_EXTENSIONS)
    if upload_error:
        return jsonify({"error": upload_error}), 400

    student.profile_photo_path = stored_path
    db.session.commit()
    return jsonify({"message": "Profile photo uploaded", "profile_photo_path": stored_path}), 200


@students_bp.route("/<int:student_id>/verification-document", methods=["POST"])
@jwt_required()
def upload_verification_document(student_id):
    role, error = _require_student_identity(student_id)
    if error:
        return error
    if role != "student":
        return jsonify({"error": "Only students can upload verification documents"}), 403

    student = Student.query.get_or_404(student_id)
    file = request.files.get("file")
    if not file:
        return jsonify({"error": "file is required"}), 400

    stored_path, upload_error = _save_upload(file, "verification_docs", ALLOWED_DOC_EXTENSIONS)
    if upload_error:
        return jsonify({"error": upload_error}), 400

    student.verification_document_path = stored_path
    student.verification_status = "pending"
    student.verification_note = None
    student.verified_by = None
    student.verified_at = None
    db.session.commit()
    refresh_compatibility_scores_for_student(student_id)

    return jsonify({"message": "Verification document uploaded", "verification_document_path": stored_path}), 200
