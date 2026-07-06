# Deployment Plan

This document defines minimum deployment readiness for the Hostel Harmony project.

## 1. Pre-Deployment Checklist
- Backend tests pass: `pytest backend/tests -q`
- Frontend build succeeds: `npm run build` in `frontend/`
- Environment variables are configured in hosting platform secrets.
- Database schema applied using `backend/schema.sql`.
- Production secrets are not committed to git.
- SMTP credentials are valid (required for allocation and auth emails).
- Seed/demo data (if used) is regenerated with `backend/seed.py` after schema reset.

## 2. Backend Deployment Options

### Option A: VPS / VM (Recommended for Flask + Postgres)
- Provision Ubuntu server.
- Install Python 3.12+, Nginx, and PostgreSQL.
- Create service user and clone repository.
- Create backend venv and install requirements.
- Configure Gunicorn service:
  - `gunicorn "app:create_app()" --workers 3 --bind 127.0.0.1:5000`
- Reverse-proxy with Nginx.
- Enable HTTPS via Let's Encrypt.

### Option B: Render / Railway / Fly.io
- Configure backend as Python web service.
- Start command should run app through Gunicorn.
- Add all environment variables in platform dashboard.

## 3. Frontend Deployment Options

### Option A: Vercel / Netlify
- Build command: `npm run build`
- Publish directory: `dist`
- Set `VITE_API_BASE_URL` to deployed backend URL.

### Option B: Serve via Nginx
- Build frontend: `npm run build`
- Serve static files from `frontend/dist`.

## 4. Required Environment Variables

### Backend
- `SECRET_KEY`
- `JWT_SECRET_KEY`
- `DATABASE_URL`
- `FRONTEND_URL`
- `FRONTEND_VERIFY_EMAIL_URL`
- `EMAIL_VERIFY_TOKEN_EXPIRES_MINUTES`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USERNAME`
- `SMTP_PASSWORD`
- `SMTP_SENDER`
- `SMTP_USE_TLS`
- `PASSWORD_RESET_TOKEN_EXPIRES_MINUTES`

### Frontend
- `VITE_API_BASE_URL`

## 5. Database Migration Strategy
- Source of truth schema: `backend/schema.sql`
- For existing environments, run ALTER statements carefully before release.
- Always back up DB before schema changes.

## 6. Production Hardening Tasks
- Replace Flask dev server with Gunicorn/Uvicorn workers.
- Replace in-memory Flask-Limiter storage with Redis.
- Enable centralized logging.
- Add health-check endpoint and uptime monitoring.
- Enable daily DB backups.

## 7. Allocation and Notification Runtime Notes
- Allocation confirmation now sends student email notifications after DB commit.
- Notification details include semester, room block/number, assignment status, roommate, and compatibility score where available.
- Allocation API responses include `notifications_sent` and `notification_failures`; monitor these in backend logs/metrics.
- Matching order at runtime:
  - waiting students (`awaiting_roommate`) are matched first
  - remaining fresh pool applies mutual preferred-roommate priority, then weighted graph matching

## 8. Post-Deploy Smoke Checks
- Run allocation preview and approval from admin dashboard.
- Verify pending queue tabs (verification, stay-date requests) paginate and badge counts remain accurate.
- Confirm at least one approved allocation produces an outgoing email and no SMTP errors.
- Check assignment undo and conflict endpoints still behave as expected.

## 9. Rollback Plan
- Keep previous backend image/release available.
- Keep DB snapshots before migration.
- Roll back app version first, then DB only if required.
