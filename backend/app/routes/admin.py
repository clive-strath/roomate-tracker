import csv
import io
import mimetypes
import os

from flask import Blueprint, request, jsonify, Response, current_app, send_file
from flask_jwt_extended import get_jwt_identity
from sqlalchemy import asc, desc
from sqlalchemy.orm import aliased

from ..extensions import db, bcrypt
from ..models import (
    AdminUser,
    CompatibilityScore,
    Student,
    StudentPreference,
    StayDateChangeRequest,
    Room,
    RoomAssignment,
    ConflictLog,
)
from . import role_required
from ..services.allocation_service import generate_allocation_preview, confirm_allocation
from ..services.compatibility_engine import calculate_compatibility, is_flagged
from ..services.compatibility_scores_service import refresh_compatibility_scores_for_student
from ..security import validate_password_policy

admin_bp = Blueprint("admin", __name__)


def _resolve_backend_upload_abs_path(stored_path):
    if not stored_path:
        return None

    backend_root = os.path.abspath(os.path.join(current_app.root_path, ".."))
    absolute_path = os.path.abspath(os.path.join(backend_root, stored_path))
    if not absolute_path.startswith(backend_root + os.sep):
        return None
    if not os.path.isfile(absolute_path):
        return None
    return absolute_path


def _build_doc_meta(path_value):
    absolute_path = _resolve_backend_upload_abs_path(path_value)
    if not absolute_path:
        return {
            "available": False,
            "filename": None,
            "mime_type": None,
            "size_bytes": None,
        }

    guessed_type = mimetypes.guess_type(absolute_path)[0] or "application/octet-stream"
    return {
        "available": True,
        "filename": os.path.basename(absolute_path),
        "mime_type": guessed_type,
        "size_bytes": os.path.getsize(absolute_path),
    }


@admin_bp.route("/students/<int:student_id>/compatibility/refresh", methods=["POST"])
@role_required("admin")
def refresh_student_compatibility(student_id):
    Student.query.get_or_404(student_id)
    touched = refresh_compatibility_scores_for_student(student_id)
    return jsonify({"message": "Compatibility scores refreshed", "rows_touched": touched}), 200


@admin_bp.route("/students/<int:student_id>/compatibility/scores", methods=["GET"])
@role_required("admin")
def student_compatibility_scores(student_id):
    Student.query.get_or_404(student_id)
    try:
        limit = int(request.args.get("limit", 25))
    except ValueError:
        return jsonify({"error": "limit must be an integer"}), 400
    limit = max(1, min(limit, 200))

    include_blocked = (request.args.get("include_blocked") or "true").lower() == "true"
    q = CompatibilityScore.query.filter_by(student_id=student_id)
    if not include_blocked:
        q = q.filter(CompatibilityScore.is_hard_blocked.is_(False))

    rows = q.order_by(CompatibilityScore.score.desc(), CompatibilityScore.computed_at.desc()).limit(limit).all()
    return jsonify({
        "scores": [
            {
                "candidate_id": r.candidate_id,
                "score": float(r.score),
                "is_hard_blocked": r.is_hard_blocked,
                "block_reason": r.block_reason,
                "computed_at": r.computed_at.isoformat() if r.computed_at else None,
            }
            for r in rows
        ]
    }), 200


@admin_bp.route("/students/<int:student_id>/compatibility/block-summary", methods=["GET"])
@role_required("admin")
def student_compatibility_block_summary(student_id):
    Student.query.get_or_404(student_id)
    rows = CompatibilityScore.query.filter_by(student_id=student_id).all()

    by_reason = {}
    blocked = 0
    for row in rows:
        if not row.is_hard_blocked:
            continue
        blocked += 1
        reason = row.block_reason or "unknown"
        by_reason[reason] = by_reason.get(reason, 0) + 1

    total = len(rows)
    return jsonify({
        "student_id": student_id,
        "total_candidates": total,
        "blocked_candidates": blocked,
        "eligible_candidates": max(0, total - blocked),
        "by_reason": by_reason,
    }), 200


