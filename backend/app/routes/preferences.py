from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from ..extensions import db
from ..models import StudentPreference, Student

preferences_bp = Blueprint("preferences", __name__)

VALID_STUDY_HABITS = ("quiet", "group", "flexible")


def validate_preference_data(data):
    """Returns list of error strings or empty list if valid."""
    errors = []
    int_fields = {
        "wake_time":         (1, 5),
        "sleep_time":        (1, 5),
        "noise_tolerance":   (1, 5),
        "cleanliness_level": (1, 5),
        "guest_policy":      (1, 5),
        "bathroom_schedule": (1, 3),
    }
    for field, (mn, mx) in int_fields.items():
        val = data.get(field)
        try:
            val = int(val)
            if val < mn or val > mx:
                errors.append(f"{field} must be between {mn} and {mx}")
        except (TypeError, ValueError):
            errors.append(f"{field} is required and must be a number")

    if data.get("study_habits") not in VALID_STUDY_HABITS:
        errors.append("study_habits must be quiet, group, or flexible")

    return errors


# ── SUBMIT PREFERENCES ────────────────────────────────────────────────────────
@preferences_bp.route("/", methods=["POST"])
@jwt_required()
def submit_preferences():
    claims      = get_jwt()
    role        = claims.get("role")
    student_id  = int(get_jwt_identity())

    if role != "student":
        return jsonify({"error": "Only students can submit preferences"}), 403

    # Check student exists
    student = Student.query.get_or_404(student_id)

    # Check if preferences already exist
    if student.preferences:
        if student.preferences.is_locked:
            return jsonify({"error": "Preferences are locked for this semester"}), 403
        # If exists and not locked, update instead
        return update_preferences(student_id)

    data   = request.get_json()
    errors = validate_preference_data(data)
    if errors:
        return jsonify({"errors": errors}), 400

    pref = StudentPreference(
        student_id        = student_id,
        wake_time         = int(data["wake_time"]),
        sleep_time        = int(data["sleep_time"]),
        noise_tolerance   = int(data["noise_tolerance"]),
        cleanliness_level = int(data["cleanliness_level"]),
        guest_policy      = int(data["guest_policy"]),
        bathroom_schedule = int(data["bathroom_schedule"]),
        study_habits      = data["study_habits"],
        additional_notes  = data.get("additional_notes", ""),
    )

    db.session.add(pref)
    db.session.commit()

    return jsonify({
        "message":    "Preferences submitted successfully",
        "preference": pref.to_dict(),
    }), 201


# ── GET PREFERENCES ───────────────────────────────────────────────────────────
@preferences_bp.route("/<int:student_id>", methods=["GET"])
@jwt_required()
def get_preferences(student_id):
    claims      = get_jwt()
    role        = claims.get("role")
    current_uid = int(get_jwt_identity())

    # Students can only read their own preferences
    if role == "student" and current_uid != student_id:
        return jsonify({"error": "Access denied"}), 403

    student = Student.query.get_or_404(student_id)

    if not student.preferences:
        return jsonify({"preferences": None, "submitted": False}), 200

    return jsonify({
        "preferences": student.preferences.to_dict(),
        "submitted":   True,
    }), 200


# ── UPDATE PREFERENCES ────────────────────────────────────────────────────────
@preferences_bp.route("/", methods=["PUT"])
@jwt_required()
def update_preferences(student_id=None):
    claims     = get_jwt()
    role       = claims.get("role")
    current_id = int(get_jwt_identity())

    if role != "student":
        return jsonify({"error": "Only students can update preferences"}), 403

    sid     = student_id or current_id
    student = Student.query.get_or_404(sid)

    if not student.preferences:
        return jsonify({"error": "No preferences found. Submit preferences first."}), 404

    if student.preferences.is_locked:
        return jsonify({"error": "Preferences are locked for this semester"}), 403

    data   = request.get_json()
    errors = validate_preference_data(data)
    if errors:
        return jsonify({"errors": errors}), 400

    pref = student.preferences
    pref.wake_time         = int(data["wake_time"])
    pref.sleep_time        = int(data["sleep_time"])
    pref.noise_tolerance   = int(data["noise_tolerance"])
    pref.cleanliness_level = int(data["cleanliness_level"])
    pref.guest_policy      = int(data["guest_policy"])
    pref.bathroom_schedule = int(data["bathroom_schedule"])
    pref.study_habits      = data["study_habits"]
    pref.additional_notes  = data.get("additional_notes", "")

    db.session.commit()

    return jsonify({
        "message":    "Preferences updated successfully",
        "preference": pref.to_dict(),
    }), 200
