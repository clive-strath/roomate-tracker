from datetime import datetime, timezone

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt, get_jwt_identity, jwt_required
from sqlalchemy import asc, desc

from ..extensions import db
from ..models import AdminUser, ConflictLog, Room, RoomAssignment
from . import role_required

conflicts_bp = Blueprint("conflicts", __name__)

CONFLICT_TYPES = {
    "sleep_schedule",
    "noise",
    "cleanliness",
    "guests",
    "bathroom",
    "other",
}

RA_TRANSITIONS = {
    "open": {"in_mediation", "resolved", "escalated"},
    "in_mediation": {"resolved", "escalated"},
    "escalated": set(),
    "resolved": set(),
    "disabled": set(),
}


def now_utc():
    return datetime.now(timezone.utc)


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


def _parse_date_filter(date_value, label):
    if not date_value:
        return None, None

    try:
        parsed = datetime.strptime(date_value, "%Y-%m-%d").replace(tzinfo=timezone.utc)
        return parsed, None
    except ValueError:
        return None, (jsonify({"error": f"{label} must be in YYYY-MM-DD format"}), 400)


def _get_request_json():
    data = request.get_json(silent=True)
    return data if data else {}


def _get_current_role_and_id():
    claims = get_jwt()
    return claims.get("role"), int(get_jwt_identity())


def _active_assignment_query():
    return RoomAssignment.query.filter(RoomAssignment.status.in_(["active", "awaiting_roommate"]))


def _assignment_for_student(student_id, assignment_id=None):
    q = _active_assignment_query().filter(
        db.or_(
            RoomAssignment.student_id_1 == student_id,
            RoomAssignment.student_id_2 == student_id,
        )
    )
    if assignment_id is not None:
        q = q.filter(RoomAssignment.assignment_id == assignment_id)
        return q.first()
    return q.order_by(RoomAssignment.created_at.desc()).first()


def _ra_for_block(hostel_block):
    return AdminUser.query.filter_by(
        role="resident_advisor",
        status="active",
        hostel_block=hostel_block,
    ).order_by(AdminUser.admin_id.asc()).first()


def _get_conflict_or_404(conflict_id):
    conflict = ConflictLog.query.get_or_404(conflict_id)
    return conflict


def _can_ra_access_conflict(ra_user, conflict):
    if not ra_user or ra_user.role != "resident_advisor":
        return False
    if not conflict.assignment or not conflict.assignment.room:
        return False
    return conflict.assignment.room.hostel_block == ra_user.hostel_block


def _create_conflict(student_id, data, assignment):
    conflict_type = (data.get("conflict_type") or "").strip()
    description = (data.get("description") or "").strip()

    if conflict_type not in CONFLICT_TYPES:
        return None, (jsonify({"error": "Invalid conflict_type"}), 400)

    try:
        severity = int(data.get("severity"))
        if severity < 1 or severity > 5:
            raise ValueError
    except (TypeError, ValueError):
        return None, (jsonify({"error": "severity must be an integer between 1 and 5"}), 400)

    if not description:
        return None, (jsonify({"error": "description is required"}), 400)

    student_involved = data.get("student_involved") or student_id
    valid_students = {assignment.student_id_1, assignment.student_id_2}
    if student_involved not in valid_students:
        return None, (jsonify({"error": "student_involved must belong to the assignment"}), 400)

    room = Room.query.get(assignment.room_id)
    assigned_ra = _ra_for_block(room.hostel_block if room else None)

    conflict = ConflictLog(
        assignment_id=assignment.assignment_id,
        reported_by_student_id=student_id,
        student_involved=student_involved,
        conflict_type=conflict_type,
        severity=severity,
        description=description,
        status="open",
        handled_by_ra_id=assigned_ra.admin_id if assigned_ra else None,
    )
    db.session.add(conflict)
    db.session.commit()
    return conflict, None


@conflicts_bp.route("/conflicts", methods=["POST"])
@role_required("student")
def create_conflict_auto_assignment():
    _, student_id = _get_current_role_and_id()
    data = _get_request_json()

    assignment = _assignment_for_student(student_id)
    if not assignment:
        return jsonify({"error": "No active assignment found for this student"}), 404

    conflict, error = _create_conflict(student_id, data, assignment)
    if error:
        return error

    return jsonify({
        "message": "Conflict reported successfully",
        "conflict": conflict.to_dict(),
    }), 201


@conflicts_bp.route("/assignments/<int:assignment_id>/conflicts", methods=["POST"])
@role_required("student")
def create_conflict_for_assignment(assignment_id):
    _, student_id = _get_current_role_and_id()
    data = _get_request_json()

    assignment = _assignment_for_student(student_id, assignment_id=assignment_id)
    if not assignment:
        return jsonify({"error": "No eligible assignment found for this student"}), 404

    conflict, error = _create_conflict(student_id, data, assignment)
    if error:
        return error

    return jsonify({
        "message": "Conflict reported successfully",
        "conflict": conflict.to_dict(),
    }), 201


