import smtplib
import os
from email.message import EmailMessage


def send_email(recipient_email, subject, body):
    smtp_user = os.getenv("SMTP_USERNAME")
    smtp_password = os.getenv("SMTP_PASSWORD")
    smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_sender = os.getenv("SMTP_SENDER", smtp_user or "")
    smtp_use_tls = os.getenv("SMTP_USE_TLS", "true").lower() == "true"

    if not smtp_user or not smtp_password:
        raise RuntimeError("SMTP credentials are not configured")
    if not smtp_host or not smtp_port:
        raise RuntimeError("SMTP host/port are not configured")

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = smtp_sender
    msg["To"] = recipient_email
    msg.set_content(body)

    with smtplib.SMTP(smtp_host, smtp_port, timeout=20) as server:
        if smtp_use_tls:
            server.starttls()
        server.login(smtp_user, smtp_password)
        server.send_message(msg)


def send_allocation_email(student, room, semester, assignment_status, roommate=None, compatibility_score=None):
    roommate_line = (
        f"Roommate: {roommate.name} ({roommate.student_number})"
        if roommate is not None
        else "Roommate: Pending assignment"
    )
    score_line = (
        f"Compatibility Score: {compatibility_score}%"
        if compatibility_score is not None
        else "Compatibility Score: Not applicable yet"
    )

    status_readable = str(assignment_status).replace("_", " ").title()
    subject = f"Hostel Harmony Allocation Update - {semester}"
    body = (
        f"Hello {student.name},\n\n"
        "Your room allocation has been confirmed.\n\n"
        f"Semester: {semester}\n"
        f"Hostel Block: {room.hostel_block}\n"
        f"Room Number: {room.room_number}\n"
        f"Assignment Status: {status_readable}\n"
        f"{roommate_line}\n"
        f"{score_line}\n\n"
        "Please contact hostel administration if you notice any issue with this assignment.\n\n"
        "Regards,\n"
        "Hostel Harmony Admin"
    )

    send_email(student.email, subject, body)
