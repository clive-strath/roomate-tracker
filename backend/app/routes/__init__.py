from functools import wraps
from flask import jsonify
from flask_jwt_extended import verify_jwt_in_request, get_jwt

def role_required(*roles):
    """
    Usage:
        @role_required("admin")
        @role_required("admin", "resident_advisor")
    """
    def wrapper(fn):
        @wraps(fn)
        def decorated(*args, **kwargs):
            verify_jwt_in_request()
            claims = get_jwt()
            user_role = claims.get("role")
            if user_role not in roles:
                return jsonify({"error": "Access denied"}), 403
            return fn(*args, **kwargs)
        return decorated
    return wrapper