@admin_bp.route("/students/<int:student_id>/compatibility/summary", methods=["GET"])
@role_required("admin")
def student_compatibility_summary(student_id):
    student = Student.query.get_or_404(student_id)
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
    for row in rows:
        if row.is_hard_blocked:
            continue
        score = float(row.score) if row.score is not None else 0.0
        if top_score is None or score > top_score:
            top_score = score

    return jsonify({
        "student_id": student_id,
        "student_name": student.name,
        "student_email": student.email,
        "email_verified": bool(student.email_verified),
        "verification_status": student.verification_status,
        "is_matching_eligible": (
            student.status == "active"
            and bool(student.email_verified)
            and student.verification_status == "approved"
            and student.preferences is not None
        ),
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


@admin_bp.route("/students/verification/pending", methods=["GET"])
@role_required("admin")
def pending_student_verifications():
    page, per_page, pagination_error = _parse_pagination_params(default_per_page=20, max_per_page=100)
    if pagination_error:
        return pagination_error

    q = Student.query.filter(Student.verification_status == "pending").order_by(desc(Student.created_at))
    pagination = q.paginate(page=page, per_page=per_page, error_out=False)

    students = []
    for s in pagination.items:
        row = s.to_dict()
        row["verification_document_path"] = s.verification_document_path
        row["has_profile_photo"] = bool(s.profile_photo_path)
        row["has_verification_document"] = bool(s.verification_document_path)
        students.append(row)

    return jsonify({
        "students": students,
        "total": pagination.total,
        "page": pagination.page,
        "per_page": pagination.per_page,
        "total_pages": pagination.pages,
    }), 200


@admin_bp.route("/students/<int:student_id>/verification-documents", methods=["GET"])
@role_required("admin")
def student_verification_documents(student_id):
    student = Student.query.get_or_404(student_id)
    return jsonify({
        "student_id": student.student_id,
        "name": student.name,
        "student_number": student.student_number,
        "email": student.email,
        "email_verified": bool(student.email_verified),
        "verification_status": student.verification_status,
        "profile_photo": _build_doc_meta(student.profile_photo_path),
        "verification_document": _build_doc_meta(student.verification_document_path),
    }), 200


@admin_bp.route("/students/<int:student_id>/verification-documents/<string:doc_type>", methods=["GET"])
@role_required("admin")
def stream_student_verification_document(student_id, doc_type):
    student = Student.query.get_or_404(student_id)

    if doc_type == "profile-photo":
        path_value = student.profile_photo_path
    elif doc_type == "verification-document":
        path_value = student.verification_document_path
    else:
        return jsonify({"error": "Unsupported document type"}), 400

    absolute_path = _resolve_backend_upload_abs_path(path_value)
    if not absolute_path:
        return jsonify({"error": "Document not found"}), 404

    mime_type = mimetypes.guess_type(absolute_path)[0] or "application/octet-stream"
    return send_file(absolute_path, mimetype=mime_type, as_attachment=False)


@admin_bp.route("/students/<int:student_id>/verification", methods=["PATCH"])
@role_required("admin")
def review_student_verification(student_id):
    admin_id = int(get_jwt_identity())
    student = Student.query.get_or_404(student_id)
    data = request.get_json(silent=True) or {}

    action = (data.get("action") or "").strip().lower()
    note = data.get("note")
    if action not in {"approve", "reject"}:
        return jsonify({"error": "action must be approve or reject"}), 400

    student.verification_status = "approved" if action == "approve" else "rejected"
    student.verified_by = admin_id
    student.verified_at = db.func.now()
    student.verification_note = note or None
    db.session.commit()
    refresh_compatibility_scores_for_student(student.student_id)

    return jsonify({"message": f"Student verification {student.verification_status}", "student": student.to_dict()}), 200


@admin_bp.route("/stay-date-requests", methods=["GET"])
@role_required("admin")
def list_stay_date_requests():
    page, per_page, pagination_error = _parse_pagination_params(default_per_page=20, max_per_page=100)
    if pagination_error:
        return pagination_error

    status_filter = (request.args.get("status") or "pending").strip().lower()
    q = StayDateChangeRequest.query
    if status_filter in {"pending", "approved", "rejected"}:
        q = q.filter(StayDateChangeRequest.status == status_filter)
    q = q.order_by(desc(StayDateChangeRequest.created_at))

    pagination = q.paginate(page=page, per_page=per_page, error_out=False)
    rows = []
    for r in pagination.items:
        student = Student.query.get(r.student_id)
        rows.append({
            "request_id": r.request_id,
            "student_id": r.student_id,
            "student_name": student.name if student else None,
            "student_number": student.student_number if student else None,
            "requested_start": r.requested_start.isoformat() if r.requested_start else None,
            "requested_end": r.requested_end.isoformat() if r.requested_end else None,
            "reason": r.reason,
            "status": r.status,
            "admin_note": r.admin_note,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        })

    return jsonify({
        "requests": rows,
        "total": pagination.total,
        "page": pagination.page,
        "per_page": pagination.per_page,
        "total_pages": pagination.pages,
    }), 200


@admin_bp.route("/stay-date-requests/<int:request_id>/review", methods=["PATCH"])
@role_required("admin")
def review_stay_date_request(request_id):
    admin_id = int(get_jwt_identity())
    req = StayDateChangeRequest.query.get_or_404(request_id)
    data = request.get_json(silent=True) or {}

    action = (data.get("action") or "").strip().lower()
    note = data.get("admin_note")
    if action not in {"approve", "reject"}:
        return jsonify({"error": "action must be approve or reject"}), 400
    if req.status != "pending":
        return jsonify({"error": "Only pending requests can be reviewed"}), 409

    req.status = "approved" if action == "approve" else "rejected"
    req.admin_note = note or None
    req.reviewed_by = admin_id
    req.reviewed_at = db.func.now()

    if req.status == "approved":
        student = Student.query.get(req.student_id)
        if student:
            student.expected_start_date = req.requested_start
            student.expected_end_date = req.requested_end

    db.session.commit()
    if req.status == "approved":
        refresh_compatibility_scores_for_student(req.student_id)
    return jsonify({"message": f"Request {req.status}", "request_id": req.request_id}), 200


def _parse_pagination_params(default_per_page=20, max_per_page=100):
    try:
        page = int(request.args.get("page", 1))
        per_page = int(request.args.get("per_page", default_per_page))
    except ValueError:
        return None, None, (jsonify({"error": "page and per_page must be integers"}), 400)

    if page < 1:
        page = 1
    if per_page < 1:
        per_page = default_per_page
    if per_page > max_per_page:
        per_page = max_per_page

    return page, per_page, None


def _build_students_query():
    q = Student.query.outerjoin(StudentPreference, StudentPreference.student_id == Student.student_id)

    search = (request.args.get("search") or "").strip().lower()
    gender = (request.args.get("gender") or "").strip().lower()
    year = (request.args.get("year") or "").strip()
    preferences_status = (request.args.get("preferences_status") or "").strip().lower()
    account_status = (request.args.get("status") or "active").strip().lower()

    if account_status:
        q = q.filter(Student.status == account_status)

    if search:
        term = f"%{search}%"
        q = q.filter(
            db.or_(
                db.func.lower(Student.name).like(term),
                db.func.lower(Student.student_number).like(term),
                db.func.lower(Student.email).like(term),
            )
        )

    if gender:
        q = q.filter(Student.gender == gender)

    if year:
        try:
            q = q.filter(Student.year == int(year))
        except ValueError:
            return None, (jsonify({"error": "year must be an integer"}), 400)

    if preferences_status == "submitted":
        q = q.filter(StudentPreference.preference_id.isnot(None))
    elif preferences_status == "not_submitted":
        q = q.filter(StudentPreference.preference_id.is_(None))

    sort_by = (request.args.get("sort_by") or "created_at").strip()
    sort_order = (request.args.get("sort_order") or "desc").strip().lower()

    sort_columns = {
        "created_at": Student.created_at,
        "name": Student.name,
        "year": Student.year,
        "student_number": Student.student_number,
    }
    sort_col = sort_columns.get(sort_by, Student.created_at)
    order_func = asc if sort_order == "asc" else desc

    q = q.order_by(order_func(sort_col), desc(Student.student_id))
    return q, None


def _build_assignments_query(semester):
    status_filter = (request.args.get("status") or "").strip().lower()
    block_filter = (request.args.get("hostel_block") or "").strip().upper()
    search = (request.args.get("search") or "").strip().lower()

    student1 = aliased(Student)
    student2 = aliased(Student)

    assignments_query = RoomAssignment.query \
        .join(Room, Room.room_id == RoomAssignment.room_id) \
        .outerjoin(student1, student1.student_id == RoomAssignment.student_id_1) \
        .outerjoin(student2, student2.student_id == RoomAssignment.student_id_2) \
        .filter(RoomAssignment.semester == semester)

    if status_filter and status_filter != "all":
        assignments_query = assignments_query.filter(RoomAssignment.status == status_filter)
    else:
        assignments_query = assignments_query.filter(
            RoomAssignment.status.in_(["active", "awaiting_roommate"])
        )

    if block_filter:
        assignments_query = assignments_query.filter(Room.hostel_block == block_filter)

    if search:
        term = f"%{search}%"
        assignments_query = assignments_query.filter(
            db.or_(
                db.func.lower(Room.room_number).like(term),
                db.func.lower(student1.name).like(term),
                db.func.lower(student2.name).like(term),
                db.func.lower(student1.student_number).like(term),
                db.func.lower(student2.student_number).like(term),
            )
        )

    sort_by = (request.args.get("sort_by") or "created_at").strip().lower()
    sort_order = (request.args.get("sort_order") or "desc").strip().lower()

    sort_columns = {
        "created_at": RoomAssignment.created_at,
        "score": RoomAssignment.compatibility_score,
        "room_number": Room.room_number,
    }
    sort_col = sort_columns.get(sort_by, RoomAssignment.created_at)
    order_func = asc if sort_order == "asc" else desc

    assignments_query = assignments_query.order_by(order_func(sort_col), desc(RoomAssignment.assignment_id))
    return assignments_query


# ── CREATE STAFF ACCOUNT (admin or resident_advisor) ─────────────────────────
@admin_bp.route("/users", methods=["POST"])
@role_required("admin")
def create_staff_account():
    data     = request.get_json()
    admin_id = int(get_jwt_identity())

    required = ["name", "email", "password", "role"]
    missing  = [f for f in required if not data.get(f)]
    if missing:
        return jsonify({"error": f"Missing: {', '.join(missing)}"}), 400

    if data["role"] not in ("admin", "resident_advisor"):
        return jsonify({"error": "Role must be admin or resident_advisor"}), 400

    if data["role"] == "resident_advisor" and not data.get("hostel_block"):
        return jsonify({"error": "hostel_block is required for Resident Advisors"}), 400

    if AdminUser.query.filter_by(email=data["email"]).first():
        return jsonify({"error": "Email already registered"}), 409

    password_errors = validate_password_policy(data["password"])
    if password_errors:
        return jsonify({"error": " ; ".join(password_errors)}), 400

    hashed = bcrypt.generate_password_hash(data["password"]).decode("utf-8")

    user = AdminUser(
        name         = data["name"].strip(),
        email        = data["email"].strip().lower(),
        password     = hashed,
        role         = data["role"],
        hostel_block = data.get("hostel_block"),
        created_by   = admin_id,
        status       = "active",
    )
    db.session.add(user)
    db.session.commit()

    return jsonify({
        "message": f"{data['role']} account created",
        "user":    user.to_dict(),
    }), 201


# ── GET ALL STUDENTS (with preference status) ─────────────────────────────────
@admin_bp.route("/students", methods=["GET"])
@role_required("admin", "resident_advisor")
def get_all_students():
    semester = request.args.get("semester")
    page, per_page, pagination_error = _parse_pagination_params(default_per_page=20, max_per_page=100)
    if pagination_error:
        return pagination_error

    students_query, query_error = _build_students_query()
    if query_error:
        return query_error

    pagination = students_query.paginate(page=page, per_page=per_page, error_out=False)
    students = pagination.items

    assignment_map = {}
    if semester:
        student_ids = [s.student_id for s in students]
        assignments = RoomAssignment.query.filter(
            RoomAssignment.semester == semester,
            RoomAssignment.status.in_(["active", "awaiting_roommate"]),
            db.or_(
                RoomAssignment.student_id_1.in_(student_ids),
                RoomAssignment.student_id_2.in_(student_ids),
            ),
        ).all()

        for assignment in assignments:
            room = Room.query.get(assignment.room_id)
            payload = {
                "assignment_id": assignment.assignment_id,
                "semester": assignment.semester,
                "status": assignment.status,
                "room_id": assignment.room_id,
                "room_number": room.room_number if room else None,
                "hostel_block": room.hostel_block if room else None,
            }
            assignment_map[assignment.student_id_1] = payload
            if assignment.student_id_2:
                assignment_map[assignment.student_id_2] = payload

    result = []
    for s in students:
        d = s.to_dict()
        d["preferences_status"] = "submitted" if s.preferences else "not_submitted"
        d["assignment"] = assignment_map.get(s.student_id)
        result.append(d)

    return jsonify({
        "students":      result,
        "total":         pagination.total,
        "submitted":     sum(1 for s in result if s["preferences_status"] == "submitted"),
        "not_submitted": sum(1 for s in result if s["preferences_status"] == "not_submitted"),
        "page":          pagination.page,
        "per_page":      pagination.per_page,
        "total_pages":   pagination.pages,
        "has_next":      pagination.has_next,
        "has_prev":      pagination.has_prev,
    }), 200


@admin_bp.route("/allocation/assignments", methods=["GET"])
@role_required("admin")
def allocation_assignments():
    semester = request.args.get("semester")
    if not semester:
        return jsonify({"error": "Semester parameter is required"}), 400

    page, per_page, pagination_error = _parse_pagination_params(default_per_page=20, max_per_page=100)
    if pagination_error:
        return pagination_error

    assignments_query = _build_assignments_query(semester)
    pagination = assignments_query.paginate(page=page, per_page=per_page, error_out=False)

    assignments = pagination.items

    rows = []
    for assignment in assignments:
        room = Room.query.get(assignment.room_id)
        s1 = Student.query.get(assignment.student_id_1)
        s2 = Student.query.get(assignment.student_id_2) if assignment.student_id_2 else None

        rows.append({
            "assignment_id": assignment.assignment_id,
            "semester": assignment.semester,
            "status": assignment.status,
            "compatibility_score": assignment.compatibility_score,
            "is_flagged": assignment.is_flagged,
            "room_id": assignment.room_id,
            "room_number": room.room_number if room else None,
            "hostel_block": room.hostel_block if room else None,
            "student_1": s1.to_dict() if s1 else None,
            "student_2": s2.to_dict() if s2 else None,
        })

    return jsonify({
        "assignments": rows,
        "total": pagination.total,
        "page": pagination.page,
        "per_page": pagination.per_page,
        "total_pages": pagination.pages,
        "has_next": pagination.has_next,
        "has_prev": pagination.has_prev,
    }), 200


@admin_bp.route("/reports/students.csv", methods=["GET"])
@role_required("admin")
def export_students_report_csv():
    semester = request.args.get("semester")

    students_query, query_error = _build_students_query()
    if query_error:
        return query_error

    students = students_query.all()
    student_ids = [s.student_id for s in students]

    assignment_map = {}
    if semester and student_ids:
        assignments = RoomAssignment.query.filter(
            RoomAssignment.semester == semester,
            RoomAssignment.status.in_(["active", "awaiting_roommate"]),
            db.or_(
                RoomAssignment.student_id_1.in_(student_ids),
                RoomAssignment.student_id_2.in_(student_ids),
            ),
        ).all()

        for assignment in assignments:
            room = Room.query.get(assignment.room_id)
            payload = {
                "room_number": room.room_number if room else "",
                "hostel_block": room.hostel_block if room else "",
                "assignment_status": assignment.status,
                "semester": assignment.semester,
            }
            assignment_map[assignment.student_id_1] = payload
            if assignment.student_id_2:
                assignment_map[assignment.student_id_2] = payload

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "student_id",
        "name",
        "email",
        "student_number",
        "year",
        "gender",
        "account_status",
        "preferences_status",
        "assignment_status",
        "room_number",
        "hostel_block",
        "semester",
        "registered_at",
    ])

    for student in students:
        assignment = assignment_map.get(student.student_id, {})
        writer.writerow([
            student.student_id,
            student.name,
            student.email,
            student.student_number,
            student.year,
            student.gender,
            student.status,
            "submitted" if student.preferences else "not_submitted",
            assignment.get("assignment_status", "unassigned"),
            assignment.get("room_number", ""),
            assignment.get("hostel_block", ""),
            assignment.get("semester", semester or ""),
            student.created_at.isoformat() if student.created_at else "",
        ])

    csv_data = output.getvalue()
    output.close()

    return Response(
        csv_data,
        mimetype="text/csv",
        headers={
            "Content-Disposition": "attachment; filename=students_report.csv",
            "Cache-Control": "no-store",
        },
    )


