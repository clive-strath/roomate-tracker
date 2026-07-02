import base64
from datetime import date
from pathlib import Path

from sqlalchemy import text

from app import create_app
from app.extensions import db, bcrypt
from app.models import (
    AdminUser,
    Student,
    StudentPreference,
    PreferredRoommate,
    Room,
)

ONE_BY_ONE_PNG_BASE64 = (
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/a9kAAAAASUVORK5CYII="
)


def ensure_demo_files(backend_root, student_number):
    uploads_root = backend_root / "uploads"
    profile_dir = uploads_root / "profile_photos"
    verify_dir = uploads_root / "verification_documents"
    profile_dir.mkdir(parents=True, exist_ok=True)
    verify_dir.mkdir(parents=True, exist_ok=True)

    profile_path = profile_dir / f"{student_number.lower()}_profile.png"
    verify_path = verify_dir / f"{student_number.lower()}_document.pdf"

    profile_path.write_bytes(base64.b64decode(ONE_BY_ONE_PNG_BASE64))
    verify_pdf = (
        b"%PDF-1.4\n"
        b"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n"
        b"2 0 obj\n<< /Type /Pages /Count 1 /Kids [3 0 R] >>\nendobj\n"
        b"3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 144] >>\nendobj\n"
        b"trailer\n<< /Root 1 0 R >>\n%%EOF\n"
    )
    verify_path.write_bytes(verify_pdf)

    return (
        str(profile_path.relative_to(backend_root)),
        str(verify_path.relative_to(backend_root)),
    )


def build_student_seed_data():
    return [
        {"name": "Alex Kimani", "email": "alex.kimani@students.ac.ke", "student_number": "STU1001", "year": 2, "gender": "male"},
        {"name": "Brian Otieno", "email": "brian.otieno@students.ac.ke", "student_number": "STU1002", "year": 1, "gender": "male"},
        {"name": "Caleb Mwangi", "email": "caleb.mwangi@students.ac.ke", "student_number": "STU1003", "year": 3, "gender": "male"},
        {"name": "David Njoroge", "email": "david.njoroge@students.ac.ke", "student_number": "STU1004", "year": 2, "gender": "male"},
        {"name": "Ethan Kiptoo", "email": "ethan.kiptoo@students.ac.ke", "student_number": "STU1005", "year": 4, "gender": "male"},
        {"name": "Felix Ouma", "email": "felix.ouma@students.ac.ke", "student_number": "STU1006", "year": 1, "gender": "male"},
        {"name": "Grace Achieng", "email": "grace.achieng@students.ac.ke", "student_number": "STU1007", "year": 2, "gender": "female"},
        {"name": "Hannah Wanjiku", "email": "hannah.wanjiku@students.ac.ke", "student_number": "STU1008", "year": 3, "gender": "female"},
        {"name": "Irene Chebet", "email": "irene.chebet@students.ac.ke", "student_number": "STU1009", "year": 1, "gender": "female"},
        {"name": "Joy Atieno", "email": "joy.atieno@students.ac.ke", "student_number": "STU1010", "year": 4, "gender": "female"},
        {"name": "Kelly Jepkorir", "email": "kelly.jepkorir@students.ac.ke", "student_number": "STU1011", "year": 2, "gender": "female"},
        {"name": "Linda Naliaka", "email": "linda.naliaka@students.ac.ke", "student_number": "STU1012", "year": 3, "gender": "female"},
    ]


def build_preference_choices():
    # Each student has exactly 3 preferred roommate recommendations.
    # This set intentionally includes mutual and non-mutual choices.
    return {
        "STU1001": ["STU1002", "STU1003", "STU1004"],
        "STU1002": ["STU1001", "STU1005", "STU1006"],
        "STU1003": ["STU1004", "STU1005", "STU1007"],
        "STU1004": ["STU1008", "STU1009", "STU1010"],
        "STU1005": ["STU1006", "STU1001", "STU1002"],
        "STU1006": ["STU1005", "STU1007", "STU1008"],
        "STU1007": ["STU1008", "STU1009", "STU1010"],
        "STU1008": ["STU1007", "STU1011", "STU1012"],
        "STU1009": ["STU1010", "STU1011", "STU1012"],
        "STU1010": ["STU1009", "STU1002", "STU1003"],
        "STU1011": ["STU1012", "STU1001", "STU1004"],
        "STU1012": ["STU1002", "STU1005", "STU1011"],
    }


