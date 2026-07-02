from .extensions import db
from datetime import datetime, timezone

def now_utc():
    return datetime.now(timezone.utc)

class Student(db.Model):
    __tablename__ = "students"

    student_id     = db.Column(db.Integer, primary_key=True)
    name           = db.Column(db.String(100), nullable=False)
    email          = db.Column(db.String(100), nullable=False, unique=True)
    password       = db.Column(db.String(255), nullable=False)
    student_number = db.Column(db.String(20), nullable=False, unique=True)
    year           = db.Column(db.Integer, nullable=False)
    phone          = db.Column(db.String(20))
    gender         = db.Column(db.String(20))
    status         = db.Column(db.String(10), default="active")
    email_verified = db.Column(db.Boolean, nullable=False, default=True)
    verification_status = db.Column(db.String(10), nullable=False, default="pending")
    verification_document_path = db.Column(db.Text)
    verification_note = db.Column(db.Text)
    verified_by = db.Column(db.Integer, db.ForeignKey("admin_users.admin_id"), nullable=True)
    verified_at = db.Column(db.DateTime(timezone=True), nullable=True)
    profile_photo_path = db.Column(db.Text)
    expected_start_date = db.Column(db.Date)
    expected_end_date = db.Column(db.Date)
    created_at     = db.Column(db.DateTime(timezone=True), default=now_utc)
    updated_at     = db.Column(db.DateTime(timezone=True), default=now_utc, onupdate=now_utc)

    # Relationships
    preferences    = db.relationship("StudentPreference", backref="student",
                                     uselist=False, cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "student_id":     self.student_id,
            "name":           self.name,
            "email":          self.email,
            "student_number": self.student_number,
            "year":           self.year,
            "phone":          self.phone,
            "gender":         self.gender,
            "status":         self.status,
            "email_verified": self.email_verified,
            "verification_status": self.verification_status,
            "profile_photo_path": self.profile_photo_path,
            "expected_start_date": self.expected_start_date.isoformat() if self.expected_start_date else None,
            "expected_end_date": self.expected_end_date.isoformat() if self.expected_end_date else None,
            "has_preferences": self.preferences is not None,
            "created_at":     self.created_at.isoformat() if self.created_at else None,
        }


class AdminUser(db.Model):
    __tablename__ = "admin_users"

    admin_id     = db.Column(db.Integer, primary_key=True)
    name         = db.Column(db.String(100), nullable=False)
    email        = db.Column(db.String(100), nullable=False, unique=True)
    password     = db.Column(db.String(255), nullable=False)
    role         = db.Column(db.String(20), nullable=False)  # admin | resident_advisor
    hostel_block = db.Column(db.String(20))
    status       = db.Column(db.String(10), default="active")
    created_by   = db.Column(db.Integer, db.ForeignKey("admin_users.admin_id"))
    created_at   = db.Column(db.DateTime(timezone=True), default=now_utc)
    updated_at   = db.Column(db.DateTime(timezone=True), default=now_utc, onupdate=now_utc)

    def to_dict(self):
        return {
            "admin_id":     self.admin_id,
            "name":         self.name,
            "email":        self.email,
            "role":         self.role,
            "hostel_block": self.hostel_block,
            "status":       self.status,
        }


class StudentPreference(db.Model):
    __tablename__ = "student_preferences"

    preference_id     = db.Column(db.Integer, primary_key=True)
    student_id        = db.Column(db.Integer, db.ForeignKey("students.student_id"),
                                  unique=True, nullable=False)
    wake_time         = db.Column(db.Integer, nullable=False)
    sleep_time        = db.Column(db.Integer, nullable=False)
    noise_tolerance   = db.Column(db.Integer, nullable=False)
    cleanliness_level = db.Column(db.Integer, nullable=False)
    guest_policy      = db.Column(db.Integer, nullable=False)
    bathroom_schedule = db.Column(db.Integer, nullable=False)
    study_habits      = db.Column(db.String(20), nullable=False)
    introvert_extrovert = db.Column(db.Integer, nullable=True)
    vaping_habit = db.Column(db.Integer, nullable=True)
    field_of_study = db.Column(db.String(30), nullable=True)
    hobbies = db.Column(db.ARRAY(db.Text).with_variant(db.JSON, "sqlite"), nullable=True)
    additional_notes  = db.Column(db.Text)
    is_locked         = db.Column(db.Boolean, default=False)
    created_at        = db.Column(db.DateTime(timezone=True), default=now_utc)
    updated_at        = db.Column(db.DateTime(timezone=True), default=now_utc, onupdate=now_utc)

    def to_dict(self):
        return {
            "preference_id":     self.preference_id,
            "student_id":        self.student_id,
            "wake_time":         self.wake_time,
            "sleep_time":        self.sleep_time,
            "noise_tolerance":   self.noise_tolerance,
            "cleanliness_level": self.cleanliness_level,
            "guest_policy":      self.guest_policy,
            "bathroom_schedule": self.bathroom_schedule,
            "study_habits":      self.study_habits,
            "introvert_extrovert": self.introvert_extrovert,
            "vaping_habit": self.vaping_habit,
            "field_of_study": self.field_of_study,
            "hobbies": self.hobbies,
            "additional_notes":  self.additional_notes,
            "is_locked":         self.is_locked,
        }