@admin_bp.route("/reports/assignments-summary.csv", methods=["GET"])
@role_required("admin")
def export_assignments_summary_report_csv():
    semester = request.args.get("semester")
    if not semester:
        return jsonify({"error": "Semester parameter is required"}), 400

    assignments_query = _build_assignments_query(semester)
    assignments = assignments_query.all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "assignment_id",
        "semester",
        "assignment_status",
        "assignment_type",
        "compatibility_score",
        "is_flagged",
        "room_id",
        "room_number",
        "hostel_block",
        "student_1_id",
        "student_1_name",
        "student_1_number",
        "student_2_id",
        "student_2_name",
        "student_2_number",
        "assigned_at",
        "conflicts_count",
        "conflict_ids",
        "conflict_types",
        "conflict_severities",
        "conflict_statuses",
        "conflict_summary",
    ])

    for assignment in assignments:
        room = Room.query.get(assignment.room_id)
        student_1 = Student.query.get(assignment.student_id_1)
        student_2 = Student.query.get(assignment.student_id_2) if assignment.student_id_2 else None
        conflicts = ConflictLog.query.filter_by(assignment_id=assignment.assignment_id) \
            .order_by(desc(ConflictLog.created_at)) \
            .all()

        conflict_ids = "; ".join(str(c.conflict_id) for c in conflicts)
        conflict_types = "; ".join(str(c.conflict_type or "") for c in conflicts)
        conflict_severities = "; ".join(str(c.severity) for c in conflicts)
        conflict_statuses = "; ".join(str(c.status or "") for c in conflicts)
        conflict_summary = " | ".join(
            f"#{c.conflict_id} [{c.status}] ({c.conflict_type}/sev{c.severity}): {str(c.description or '').strip()}"
            for c in conflicts
        )

        writer.writerow([
            assignment.assignment_id,
            assignment.semester,
            assignment.status,
            assignment.assignment_type,
            assignment.compatibility_score,
            assignment.is_flagged,
            assignment.room_id,
            room.room_number if room else "",
            room.hostel_block if room else "",
            assignment.student_id_1,
            student_1.name if student_1 else "",
            student_1.student_number if student_1 else "",
            assignment.student_id_2 or "",
            student_2.name if student_2 else "",
            student_2.student_number if student_2 else "",
            assignment.created_at.isoformat() if assignment.created_at else "",
            len(conflicts),
            conflict_ids,
            conflict_types,
            conflict_severities,
            conflict_statuses,
            conflict_summary,
        ])

    csv_data = output.getvalue()
    output.close()

    return Response(
        csv_data,
        mimetype="text/csv",
        headers={
            "Content-Disposition": "attachment; filename=assignments_summary_report.csv",
            "Cache-Control": "no-store",
        },
    )