app = create_app()
with app.app_context():
    backend_root = Path(__file__).resolve().parent

    # Reset seed-targeted tables so repeated runs are deterministic.
    db.session.execute(text(
        """
        TRUNCATE TABLE
            preferred_roommates,
            compatibility_scores,
            student_allergies,
            stay_date_change_requests,
            conflict_logs,
            room_assignments,
            student_preferences,
            email_verification_tokens,
            password_reset_tokens,
            token_blocklist,
            audit_log,
            students,
            rooms,
            admin_users
        RESTART IDENTITY CASCADE
        """
    ))
    db.session.commit()

    admin_pw = bcrypt.generate_password_hash("adminpassword").decode("utf-8")
    admin = AdminUser(
        name="System Admin",
        email="admin@university.ac.ke",
        password=admin_pw,
        role="admin",
        status="active",
    )
    db.session.add(admin)
    db.session.flush()

    resident_advisors = [
        {"name": "Advisor John", "email": "ra.a@university.ac.ke", "password": "raApassword", "hostel_block": "A"},
        {"name": "Advisor Brenda", "email": "ra.b@university.ac.ke", "password": "raBpassword", "hostel_block": "B"},
        {"name": "Advisor Charles", "email": "ra.c@university.ac.ke", "password": "raCpassword", "hostel_block": "C"},
    ]

    for advisor in resident_advisors:
        db.session.add(
            AdminUser(
                name=advisor["name"],
                email=advisor["email"],
                password=bcrypt.generate_password_hash(advisor["password"]).decode("utf-8"),
                role="resident_advisor",
                hostel_block=advisor["hostel_block"],
                status="active",
                created_by=admin.admin_id,
            )
        )

    for block in ["A", "B", "C"]:
        for number in range(100, 105):
            db.session.add(
                Room(
                    room_number=f"{block}{number}",
                    hostel_block=block,
                    capacity=2,
                    status="empty",
                )
            )

    students_by_number = {}
    for idx, payload in enumerate(build_student_seed_data(), start=1):
        profile_rel, doc_rel = ensure_demo_files(backend_root, payload["student_number"])
        student = Student(
            name=payload["name"],
            email=payload["email"],
            password=bcrypt.generate_password_hash("StudentPass123!").decode("utf-8"),
            student_number=payload["student_number"],
            year=payload["year"],
            phone=f"+254700000{idx:03d}",
            gender=payload["gender"],
            status="active",
            email_verified=True,
            verification_status="approved",
            verification_document_path=doc_rel,
            verification_note="Approved by seed",
            verified_by=admin.admin_id,
            verified_at=db.func.now(),
            profile_photo_path=profile_rel,
            expected_start_date=date(2026, 9, 1),
            expected_end_date=date(2027, 5, 31),
        )
        db.session.add(student)
        db.session.flush()
        students_by_number[student.student_number] = student

        db.session.add(
            StudentPreference(
                student_id=student.student_id,
                wake_time=((idx % 5) + 1),
                sleep_time=(((idx + 2) % 5) + 1),
                noise_tolerance=(((idx + 1) % 5) + 1),
                cleanliness_level=(((idx + 3) % 5) + 1),
                guest_policy=(((idx + 4) % 5) + 1),
                bathroom_schedule=((idx % 3) + 1),
                study_habits=["quiet", "group", "flexible"][idx % 3],
                introvert_extrovert=((idx % 5) + 1),
                vaping_habit=((idx % 3) + 1),
                field_of_study=[
                    "stem",
                    "medicine",
                    "business",
                    "arts_humanities",
                    "law",
                    "social_sciences",
                    "education",
                    "other",
                ][(idx - 1) % 8],
                hobbies=["reading", "music", "coding"] if idx % 2 == 0 else ["sports", "travel", "movies_series"],
                additional_notes=f"Seeded preference profile for {student.student_number}",
                is_locked=False,
            )
        )

    preference_choices = build_preference_choices()
    for student_number, targets in preference_choices.items():
        student = students_by_number[student_number]
        for target_number in targets:
            target = students_by_number[target_number]
            db.session.add(
                PreferredRoommate(
                    student_id=student.student_id,
                    preferred_student_id=target.student_id,
                )
            )

    db.session.commit()

    print("Seed completed successfully!")
    print("Admin login: admin@university.ac.ke / adminpassword")
    print("Resident advisor login: ra.a@university.ac.ke / raApassword (Block A)")
    print("Resident advisor login: ra.b@university.ac.ke / raBpassword (Block B)")
    print("Resident advisor login: ra.c@university.ac.ke / raCpassword (Block C)")
    print("Student login password (all 12): StudentPass123!")
    print("Students seeded: 12 approved students with preferences + 3 recommendations each")
    print("Profile photos and verification documents created under backend/uploads/")
    print("Assignments seeded: 0 (all students remain unassigned)")
