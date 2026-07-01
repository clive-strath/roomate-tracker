-- ============================================================================
-- Hostel Roommate Compatibility System — Consolidated Schema
-- Includes base schema + migration_allocation + migration_password_reset
-- + migration_token_blocklist + migration_audit_log + migration_conflict_phase10
-- Apply with: psql postgresql://postgres@localhost:5433/postgres -f schema_merged.sql
-- ============================================================================

-- ── STUDENTS ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS students (
    student_id      SERIAL PRIMARY KEY,
    name            VARCHAR(100)  NOT NULL,
    email           VARCHAR(100)  NOT NULL UNIQUE,
    password        VARCHAR(255)  NOT NULL,
    student_number  VARCHAR(20)   NOT NULL UNIQUE,
    year            INTEGER       NOT NULL CHECK (year BETWEEN 1 AND 6),
    phone           VARCHAR(20),
    gender          VARCHAR(20),
    status          VARCHAR(10)   NOT NULL DEFAULT 'active'
                                  CHECK (status IN ('active', 'inactive')),
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ── ADMIN USERS ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_users (
    admin_id        SERIAL PRIMARY KEY,
    name            VARCHAR(100)  NOT NULL,
    email           VARCHAR(100)  NOT NULL UNIQUE,
    password        VARCHAR(255)  NOT NULL,
    role            VARCHAR(20)   NOT NULL
                                  CHECK (role IN ('admin', 'resident_advisor')),
    hostel_block    VARCHAR(20),
    status          VARCHAR(10)   NOT NULL DEFAULT 'active'
                                  CHECK (status IN ('active', 'inactive')),
    created_by      INTEGER       REFERENCES admin_users(admin_id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ── PASSWORD RESET TOKENS ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    reset_id         SERIAL PRIMARY KEY,
    user_type        VARCHAR(20)   NOT NULL CHECK (user_type IN ('student', 'admin')),
    user_id          INTEGER       NOT NULL,
    token_hash       VARCHAR(64)   NOT NULL UNIQUE,
    request_ip       VARCHAR(45),
    expires_at       TIMESTAMPTZ   NOT NULL,
    used_at          TIMESTAMPTZ,
    created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ── JWT TOKEN BLOCKLIST ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS token_blocklist (
    id               SERIAL PRIMARY KEY,
    jti              VARCHAR(36)   NOT NULL UNIQUE,
    user_identity    VARCHAR(64)   NOT NULL,
    token_type       VARCHAR(20)   NOT NULL,
    expires_at       TIMESTAMPTZ   NOT NULL,
    revoked_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ── STUDENT PREFERENCES ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS student_preferences (
    preference_id       SERIAL PRIMARY KEY,
    student_id          INTEGER       NOT NULL UNIQUE
                                      REFERENCES students(student_id) ON DELETE CASCADE,
    wake_time           INTEGER       NOT NULL CHECK (wake_time BETWEEN 1 AND 5),
    sleep_time          INTEGER       NOT NULL CHECK (sleep_time BETWEEN 1 AND 5),
    noise_tolerance     INTEGER       NOT NULL CHECK (noise_tolerance BETWEEN 1 AND 5),
    cleanliness_level   INTEGER       NOT NULL CHECK (cleanliness_level BETWEEN 1 AND 5),
    guest_policy        INTEGER       NOT NULL CHECK (guest_policy BETWEEN 1 AND 5),
    bathroom_schedule   INTEGER       NOT NULL CHECK (bathroom_schedule BETWEEN 1 AND 3),
    study_habits        VARCHAR(20)   NOT NULL
                                      CHECK (study_habits IN ('quiet', 'group', 'flexible')),
    additional_notes    TEXT,
    is_locked           BOOLEAN       NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ── ROOMS ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rooms (
    room_id         SERIAL PRIMARY KEY,
    room_number     VARCHAR(20)   NOT NULL,
    hostel_block    VARCHAR(20)   NOT NULL,
    capacity        INTEGER       NOT NULL DEFAULT 2 CHECK (capacity > 0),
    status          VARCHAR(25)   NOT NULL DEFAULT 'empty'
                                  CHECK (status IN ('empty', 'partially_allocated', 'allocated', 'maintenance')),
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

    CONSTRAINT unique_room_per_block UNIQUE (room_number, hostel_block)
);

COMMENT ON TABLE  rooms              IS 'Physical hostel rooms available for allocation';
COMMENT ON COLUMN rooms.status       IS 'empty = available for assignment; partially_allocated = occupied by one student; allocated = currently occupied; maintenance = manually taken offline by admin';
COMMENT ON COLUMN rooms.capacity     IS 'Number of students the room holds; system currently pairs exactly 2 per assignment';

-- ── ROOM ASSIGNMENTS ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS room_assignments (
    assignment_id           SERIAL PRIMARY KEY,
    student_id_1            INTEGER       NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
    student_id_2            INTEGER       REFERENCES students(student_id) ON DELETE CASCADE,
    room_id                 INTEGER       NOT NULL REFERENCES rooms(room_id) ON DELETE RESTRICT,
    semester                VARCHAR(20)   NOT NULL,

    compatibility_score     INTEGER       CHECK (compatibility_score IS NULL OR compatibility_score BETWEEN 0 AND 100),
    score_breakdown         JSONB,

    assignment_type         VARCHAR(10)   NOT NULL DEFAULT 'algorithm'
                                          CHECK (assignment_type IN ('algorithm', 'manual')),

    override_reason         TEXT,
    overridden_by           INTEGER       REFERENCES admin_users(admin_id) ON DELETE SET NULL,
    overridden_at           TIMESTAMPTZ,

    status                  VARCHAR(25)   NOT NULL DEFAULT 'active'
                                          CHECK (status IN ('awaiting_roommate', 'active', 'completed', 'cancelled', 'archived')),
    assigned_by             INTEGER       NOT NULL REFERENCES admin_users(admin_id) ON DELETE RESTRICT,
    is_flagged              BOOLEAN       NOT NULL DEFAULT FALSE,

    created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

    CONSTRAINT unique_pairing_per_semester
        UNIQUE (student_id_1, student_id_2, semester),

    CONSTRAINT no_self_assignment
        CHECK (student_id_2 IS NULL OR student_id_1 <> student_id_2),

    CONSTRAINT unique_room_per_semester
        UNIQUE (room_id, semester)
);

COMMENT ON COLUMN room_assignments.is_flagged IS
    'TRUE when compatibility_score < 40. Does not block assignment, just surfaces it to admin.';

-- ── CONFLICT LOGS ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS conflict_logs (
    conflict_id              SERIAL PRIMARY KEY,
    assignment_id            INTEGER       NOT NULL REFERENCES room_assignments(assignment_id) ON DELETE RESTRICT,
    reported_by_student_id   INTEGER       NOT NULL REFERENCES students(student_id) ON DELETE RESTRICT,
    student_involved         INTEGER       NOT NULL REFERENCES students(student_id) ON DELETE RESTRICT,

    conflict_type            VARCHAR(20)   NOT NULL
                                          CHECK (conflict_type IN (
                                              'sleep_schedule', 'noise', 'cleanliness',
                                              'guests', 'bathroom', 'other'
                                          )),
    severity                 INTEGER       NOT NULL CHECK (severity BETWEEN 1 AND 5),
    description              TEXT          NOT NULL,

    status                   VARCHAR(15)   NOT NULL DEFAULT 'open'
                                          CHECK (status IN ('open', 'in_mediation', 'resolved', 'escalated', 'disabled')),
    mediation_notes          TEXT,
    actions_taken            TEXT,
    resolution_notes         TEXT,
    handled_by_ra_id         INTEGER       REFERENCES admin_users(admin_id) ON DELETE SET NULL,
    resolved_by              INTEGER       REFERENCES admin_users(admin_id) ON DELETE SET NULL,
    resolved_at              TIMESTAMPTZ,
    escalated_by             INTEGER       REFERENCES admin_users(admin_id) ON DELETE SET NULL,
    escalated_at             TIMESTAMPTZ,
    escalation_notes         TEXT,

    disabled_by              INTEGER       REFERENCES admin_users(admin_id) ON DELETE SET NULL,
    disabled_at              TIMESTAMPTZ,
    disable_reason           TEXT,

    created_at               TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at               TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ── AUDIT LOG ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_log (
    log_id          SERIAL PRIMARY KEY,
    actor_type      VARCHAR(20)   NOT NULL CHECK (actor_type IN ('student', 'admin', 'system')),
    actor_id        INTEGER       NOT NULL,
    action          VARCHAR(50)   NOT NULL,
    target_table    VARCHAR(50)   NOT NULL,
    target_id       INTEGER,
    detail          TEXT,
    ip_address      VARCHAR(45),
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at_students ON students;
CREATE TRIGGER set_updated_at_students
    BEFORE UPDATE ON students
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_admin_users ON admin_users;
CREATE TRIGGER set_updated_at_admin_users
    BEFORE UPDATE ON admin_users
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_password_reset_tokens ON password_reset_tokens;
CREATE TRIGGER set_updated_at_password_reset_tokens
    BEFORE UPDATE ON password_reset_tokens
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_student_preferences ON student_preferences;
CREATE TRIGGER set_updated_at_student_preferences
    BEFORE UPDATE ON student_preferences
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_rooms ON rooms;
CREATE TRIGGER set_updated_at_rooms
    BEFORE UPDATE ON rooms
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_room_assignments ON room_assignments;
CREATE TRIGGER set_updated_at_room_assignments
    BEFORE UPDATE ON room_assignments
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_conflict_logs ON conflict_logs;
CREATE TRIGGER set_updated_at_conflict_logs
    BEFORE UPDATE ON conflict_logs
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE OR REPLACE FUNCTION trigger_sync_room_status()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        IF NEW.status = 'awaiting_roommate' THEN
            UPDATE rooms SET status = 'partially_allocated' WHERE room_id = NEW.room_id;
        ELSIF NEW.status = 'active' THEN
            UPDATE rooms SET status = 'allocated' WHERE room_id = NEW.room_id;
        END IF;

    ELSIF (TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status) THEN
        IF NEW.status = 'active' THEN
            UPDATE rooms SET status = 'allocated' WHERE room_id = NEW.room_id;
        ELSIF NEW.status IN ('cancelled', 'completed', 'archived') THEN
            UPDATE rooms
            SET status = 'empty'
            WHERE room_id = NEW.room_id AND status <> 'maintenance';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sync_room_status_on_assignment ON room_assignments;
CREATE TRIGGER sync_room_status_on_assignment
    AFTER INSERT OR UPDATE ON room_assignments
    FOR EACH ROW EXECUTE FUNCTION trigger_sync_room_status();

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_students_email          ON students(email);
CREATE INDEX IF NOT EXISTS idx_students_student_number ON students(student_number);
CREATE INDEX IF NOT EXISTS idx_students_status         ON students(status);

CREATE INDEX IF NOT EXISTS idx_admin_users_email       ON admin_users(email);
CREATE INDEX IF NOT EXISTS idx_admin_users_role        ON admin_users(role);
CREATE INDEX IF NOT EXISTS idx_admin_users_block       ON admin_users(hostel_block);

CREATE INDEX IF NOT EXISTS idx_password_reset_user     ON password_reset_tokens(user_type, user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_expires  ON password_reset_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_password_reset_used     ON password_reset_tokens(used_at);

CREATE INDEX IF NOT EXISTS idx_token_blocklist_jti      ON token_blocklist(jti);
CREATE INDEX IF NOT EXISTS idx_token_blocklist_user     ON token_blocklist(user_identity);
CREATE INDEX IF NOT EXISTS idx_token_blocklist_expires  ON token_blocklist(expires_at);

CREATE INDEX IF NOT EXISTS idx_preferences_student     ON student_preferences(student_id);
CREATE INDEX IF NOT EXISTS idx_preferences_locked      ON student_preferences(is_locked);

CREATE INDEX IF NOT EXISTS idx_rooms_block             ON rooms(hostel_block);
CREATE INDEX IF NOT EXISTS idx_rooms_status            ON rooms(status);
CREATE INDEX IF NOT EXISTS idx_rooms_block_status      ON rooms(hostel_block, status);

CREATE INDEX IF NOT EXISTS idx_assignments_student1    ON room_assignments(student_id_1);
CREATE INDEX IF NOT EXISTS idx_assignments_student2    ON room_assignments(student_id_2);
CREATE INDEX IF NOT EXISTS idx_assignments_room        ON room_assignments(room_id);
CREATE INDEX IF NOT EXISTS idx_assignments_semester    ON room_assignments(semester);
CREATE INDEX IF NOT EXISTS idx_assignments_status      ON room_assignments(status);
CREATE INDEX IF NOT EXISTS idx_assignments_score       ON room_assignments(compatibility_score);

CREATE INDEX IF NOT EXISTS idx_conflicts_assignment         ON conflict_logs(assignment_id);
CREATE INDEX IF NOT EXISTS idx_conflicts_reported_by_student ON conflict_logs(reported_by_student_id);
CREATE INDEX IF NOT EXISTS idx_conflicts_handled_by_ra      ON conflict_logs(handled_by_ra_id);
CREATE INDEX IF NOT EXISTS idx_conflicts_escalated_by       ON conflict_logs(escalated_by);
CREATE INDEX IF NOT EXISTS idx_conflicts_type               ON conflict_logs(conflict_type);
CREATE INDEX IF NOT EXISTS idx_conflicts_severity           ON conflict_logs(severity);
CREATE INDEX IF NOT EXISTS idx_conflicts_status             ON conflict_logs(status);

CREATE INDEX IF NOT EXISTS idx_audit_actor             ON audit_log(actor_id, actor_type);
CREATE INDEX IF NOT EXISTS idx_audit_action            ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_created           ON audit_log(created_at);
