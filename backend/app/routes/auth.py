import hashlib
import secrets
import smtplib
from datetime import timedelta
from email.message import EmailMessage
from datetime import datetime, timezone

from flask import Blueprint, current_app, request, jsonify
from flask_jwt_extended import create_access_token, get_jwt_identity, get_jwt, jwt_required
from email_validator import validate_email, EmailNotValidError
from ..extensions import db, bcrypt, limiter
from ..models import Student, AdminUser, PasswordResetToken, TokenBlocklist, AuditLog, now_utc
from ..security import validate_password_policy

auth_bp = Blueprint("auth", __name__)


def _record_audit(actor_type, actor_id, action, target_table, target_id=None, detail=None):
    entry = AuditLog(
        actor_type=actor_type,
        actor_id=actor_id,
        action=action,
        target_table=target_table,
        target_id=target_id,
        detail=detail,
        ip_address=request.remote_addr,
    )
    db.session.add(entry)


def _hash_reset_token(raw_token):
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def _build_reset_link(raw_token):
    base = current_app.config.get("FRONTEND_RESET_PASSWORD_URL", "http://localhost:5173/reset-password")
    sep = "&" if "?" in base else "?"
    return f"{base}{sep}token={raw_token}"


def _send_reset_email(recipient_email, reset_link):
    smtp_user = current_app.config.get("SMTP_USERNAME")
    smtp_password = current_app.config.get("SMTP_PASSWORD")
    smtp_host = current_app.config.get("SMTP_HOST")
    smtp_port = current_app.config.get("SMTP_PORT")
    smtp_sender = current_app.config.get("SMTP_SENDER") or smtp_user
    smtp_use_tls = current_app.config.get("SMTP_USE_TLS", True)

    if not smtp_user or not smtp_password:
        raise RuntimeError("SMTP credentials are not configured")

    msg = EmailMessage()
    msg["Subject"] = "Hostel Harmony Password Reset"
    msg["From"] = smtp_sender
    msg["To"] = recipient_email
    msg.set_content(
        "A password reset was requested for your Hostel Harmony account.\n\n"
        f"Use this link to reset your password:\n{reset_link}\n\n"
        "This link expires shortly and can only be used once.\n"
        "If you did not request this, you can ignore this email."
    )

    with smtplib.SMTP(smtp_host, smtp_port, timeout=20) as server:
        if smtp_use_tls:
            server.starttls()
        server.login(smtp_user, smtp_password)
        server.send_message(msg)


# ── STUDENT REGISTRATION ──────────────────────────────────────────────────────
@auth_bp.route("/register", methods=["POST"])
@limiter.limit("10 per minute")
def register_student():
    data = request.get_json()

    # Required field check
    required = ["name", "email", "password", "student_number", "year", "gender"]
    missing  = [f for f in required if not data.get(f)]
    if missing:
        return jsonify({"error": f"Missing required fields: {', '.join(missing)}"}), 400

    # Email format validation (disable DNS check for development)
    try:
        validate_email(data["email"], check_deliverability=False)
    except EmailNotValidError:
        return jsonify({"error": "Invalid email address"}), 400

    password_errors = validate_password_policy(data["password"])
    if password_errors:
        return jsonify({"error": " ; ".join(password_errors)}), 400

    # Year range
    try:
        year = int(data["year"])
        if year < 1 or year > 6:
            raise ValueError
    except (ValueError, TypeError):
        return jsonify({"error": "Year of study must be between 1 and 6"}), 400

    # Gender validation
    valid_genders = ["male", "female"]
    if data["gender"].lower() not in valid_genders:
        return jsonify({"error": "Gender must be male or female"}), 400

    # Uniqueness checks
    if Student.query.filter_by(email=data["email"]).first():
        return jsonify({"error": "An account with this email already exists"}), 409
    if Student.query.filter_by(student_number=data["student_number"]).first():
        return jsonify({"error": "This student number is already registered"}), 409

    # Hash password and create record
    hashed_pw = bcrypt.generate_password_hash(data["password"]).decode("utf-8")

    student = Student(
        name           = data["name"].strip(),
        email          = data["email"].strip().lower(),
        password       = hashed_pw,
        student_number = data["student_number"].strip().upper(),
        year           = year,
        phone          = data.get("phone", "").strip() or None,
        gender         = data["gender"].lower(),
        status         = "active",
    )

    db.session.add(student)
    db.session.flush()
    _record_audit(
        actor_type="student",
        actor_id=student.student_id,
        action="auth.register",
        target_table="students",
        target_id=student.student_id,
        detail="Student self-registration",
    )
    db.session.commit()

    return jsonify({
        "message":    "Registration successful. Please log in.",
        "student_id": student.student_id,
    }), 201