@admin_bp.route("/allocation/assignments/<int:assignment_id>/undo", methods=["PATCH"])
@role_required("admin")
def undo_allocation_assignment(assignment_id):
    assignment = RoomAssignment.query.get_or_404(assignment_id)

    if assignment.status not in ("active", "awaiting_roommate"):
        return jsonify({"error": "Only active assignments can be undone"}), 400

    # Preserve conflict history integrity; conflicts reference assignments with RESTRICT.
    linked_conflicts = ConflictLog.query.filter_by(assignment_id=assignment.assignment_id).count()
    if linked_conflicts > 0:
        return jsonify({
            "error": "Cannot delete assignment with linked conflict records. Resolve/disable conflicts first."
        }), 400

    room = Room.query.get(assignment.room_id)
    if room and room.status != "maintenance":
        room.status = "empty"

    student_ids = [assignment.student_id_1]
    if assignment.student_id_2:
        student_ids.append(assignment.student_id_2)

    for sid in student_ids:
        pref = StudentPreference.query.filter_by(student_id=sid).first()
        if pref:
            pref.is_locked = False

    db.session.delete(assignment)
    db.session.commit()

    return jsonify({
        "message": "Assignment deleted successfully",
        "assignment_id": assignment_id,
        "room_id": assignment.room_id,
        "room_status": room.status if room else None,
    }), 200