@conflicts_bp.route("/conflicts", methods=["GET"])
@jwt_required()
def list_conflicts():
    role, user_id = _get_current_role_and_id()
    page, per_page, pagination_error = _parse_pagination_params(default_per_page=20, max_per_page=100)
    if pagination_error:
        return pagination_error

    status_filter = request.args.get("status")
    severity_filter = request.args.get("severity")
    type_filter = request.args.get("type")
    from_date_raw = request.args.get("from_date")
    to_date_raw = request.args.get("to_date")

    from_date, from_error = _parse_date_filter(from_date_raw, "from_date")
    if from_error:
        return from_error

    to_date, to_error = _parse_date_filter(to_date_raw, "to_date")
    if to_error:
        return to_error

    q = ConflictLog.query.join(RoomAssignment, ConflictLog.assignment_id == RoomAssignment.assignment_id) \
        .join(Room, RoomAssignment.room_id == Room.room_id)

    if role == "student":
        q = q.filter(ConflictLog.reported_by_student_id == user_id)
    elif role == "resident_advisor":
        ra_user = AdminUser.query.get_or_404(user_id)
        q = q.filter(Room.hostel_block == ra_user.hostel_block)
    elif role != "admin":
        return jsonify({"error": "Access denied"}), 403

    if status_filter:
        q = q.filter(ConflictLog.status == status_filter)
    if severity_filter:
        try:
            q = q.filter(ConflictLog.severity == int(severity_filter))
        except ValueError:
            return jsonify({"error": "severity filter must be an integer"}), 400
    if type_filter:
        q = q.filter(ConflictLog.conflict_type == type_filter)

    if from_date:
        q = q.filter(ConflictLog.created_at >= from_date)
    if to_date:
        q = q.filter(ConflictLog.created_at < to_date.replace(hour=23, minute=59, second=59, microsecond=999999))

    sort_by = (request.args.get("sort_by") or "created_at").strip().lower()
    sort_order = (request.args.get("sort_order") or "desc").strip().lower()
    sort_columns = {
        "created_at": ConflictLog.created_at,
        "severity": ConflictLog.severity,
        "status": ConflictLog.status,
    }
    sort_col = sort_columns.get(sort_by, ConflictLog.created_at)
    order_func = asc if sort_order == "asc" else desc

    pagination = q.order_by(order_func(sort_col), desc(ConflictLog.conflict_id)).paginate(
        page=page,
        per_page=per_page,
        error_out=False,
    )
    conflicts = pagination.items
    return jsonify({
        "conflicts": [c.to_dict() for c in conflicts],
        "total": pagination.total,
        "page": pagination.page,
        "per_page": pagination.per_page,
        "total_pages": pagination.pages,
        "has_next": pagination.has_next,
        "has_prev": pagination.has_prev,
    }), 200


@conflicts_bp.route("/ra/conflicts", methods=["GET"])
@role_required("resident_advisor")
def list_ra_conflicts():
    ra_user = AdminUser.query.get_or_404(int(get_jwt_identity()))
    page, per_page, pagination_error = _parse_pagination_params(default_per_page=20, max_per_page=100)
    if pagination_error:
        return pagination_error

    q = ConflictLog.query.join(RoomAssignment, ConflictLog.assignment_id == RoomAssignment.assignment_id) \
        .join(Room, RoomAssignment.room_id == Room.room_id) \
        .filter(Room.hostel_block == ra_user.hostel_block)

    status_filter = request.args.get("status")
    severity_filter = request.args.get("severity")
    type_filter = request.args.get("type")
    from_date_raw = request.args.get("from_date")
    to_date_raw = request.args.get("to_date")

    from_date, from_error = _parse_date_filter(from_date_raw, "from_date")
    if from_error:
        return from_error

    to_date, to_error = _parse_date_filter(to_date_raw, "to_date")
    if to_error:
        return to_error

    if status_filter:
        q = q.filter(ConflictLog.status == status_filter)
    if severity_filter:
        try:
            q = q.filter(ConflictLog.severity == int(severity_filter))
        except ValueError:
            return jsonify({"error": "severity filter must be an integer"}), 400
    if type_filter:
        q = q.filter(ConflictLog.conflict_type == type_filter)

    if from_date:
        q = q.filter(ConflictLog.created_at >= from_date)
    if to_date:
        q = q.filter(ConflictLog.created_at < to_date.replace(hour=23, minute=59, second=59, microsecond=999999))

    sort_by = (request.args.get("sort_by") or "created_at").strip().lower()
    sort_order = (request.args.get("sort_order") or "desc").strip().lower()
    sort_columns = {
        "created_at": ConflictLog.created_at,
        "severity": ConflictLog.severity,
        "status": ConflictLog.status,
    }
    sort_col = sort_columns.get(sort_by, ConflictLog.created_at)
    order_func = asc if sort_order == "asc" else desc

    pagination = q.order_by(order_func(sort_col), desc(ConflictLog.conflict_id)).paginate(
        page=page,
        per_page=per_page,
        error_out=False,
    )
    conflicts = pagination.items
    return jsonify({
        "conflicts": [c.to_dict() for c in conflicts],
        "total": pagination.total,
        "page": pagination.page,
        "per_page": pagination.per_page,
        "total_pages": pagination.pages,
        "has_next": pagination.has_next,
        "has_prev": pagination.has_prev,
    }), 200