class Room(db.Model):
    __tablename__ = "rooms"

    room_id      = db.Column(db.Integer, primary_key=True)
    room_number  = db.Column(db.String(20), nullable=False)
    hostel_block = db.Column(db.String(20), nullable=False)
    capacity     = db.Column(db.Integer, nullable=False, default=2)
    status       = db.Column(db.String(25), nullable=False, default="empty")
    created_at   = db.Column(db.DateTime(timezone=True), default=now_utc)
    updated_at   = db.Column(db.DateTime(timezone=True), default=now_utc, onupdate=now_utc)

    def to_dict(self):
        return {
            "room_id":      self.room_id,
            "room_number":  self.room_number,
            "hostel_block": self.hostel_block,
            "capacity":     self.capacity,
            "status":       self.status,
            "created_at":   self.created_at.isoformat() if self.created_at else None,
        }


class RoomAssignment(db.Model):
    __tablename__ = "room_assignments"

    assignment_id       = db.Column(db.Integer, primary_key=True)
    student_id_1        = db.Column(db.Integer, db.ForeignKey("students.student_id"), nullable=False)
    student_id_2        = db.Column(db.Integer, db.ForeignKey("students.student_id"), nullable=True)
    room_id             = db.Column(db.Integer, db.ForeignKey("rooms.room_id"), nullable=False)
    semester            = db.Column(db.String(20), nullable=False)
    compatibility_score = db.Column(db.Integer, nullable=True)
    score_breakdown     = db.Column(db.JSON, nullable=True)
    assignment_type     = db.Column(db.String(10), nullable=False, default="algorithm")
    override_reason     = db.Column(db.Text, nullable=True)
    overridden_by       = db.Column(db.Integer, db.ForeignKey("admin_users.admin_id"), nullable=True)
    overridden_at       = db.Column(db.DateTime(timezone=True), nullable=True)
    status              = db.Column(db.String(25), nullable=False, default="active")
    assigned_by         = db.Column(db.Integer, db.ForeignKey("admin_users.admin_id"), nullable=False)
    is_flagged          = db.Column(db.Boolean, nullable=False, default=False)
    created_at          = db.Column(db.DateTime(timezone=True), default=now_utc)
    updated_at          = db.Column(db.DateTime(timezone=True), default=now_utc, onupdate=now_utc)

    # Relationships
    student1 = db.relationship("Student", foreign_keys=[student_id_1])
    student2 = db.relationship("Student", foreign_keys=[student_id_2])
    room     = db.relationship("Room", backref="assignments")

    def to_dict(self):
        return {
            "assignment_id":       self.assignment_id,
            "student_id_1":        self.student_id_1,
            "student_id_2":        self.student_id_2,
            "room_id":             self.room_id,
            "semester":            self.semester,
            "compatibility_score": self.compatibility_score,
            "score_breakdown":     self.score_breakdown,
            "assignment_type":     self.assignment_type,
            "override_reason":     self.override_reason,
            "overridden_by":       self.overridden_by,
            "overridden_at":       self.overridden_at.isoformat() if self.overridden_at else None,
            "status":              self.status,
            "assigned_by":         self.assigned_by,
            "is_flagged":          self.is_flagged,
            "created_at":          self.created_at.isoformat() if self.created_at else None,
            "student1":            self.student1.to_dict() if self.student1 else None,
            "student2":            self.student2.to_dict() if self.student2 else None,
            "room":                self.room.to_dict() if self.room else None,
        }