# ── DISABLE STUDENT ACCOUNT ────────────────────────────────────────────────────
@admin_bp.route("/students/<int:student_id>/disable", methods=["PATCH"])
@role_required("admin")
def disable_student(student_id):
    student = Student.query.get_or_404(student_id)
    student.status = "inactive"
    db.session.commit()
    return jsonify({"message": f"Student {student.name} account deactivated"}), 200


# ── ALLOCATION PREVIEW ──────────────────────────────────────────────────────────
@admin_bp.route("/allocation/preview", methods=["GET"])
@role_required("admin")
def allocation_preview():
    semester = request.args.get("semester")
    if not semester:
        return jsonify({"error": "Semester parameter is required"}), 400
    
    try:
        preview = generate_allocation_preview(semester)
        return jsonify(preview), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ── ROOM AVAILABILITY SUMMARY ─────────────────────────────────────────────────
@admin_bp.route("/allocation/rooms-summary", methods=["GET"])
@role_required("admin")
def allocation_rooms_summary():
    try:
        status_rows = db.session.query(
            Room.status,
            db.func.count(Room.room_id)
        ).group_by(Room.status).all()

        by_status = {status: count for status, count in status_rows}
        empty_rooms = by_status.get("empty", 0)

        return jsonify({
            "empty_rooms": empty_rooms,
            "by_status": by_status,
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ── ALLOCATION CONFIRM ──────────────────────────────────────────────────────────
@admin_bp.route("/allocation/confirm", methods=["POST"])
@role_required("admin")
def allocation_confirm():
    data = request.get_json()
    if not data:
        return jsonify({"error": "Request body is required"}), 400
        
    semester = data.get("semester")
    confirmed_pairs = data.get("confirmed_pairs")
    confirmed_singles = data.get("confirmed_singles")
    
    if not semester:
        return jsonify({"error": "Semester is required"}), 400
    if confirmed_pairs is None or confirmed_singles is None:
        return jsonify({"error": "confirmed_pairs and confirmed_singles are required"}), 400
        
    admin_id = int(get_jwt_identity())
    
    try:
        results = confirm_allocation(semester, admin_id, confirmed_pairs, confirmed_singles)
        return jsonify(results), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


# ── ALLOCATION OVERRIDE MATCH ───────────────────────────────────────────────────
@admin_bp.route("/allocation/override", methods=["POST"])
@role_required("admin")
def allocation_override():
    """
    Admin manually replaces a suggested pair with a new pairing.
    Expects: { semester, student_id_1, student_id_2 }
    Returns recalculated compatibility for the new pair.
    """
    data = request.get_json()
    if not data:
        return jsonify({"error": "Request body is required"}), 400
        
    semester = data.get("semester")
    student_id_1 = data.get("student_id_1")
    student_id_2 = data.get("student_id_2")
    
    if not semester or not student_id_1 or not student_id_2:
        return jsonify({"error": "semester, student_id_1, and student_id_2 are required"}), 400
    
    if student_id_1 == student_id_2:
        return jsonify({"error": "Cannot pair a student with themselves"}), 400
    
    try:
        # Get both students' preferences
        student1 = Student.query.get_or_404(student_id_1)
        student2 = Student.query.get_or_404(student_id_2)
        
        if not student1.preferences or not student2.preferences:
            return jsonify({"error": "Both students must have submitted preferences"}), 400
        
        if student1.gender != student2.gender:
            return jsonify({"error": "Gender mismatch - cross-gender pairing not allowed"}), 400
        
        # Check if either student is already assigned in this semester
        existing = RoomAssignment.query.filter(
            RoomAssignment.semester == semester,
            RoomAssignment.status.in_(["active", "awaiting_roommate"]),
            db.or_(
                RoomAssignment.student_id_1 == student_id_1,
                RoomAssignment.student_id_2 == student_id_1,
                RoomAssignment.student_id_1 == student_id_2,
                RoomAssignment.student_id_2 == student_id_2
            )
        ).first()
        
        if existing:
            return jsonify({"error": "One or both students already assigned for this semester"}), 400
        
        # Calculate new compatibility
        score, breakdown = calculate_compatibility(student1.preferences, student2.preferences)
        flagged = is_flagged(score)
        
        return jsonify({
            "student_id_1": student_id_1,
            "student_id_2": student_id_2,
            "student_1_name": student1.name,
            "student_2_name": student2.name,
            "score": score,
            "breakdown": breakdown,
            "is_flagged": flagged,
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ── INDIVIDUAL APPROVE PAIR ─────────────────────────────────────────────────────
@admin_bp.route("/allocation/approve-pair", methods=["POST"])
@role_required("admin")
def approve_pair():
    """
    Approve a single pair for room assignment.
    Expects: { semester, student_id_1, student_id_2, score, breakdown, joins_existing_room }
    """
    data = request.get_json()
    if not data:
        return jsonify({"error": "Request body is required"}), 400
        
    semester = data.get("semester")
    student_id_1 = data.get("student_id_1")
    student_id_2 = data.get("student_id_2")
    score = data.get("score")
    breakdown = data.get("breakdown")
    joins_existing_room = data.get("joins_existing_room", False)
    
    if not all([semester, student_id_1, student_id_2, score is not None]):
        return jsonify({"error": "semester, student_id_1, student_id_2, and score are required"}), 400
        
    admin_id = int(get_jwt_identity())
    
    confirmed_pairs = [{
        "student_id_1": student_id_1,
        "student_id_2": student_id_2,
        "score": score,
        "breakdown": breakdown,
        "joins_existing_room": joins_existing_room
    }]
    
    try:
        results = confirm_allocation(semester, admin_id, confirmed_pairs, [])
        return jsonify(results), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


# ── INDIVIDUAL REJECT PAIR ──────────────────────────────────────────────────────
@admin_bp.route("/allocation/reject-pair", methods=["POST"])
@role_required("admin")
def reject_pair():
    """
    Reject a suggested pair - no action needed, just returns success.
    The pair will not be included in confirmed_pairs during final confirmation.
    """
    data = request.get_json()
    if not data:
        return jsonify({"error": "Request body is required"}), 400
    
    # Just return success - frontend handles removal from confirmed list
    return jsonify({"message": "Pair rejected", "student_id_1": data.get("student_id_1"), "student_id_2": data.get("student_id_2")}), 200


# ── BULK APPROVE ALL ────────────────────────────────────────────────────────────
@admin_bp.route("/allocation/approve-all", methods=["POST"])
@role_required("admin")
def approve_all():
    """
    Bulk approve all suggested pairs.
    Expects: { semester, pairs, singles }
    """
    data = request.get_json()
    if not data:
        return jsonify({"error": "Request body is required"}), 400
        
    semester = data.get("semester")
    pairs = data.get("pairs")
    singles = data.get("singles", [])
    
    if not semester or pairs is None:
        return jsonify({"error": "semester and pairs array are required"}), 400
        
    admin_id = int(get_jwt_identity())
    
    # Transform pairs to confirmed format
    confirmed_pairs = []
    for pair in pairs:
        confirmed_pairs.append({
            "student_id_1": pair.get("student_id_1"),
            "student_id_2": pair.get("student_id_2"),
            "score": pair.get("score"),
            "breakdown": pair.get("breakdown"),
            "joins_existing_room": pair.get("joins_existing_room", False)
        })
    
    try:
        results = confirm_allocation(semester, admin_id, confirmed_pairs, singles)
        return jsonify(results), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


# ── BULK REJECT ALL ─────────────────────────────────────────────────────────────
@admin_bp.route("/allocation/reject-all", methods=["POST"])
@role_required("admin")
def reject_all():
    """
    Reject all suggested pairs - no database changes, just returns success.
    Frontend clears the confirmed list.
    """
    return jsonify({"message": "All pairs rejected"}), 200