@conflicts_bp.route("/conflicts/<int:conflict_id>", methods=["GET"])
@jwt_required()
def get_conflict(conflict_id):
    role, user_id = _get_current_role_and_id()
    conflict = _get_conflict_or_404(conflict_id)

    if role == "student" and conflict.reported_by_student_id != user_id:
        return jsonify({"error": "Access denied"}), 403

    if role == "resident_advisor":
        ra_user = AdminUser.query.get_or_404(user_id)
        if not _can_ra_access_conflict(ra_user, conflict):
            return jsonify({"error": "Access denied"}), 403

    if role not in {"student", "resident_advisor", "admin"}:
        return jsonify({"error": "Access denied"}), 403

    return jsonify(conflict.to_dict()), 200


@conflicts_bp.route("/conflicts/<int:conflict_id>", methods=["PUT"])
@role_required("resident_advisor")
def update_conflict_ra(conflict_id):
    ra_user = AdminUser.query.get_or_404(int(get_jwt_identity()))
    conflict = _get_conflict_or_404(conflict_id)
    data = _get_request_json()

    if not _can_ra_access_conflict(ra_user, conflict):
        return jsonify({"error": "Access denied"}), 403
    if conflict.status == "disabled":
        return jsonify({"error": "Disabled conflicts cannot be modified by RA"}), 400

    next_status = data.get("status", conflict.status)
    if next_status not in RA_TRANSITIONS:
        return jsonify({"error": "Invalid status"}), 400

    if next_status != conflict.status and next_status not in RA_TRANSITIONS[conflict.status]:
        return jsonify({
            "error": f"Invalid status transition from {conflict.status} to {next_status}"
        }), 400

    mediation_notes = data.get("mediation_notes")
    actions_taken = data.get("actions_taken")
    resolution_notes = data.get("resolution_notes")
    escalation_notes = data.get("escalation_notes")

    if mediation_notes is not None:
        conflict.mediation_notes = mediation_notes
    if actions_taken is not None:
        conflict.actions_taken = actions_taken
    if resolution_notes is not None:
        conflict.resolution_notes = resolution_notes

    if next_status == "resolved":
        if not (resolution_notes or conflict.resolution_notes):
            return jsonify({"error": "resolution_notes is required when resolving"}), 400
        conflict.resolved_by = ra_user.admin_id
        conflict.resolved_at = now_utc()

    if next_status == "escalated":
        if escalation_notes is None or not str(escalation_notes).strip():
            return jsonify({"error": "escalation_notes is required when escalating"}), 400
        conflict.escalated_by = ra_user.admin_id
        conflict.escalated_at = now_utc()
        conflict.escalation_notes = escalation_notes

    conflict.handled_by_ra_id = ra_user.admin_id
    conflict.status = next_status
    db.session.commit()

    return jsonify({
        "message": "Conflict updated",
        "conflict": conflict.to_dict(),
    }), 200


@conflicts_bp.route("/conflicts/<int:conflict_id>/disable", methods=["PATCH"])
@role_required("admin")
def disable_conflict(conflict_id):
    admin_id = int(get_jwt_identity())
    data = _get_request_json()
    reason = (data.get("disable_reason") or "").strip()

    if not reason:
        return jsonify({"error": "disable_reason is required"}), 400

    conflict = _get_conflict_or_404(conflict_id)
    conflict.status = "disabled"
    conflict.disabled_by = admin_id
    conflict.disabled_at = now_utc()
    conflict.disable_reason = reason
    db.session.commit()

    return jsonify({
        "message": "Conflict disabled",
        "conflict": conflict.to_dict(),
    }), 200


@conflicts_bp.route("/conflicts/<int:conflict_id>/escalation", methods=["PUT"])
@role_required("admin")
def resolve_escalation(conflict_id):
    admin_id = int(get_jwt_identity())
    data = _get_request_json()
    conflict = _get_conflict_or_404(conflict_id)

    if conflict.status != "escalated":
        return jsonify({"error": "Only escalated conflicts can be resolved by admin"}), 400

    next_status = data.get("status", "resolved")
    if next_status != "resolved":
        return jsonify({"error": "status must be resolved"}), 400

    if data.get("actions_taken") is not None:
        conflict.actions_taken = data.get("actions_taken")
    if data.get("mediation_notes") is not None:
        conflict.mediation_notes = data.get("mediation_notes")
    if data.get("resolution_notes") is not None:
        conflict.resolution_notes = data.get("resolution_notes")

    if next_status == "resolved" and not (conflict.resolution_notes and conflict.resolution_notes.strip()):
        return jsonify({"error": "resolution_notes is required to resolve escalated conflict"}), 400

    conflict.status = next_status
    conflict.resolved_by = admin_id
    conflict.resolved_at = now_utc()

    db.session.commit()

    return jsonify({
        "message": "Escalation updated",
        "conflict": conflict.to_dict(),
    }), 200