# ── UNIFIED LOGIN ─────────────────────────────────────────────────────────────
@auth_bp.route("/login", methods=["POST"])
@limiter.limit("8 per minute")
def login():
    data = request.get_json()
    email    = data.get("email", "").strip().lower()
    password = data.get("password", "")

    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400

    # Check students table first
    user      = Student.query.filter_by(email=email, status="active").first()
    role      = "student"
    user_id   = None
    user_data = None

    if user:
        user_id   = user.student_id
        user_data = user.to_dict()
    else:
        # Check admin_users table
        admin = AdminUser.query.filter_by(email=email, status="active").first()
        if admin:
            user      = admin
            role      = admin.role
            user_id   = admin.admin_id
            user_data = admin.to_dict()

    # Validate password
    if not user or not bcrypt.check_password_hash(user.password, password):
        _record_audit(
            actor_type="system",
            actor_id=0,
            action="auth.login_failed",
            target_table="auth",
            detail=f"Failed login for email: {email}",
        )
        db.session.commit()
        return jsonify({"error": "Invalid email or password"}), 401

    # Build JWT with role embedded
    token = create_access_token(
        identity=str(user_id),
        additional_claims={
            "role":         role,
            "name":         user.name,
            "hostel_block": getattr(user, "hostel_block", None),
        }
    )

    _record_audit(
        actor_type="student" if role == "student" else "admin",
        actor_id=int(user_id),
        action="auth.login_success",
        target_table="students" if role == "student" else "admin_users",
        target_id=int(user_id),
        detail=f"Role: {role}",
    )
    db.session.commit()

    return jsonify({
        "token":    token,
        "role":     role,
        "name":     user.name,
        "user":     user_data,
    }), 200


# ── GET CURRENT USER ──────────────────────────────────────────────────────────
@auth_bp.route("/me", methods=["GET"])
@jwt_required()
def get_current_user():
    claims  = get_jwt()
    role    = claims.get("role")
    user_id = int(get_jwt_identity())

    if role == "student":
        user = Student.query.get_or_404(user_id)
        return jsonify(user.to_dict()), 200
    else:
        user = AdminUser.query.get_or_404(user_id)
        return jsonify(user.to_dict()), 200


@auth_bp.route("/forgot-password", methods=["POST"])
@limiter.limit("5 per minute")
def forgot_password():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()

    if not email:
        return jsonify({"error": "Email is required"}), 400

    generic_message = "If an account exists for that email, a password reset link has been sent."

    user = Student.query.filter_by(email=email, status="active").first()
    user_type = "student"
    user_id = user.student_id if user else None

    if not user:
        admin = AdminUser.query.filter_by(email=email, status="active").first()
        if admin:
            user = admin
            user_type = "admin"
            user_id = admin.admin_id

    if not user:
        _record_audit(
            actor_type="system",
            actor_id=0,
            action="auth.forgot_password_unknown",
            target_table="auth",
            detail=f"Forgot-password requested for unknown email: {email}",
        )
        db.session.commit()
        return jsonify({"message": generic_message}), 200

    now = now_utc()
    expires = now + timedelta(minutes=current_app.config["PASSWORD_RESET_TOKEN_EXPIRES_MINUTES"])
    raw_token = secrets.token_urlsafe(32)
    token_hash = _hash_reset_token(raw_token)
    reset_link = _build_reset_link(raw_token)

    PasswordResetToken.query.filter_by(user_type=user_type, user_id=user_id, used_at=None).update(
        {"used_at": now}
    )

    reset_row = PasswordResetToken(
        user_type=user_type,
        user_id=user_id,
        token_hash=token_hash,
        request_ip=request.remote_addr,
        expires_at=expires,
    )
    db.session.add(reset_row)
    db.session.commit()

    try:
        _send_reset_email(user.email, reset_link)
    except Exception as exc:
        _record_audit(
            actor_type="student" if user_type == "student" else "admin",
            actor_id=int(user_id),
            action="auth.forgot_password_email_failed",
            target_table="password_reset_tokens",
            target_id=reset_row.reset_id,
            detail=str(exc),
        )
        db.session.commit()
        current_app.logger.exception("Failed to send password reset email: %s", exc)
        if current_app.debug:
            return jsonify({
                "message": generic_message,
                "reset_link": reset_link,
                "note": "SMTP failed in debug mode, using direct link fallback.",
            }), 200
        return jsonify({"error": "Unable to send reset email at this time"}), 500

    _record_audit(
        actor_type="student" if user_type == "student" else "admin",
        actor_id=int(user_id),
        action="auth.forgot_password_requested",
        target_table="password_reset_tokens",
        target_id=reset_row.reset_id,
        detail="Password reset token created and email requested",
    )
    db.session.commit()

    return jsonify({"message": generic_message}), 200