class ConflictLog(db.Model):
    __tablename__ = "conflict_logs"

    conflict_id              = db.Column(db.Integer, primary_key=True)
    assignment_id            = db.Column(db.Integer, db.ForeignKey("room_assignments.assignment_id"), nullable=False)
    reported_by_student_id   = db.Column(db.Integer, db.ForeignKey("students.student_id"), nullable=False)
    student_involved         = db.Column(db.Integer, db.ForeignKey("students.student_id"), nullable=False)
    conflict_type            = db.Column(db.String(20), nullable=False)
    severity                 = db.Column(db.Integer, nullable=False)
    description              = db.Column(db.Text, nullable=False)
    status                   = db.Column(db.String(15), nullable=False, default="open")
    mediation_notes          = db.Column(db.Text, nullable=True)
    actions_taken            = db.Column(db.Text, nullable=True)
    resolution_notes         = db.Column(db.Text, nullable=True)
    handled_by_ra_id         = db.Column(db.Integer, db.ForeignKey("admin_users.admin_id"), nullable=True)
    resolved_by              = db.Column(db.Integer, db.ForeignKey("admin_users.admin_id"), nullable=True)
    resolved_at              = db.Column(db.DateTime(timezone=True), nullable=True)
    escalated_by             = db.Column(db.Integer, db.ForeignKey("admin_users.admin_id"), nullable=True)
    escalated_at             = db.Column(db.DateTime(timezone=True), nullable=True)
    escalation_notes         = db.Column(db.Text, nullable=True)
    disabled_by              = db.Column(db.Integer, db.ForeignKey("admin_users.admin_id"), nullable=True)
    disabled_at              = db.Column(db.DateTime(timezone=True), nullable=True)
    disable_reason           = db.Column(db.Text, nullable=True)
    created_at               = db.Column(db.DateTime(timezone=True), default=now_utc)
    updated_at               = db.Column(db.DateTime(timezone=True), default=now_utc, onupdate=now_utc)

    assignment = db.relationship("RoomAssignment", backref="conflicts")
    reporter = db.relationship("Student", foreign_keys=[reported_by_student_id])
    involved_student = db.relationship("Student", foreign_keys=[student_involved])

    def to_dict(self):
        room = self.assignment.room if self.assignment else None
        return {
            "conflict_id": self.conflict_id,
            "assignment_id": self.assignment_id,
            "reported_by_student_id": self.reported_by_student_id,
            "student_involved": self.student_involved,
            "conflict_type": self.conflict_type,
            "severity": self.severity,
            "description": self.description,
            "status": self.status,
            "mediation_notes": self.mediation_notes,
            "actions_taken": self.actions_taken,
            "resolution_notes": self.resolution_notes,
            "handled_by_ra_id": self.handled_by_ra_id,
            "resolved_by": self.resolved_by,
            "resolved_at": self.resolved_at.isoformat() if self.resolved_at else None,
            "escalated_by": self.escalated_by,
            "escalated_at": self.escalated_at.isoformat() if self.escalated_at else None,
            "escalation_notes": self.escalation_notes,
            "disabled_by": self.disabled_by,
            "disabled_at": self.disabled_at.isoformat() if self.disabled_at else None,
            "disable_reason": self.disable_reason,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "room_id": self.assignment.room_id if self.assignment else None,
            "room_number": room.room_number if room else None,
            "hostel_block": room.hostel_block if room else None,
        }


class PasswordResetToken(db.Model):
    __tablename__ = "password_reset_tokens"

    reset_id      = db.Column(db.Integer, primary_key=True)
    user_type     = db.Column(db.String(20), nullable=False)  # student | admin
    user_id       = db.Column(db.Integer, nullable=False)
    token_hash    = db.Column(db.String(64), nullable=False, unique=True)
    request_ip    = db.Column(db.String(45), nullable=True)
    expires_at    = db.Column(db.DateTime(timezone=True), nullable=False)
    used_at       = db.Column(db.DateTime(timezone=True), nullable=True)
    created_at    = db.Column(db.DateTime(timezone=True), default=now_utc)
    updated_at    = db.Column(db.DateTime(timezone=True), default=now_utc, onupdate=now_utc)


class EmailVerificationToken(db.Model):
    __tablename__ = "email_verification_tokens"

    verify_id      = db.Column(db.Integer, primary_key=True)
    student_id     = db.Column(db.Integer, db.ForeignKey("students.student_id"), nullable=False)
    token_hash     = db.Column(db.String(64), nullable=False, unique=True)
    request_ip     = db.Column(db.String(45), nullable=True)
    expires_at     = db.Column(db.DateTime(timezone=True), nullable=False)
    used_at        = db.Column(db.DateTime(timezone=True), nullable=True)
    created_at     = db.Column(db.DateTime(timezone=True), default=now_utc)
    updated_at     = db.Column(db.DateTime(timezone=True), default=now_utc, onupdate=now_utc)


