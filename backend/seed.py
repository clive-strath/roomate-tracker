from app import create_app
from app.extensions import db, bcrypt
from app.models import AdminUser, Room

app = create_app()
with app.app_context():
    # Clear existing if any
    AdminUser.query.delete()
    
    # Create Admin
    admin_pw = bcrypt.generate_password_hash("adminpassword").decode("utf-8")
    admin = AdminUser(
        name="System Admin",
        email="admin@university.ac.ke",
        password=admin_pw,
        role="admin",
        status="active"
    )
    db.session.add(admin)
    db.session.commit() # commit first so we get admin_id
    
    # Create Resident Advisors for blocks A, B, and C
    resident_advisors = [
        {
            "name": "Advisor John",
            "email": "ra.a@university.ac.ke",
            "password": "raApassword",
            "hostel_block": "A",
        },
        {
            "name": "Advisor Brenda",
            "email": "ra.b@university.ac.ke",
            "password": "raBpassword",
            "hostel_block": "B",
        },
        {
            "name": "Advisor Charles",
            "email": "ra.c@university.ac.ke",
            "password": "raCpassword",
            "hostel_block": "C",
        },
    ]

    for advisor in resident_advisors:
        hashed_pw = bcrypt.generate_password_hash(advisor["password"]).decode("utf-8")
        ra = AdminUser(
            name=advisor["name"],
            email=advisor["email"],
            password=hashed_pw,
            role="resident_advisor",
            hostel_block=advisor["hostel_block"],
            status="active",
            created_by=admin.admin_id,
        )
        db.session.add(ra)

    # Seed rooms: 5 rooms per block using format Block + three-digit number
    blocks = ["A", "B", "C"]
    for block in blocks:
        for number in range(100, 105):
            room_number = f"{block}{number}"
            room = Room(
                room_number=room_number,
                hostel_block=block,
                capacity=2,
                status="empty",
            )
            db.session.add(room)

    db.session.commit()
    
    print("Seed completed successfully!")
    print("Admin login: admin@university.ac.ke / adminpassword")
    print("Resident advisor login: ra.a@university.ac.ke / raApassword (Block A)")
    print("Resident advisor login: ra.b@university.ac.ke / raBpassword (Block B)")
    print("Resident advisor login: ra.c@university.ac.ke / raCpassword (Block C)")
    print("Rooms seeded: 15 total (A100-A104, B100-B104, C100-C104)")
