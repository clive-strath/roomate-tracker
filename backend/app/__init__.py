from flask import Flask
from .config import Config
from .extensions import db, jwt, bcrypt, cors, limiter

def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    env = (app.config.get("FLASK_ENV") or "development").lower()
    if env in {"development", "dev"}:
        app.config["SECRET_KEY"] = app.config.get("SECRET_KEY") or "dev-secret"
        app.config["JWT_SECRET_KEY"] = app.config.get("JWT_SECRET_KEY") or "dev-jwt-secret"

    if env not in {"development", "dev"}:
        if not app.config.get("SECRET_KEY"):
            raise RuntimeError("SECRET_KEY must be set in non-development environments")
        if not app.config.get("JWT_SECRET_KEY"):
            raise RuntimeError("JWT_SECRET_KEY must be set in non-development environments")

    # Initialise extensions
    db.init_app(app)
    jwt.init_app(app)
    bcrypt.init_app(app)
    cors.init_app(app, resources={r"/api/*": {"origins": app.config["CORS_ORIGINS"]}})
    limiter.init_app(app)

    from .models import TokenBlocklist

    @jwt.token_in_blocklist_loader
    def is_token_revoked(jwt_header, jwt_payload):
        jti = jwt_payload.get("jti")
        if not jti:
            return False
        return TokenBlocklist.query.filter_by(jti=jti).first() is not None

    # Register blueprints
    from .routes.auth        import auth_bp
    from .routes.students    import students_bp
    from .routes.preferences import preferences_bp
    from .routes.admin       import admin_bp
    from .routes.conflicts   import conflicts_bp

    app.register_blueprint(auth_bp,        url_prefix="/api/auth")
    app.register_blueprint(students_bp,    url_prefix="/api/students")
    app.register_blueprint(preferences_bp, url_prefix="/api/preferences")
    app.register_blueprint(admin_bp,       url_prefix="/api/admin")
    app.register_blueprint(conflicts_bp,   url_prefix="/api")

    return app
