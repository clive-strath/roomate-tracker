from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from ..extensions import db
from ..models import Student, RoomAssignment, Room

students_bp = Blueprint("students", __name__)


@students_bp.route("/<int:student_id>", methods=["GET"])
@jwt_required()
def get_student(student_id):
    claims      = get_jwt()
    role        = claims.get("role")
    current_uid = int(get_jwt_identity())

    # Students can only view their own profile
    if role == "student" and current_uid != student_id:
        return jsonify({"error": "Access denied"}), 403

    student = Student.query.get_or_404(student_id)
    return jsonify(student.to_dict()), 200


@students_bp.route("/<int:student_id>/assignment", methods=["GET"])
@jwt_required()
def get_student_assignment(student_id):
    claims = get_jwt()
    role = claims.get("role")
    current_uid = int(get_jwt_identity())

    if role == "student" and current_uid != student_id:
        return jsonify({"error": "Access denied"}), 403

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