@auth_bp.route("/reset-password", methods=["POST"])
@limiter.limit("5 per minute")
def reset_password():
    data = request.get_json(silent=True) or {}
    raw_token = (data.get("token") or "").strip()
    new_password = data.get("new_password") or ""
    confirm_password = data.get("confirm_password") or ""

    if not raw_token:
        return jsonify({"error": "Reset token is required"}), 400
    password_errors = validate_password_policy(new_password)
    if password_errors:
        return jsonify({"error": " ; ".join(password_errors)}), 400
    if new_password != confirm_password:
        return jsonify({"error": "Passwords do not match"}), 400

    token_hash = _hash_reset_token(raw_token)
    now = now_utc()

    token_row = PasswordResetToken.query.filter_by(token_hash=token_hash).first()
    if not token_row or token_row.used_at is not None or token_row.expires_at <= now:
        return jsonify({"error": "Reset token is invalid or expired"}), 400

    if token_row.user_type == "student":
        user = Student.query.get(token_row.user_id)
    elif token_row.user_type == "admin":
        user = AdminUser.query.get(token_row.user_id)
    else:
        user = None

    if not user or user.status != "active":
        return jsonify({"error": "Reset token is invalid or expired"}), 400

    user.password = bcrypt.generate_password_hash(new_password).decode("utf-8")

    PasswordResetToken.query.filter_by(user_type=token_row.user_type, user_id=token_row.user_id, used_at=None).update(
        {"used_at": now}
    )

    _record_audit(
        actor_type="student" if token_row.user_type == "student" else "admin",
        actor_id=int(token_row.user_id),
        action="auth.password_reset_success",
        target_table="password_reset_tokens",
        target_id=token_row.reset_id,
        detail="Password reset completed",
    )

    db.session.commit()

    return jsonify({"message": "Password reset successful. You can now log in."}), 200


@auth_bp.route("/logout", methods=["POST"])
@jwt_required()
def logout():
    claims = get_jwt()
    role = claims.get("role")
    jti = claims.get("jti")
    token_type = claims.get("type", "access")
    identity = str(get_jwt_identity())
    exp_ts = claims.get("exp")

    if not jti or not exp_ts:
        return jsonify({"error": "Invalid token context"}), 400

    exists = TokenBlocklist.query.filter_by(jti=jti).first()
    if exists:
        _record_audit(
            actor_type="student" if role == "student" else "admin",
            actor_id=int(identity),
            action="auth.logout",
            target_table="token_blocklist",
            target_id=exists.id,
            detail="Logout repeated for already-revoked token",
        )
        db.session.commit()
        return jsonify({"message": "Logout successful"}), 200

    blocked = TokenBlocklist(
        jti=jti,
        user_identity=identity,
        token_type=token_type,
        expires_at=datetime.fromtimestamp(exp_ts, tz=timezone.utc),
    )
    db.session.add(blocked)
    _record_audit(
        actor_type="student" if role == "student" else "admin",
        actor_id=int(identity),
        action="auth.logout",
        target_table="token_blocklist",
        detail="Access token revoked",
    )
    db.session.commit()

    return jsonify({"message": "Logout successful"}), 200
