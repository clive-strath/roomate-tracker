import os
from datetime import timedelta
from dotenv import load_dotenv

load_dotenv()

class Config:
    SECRET_KEY                    = os.getenv("SECRET_KEY")
    SQLALCHEMY_DATABASE_URI       = os.getenv("DATABASE_URL")
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS     = {
        "pool_pre_ping": True,
        "pool_recycle":  300,
        "connect_args": {
            "sslmode": "prefer",
            "connect_timeout": 10
        }
    }
    JWT_SECRET_KEY                = os.getenv("JWT_SECRET_KEY")
    JWT_ACCESS_TOKEN_EXPIRES      = timedelta(
        hours=int(os.getenv("JWT_ACCESS_TOKEN_EXPIRES_HOURS", 24))
    )
    CORS_ORIGINS                  = os.getenv("FRONTEND_URL", "http://localhost:5173")
    PASSWORD_RESET_TOKEN_EXPIRES_MINUTES = int(os.getenv("PASSWORD_RESET_TOKEN_EXPIRES_MINUTES", 30))
    FRONTEND_RESET_PASSWORD_URL   = os.getenv("FRONTEND_RESET_PASSWORD_URL", "http://localhost:5173/reset-password")

    SMTP_HOST                     = os.getenv("SMTP_HOST", "smtp.gmail.com")
    SMTP_PORT                     = int(os.getenv("SMTP_PORT", 587))
    SMTP_USERNAME                 = os.getenv("SMTP_USERNAME")
    SMTP_PASSWORD                 = os.getenv("SMTP_PASSWORD")
    SMTP_SENDER                   = os.getenv("SMTP_SENDER", os.getenv("SMTP_USERNAME", ""))
    SMTP_USE_TLS                  = os.getenv("SMTP_USE_TLS", "true").lower() == "true"
