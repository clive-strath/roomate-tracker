import re


SPECIAL_CHAR_PATTERN = re.compile(r"[^A-Za-z0-9]")


def validate_password_policy(password):
    errors = []

    if len(password or "") < 12:
        errors.append("Password must be at least 12 characters")
    if not any(ch.islower() for ch in password or ""):
        errors.append("Password must include at least one lowercase letter")
    if not any(ch.isupper() for ch in password or ""):
        errors.append("Password must include at least one uppercase letter")
    if not any(ch.isdigit() for ch in password or ""):
        errors.append("Password must include at least one number")
    if not SPECIAL_CHAR_PATTERN.search(password or ""):
        errors.append("Password must include at least one special character")
    if any(ch.isspace() for ch in password or ""):
        errors.append("Password must not contain spaces")

    return errors