class StayDateChangeRequest(db.Model):
    __tablename__ = "stay_date_change_requests"

    request_id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey("students.student_id"), nullable=False)
    requested_start = db.Column(db.Date, nullable=False)
    requested_end = db.Column(db.Date, nullable=False)
    reason = db.Column(db.Text, nullable=True)
    status = db.Column(db.String(10), nullable=False, default="pending")
    admin_note = db.Column(db.Text, nullable=True)
    reviewed_by = db.Column(db.Integer, db.ForeignKey("admin_users.admin_id"), nullable=True)
    reviewed_at = db.Column(db.DateTime(timezone=True), nullable=True)
    created_at = db.Column(db.DateTime(timezone=True), default=now_utc)
    updated_at = db.Column(db.DateTime(timezone=True), default=now_utc, onupdate=now_utc)


class StudentAllergy(db.Model):
    __tablename__ = "student_allergies"

    allergy_id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey("students.student_id"), unique=True, nullable=False)
    has_dust_mould_allergy = db.Column(db.Boolean, nullable=False, default=False)
    has_fragrance_sensitivity = db.Column(db.Boolean, nullable=False, default=False)
    has_food_allergy = db.Column(db.Boolean, nullable=False, default=False)
    food_allergy_detail = db.Column(db.Text, nullable=True)
    has_latex_allergy = db.Column(db.Boolean, nullable=False, default=False)
    has_chemical_sensitivity = db.Column(db.Boolean, nullable=False, default=False)
    chemical_sensitivity_detail = db.Column(db.Text, nullable=True)
    has_severe_nut_allergy = db.Column(db.Boolean, nullable=False, default=False)
    has_smoke_sensitivity = db.Column(db.Boolean, nullable=False, default=False)
    has_asthma_or_respiratory_condition = db.Column(db.Boolean, nullable=False, default=False)
    heavy_fragrance_user = db.Column(db.Boolean, nullable=False, default=False)
    cooks_strong_smelling_food = db.Column(db.Boolean, nullable=False, default=False)
    uses_strong_cleaning_products = db.Column(db.Boolean, nullable=False, default=False)
    stores_or_eats_nuts_in_room = db.Column(db.Boolean, nullable=False, default=False)
    smoking_habit = db.Column(db.String(11), nullable=False, default="no")
    created_at = db.Column(db.DateTime(timezone=True), default=now_utc)
    updated_at = db.Column(db.DateTime(timezone=True), default=now_utc, onupdate=now_utc)


class PreferredRoommate(db.Model):
    __tablename__ = "preferred_roommates"

    preference_card_id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey("students.student_id"), nullable=False)
    preferred_student_id = db.Column(db.Integer, db.ForeignKey("students.student_id"), nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), default=now_utc)


class CompatibilityScore(db.Model):
    __tablename__ = "compatibility_scores"

    score_id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey("students.student_id"), nullable=False)
    candidate_id = db.Column(db.Integer, db.ForeignKey("students.student_id"), nullable=False)
    score = db.Column(db.Numeric(5, 2), nullable=False)
    is_hard_blocked = db.Column(db.Boolean, nullable=False, default=False)
    block_reason = db.Column(db.String(30), nullable=True)
    computed_at = db.Column(db.DateTime(timezone=True), default=now_utc)


class TokenBlocklist(db.Model):
    __tablename__ = "token_blocklist"

    id            = db.Column(db.Integer, primary_key=True)
    jti           = db.Column(db.String(36), nullable=False, unique=True, index=True)
    user_identity = db.Column(db.String(64), nullable=False, index=True)
    token_type    = db.Column(db.String(20), nullable=False)
    expires_at    = db.Column(db.DateTime(timezone=True), nullable=False)
    revoked_at    = db.Column(db.DateTime(timezone=True), default=now_utc)


class AuditLog(db.Model):
    __tablename__ = "audit_log"

    log_id        = db.Column(db.Integer, primary_key=True)
    actor_type    = db.Column(db.String(20), nullable=False)  # student | admin | system
    actor_id      = db.Column(db.Integer, nullable=False)
    action        = db.Column(db.String(50), nullable=False)
    target_table  = db.Column(db.String(50), nullable=False)
    target_id     = db.Column(db.Integer, nullable=True)
    detail        = db.Column(db.Text, nullable=True)
    ip_address    = db.Column(db.String(45), nullable=True)
    created_at    = db.Column(db.DateTime(timezone=True), default=now_utc)
