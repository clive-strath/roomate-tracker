# Hostel Harmony: Roommate Compatibility & Allocation System

A full-stack system for collecting student roommate preferences, computing compatibility, and supporting admin-assisted room allocation with conflict tracking.

## Problem Statement
Manual hostel roommate assignment is slow, inconsistent, and often ignores lifestyle compatibility. This project improves fairness and transparency by using preference-driven matching and structured admin workflows.

## Objectives
- Collect structured roommate preference data from students.
- Calculate compatibility scores for potential roommate pairs.
- Prioritize filling partially allocated rooms before creating new solo allocations.
- Provide admin tools for preview, approve, override, and undo assignment workflows.
- Track roommate conflicts with RA/admin escalation workflow.

## Features
- Authentication and authorization (student, admin, resident advisor).
- Password policy enforcement and reset flow.
- JWT logout revocation via token blocklist.
- Student preference submission and update.
- Compatibility scoring + weighted matching.
- Allocation preview with room-capacity validation.
- Solo allocation support (`awaiting_roommate`).
- Priority matching into rooms missing one roommate.
- Assignment undo logic with conflict integrity checks.
- Conflict reporting, mediation, escalation, and disable workflows.
- CSV export reports for students and assignment summaries.

## Tech Stack
- Backend: Flask, Flask-SQLAlchemy, Flask-JWT-Extended, Flask-Bcrypt, Flask-Limiter
- Matching: networkx
- Database: PostgreSQL
- Frontend: React, Vite, Axios, React Router
- Testing: pytest (backend)

## Repository Structure
```text
roommate_comp/
├── backend/
│   ├── app/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── config.py
│   │   ├── extensions.py
│   │   └── models.py
│   ├── tests/
│   ├── requirements.txt
│   ├── schema.sql
│   ├── seed.py
│   └── run.py
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   ├── components/
│   │   ├── context/
│   │   └── pages/
│   ├── package.json
│   └── vite.config.js
├── CONTRIBUTING.md
├── DEPLOYMENT.md
└── README.md
```

## Installation & Setup

### 1. Clone
```bash
git clone https://github.com/clive-strath/roommate_tracker.git
cd roommate_comp
```

### 2. Backend Setup
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

Create `backend/.env` (example):
```env
FLASK_ENV=development
SECRET_KEY=replace-with-strong-secret
JWT_SECRET_KEY=replace-with-strong-jwt-secret
DATABASE_URL=postgresql://postgres:password@localhost:5432/postgres
FRONTEND_URL=http://localhost:5173
PASSWORD_RESET_TOKEN_EXPIRES_MINUTES=30
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=example@email.com
SMTP_PASSWORD=app-password
SMTP_SENDER=example@email.com
SMTP_USE_TLS=true
```

Apply schema:
```bash
psql postgresql://postgres:password@localhost:5432/postgres -f schema.sql
```

Optional seed:
```bash
python seed.py
```

Run backend:
```bash
python run.py
```

### 3. Frontend Setup
```bash
cd ../frontend
npm install
```

Create `frontend/.env`:
```env
VITE_API_BASE_URL=http://127.0.0.1:5000/api
```

Run frontend:
```bash
npm run dev -- --host
```

## Usage
- Open `http://localhost:5173`.
- Register/login as student to submit preferences.
- Login as admin to generate previews, approve pair/solo allocations, and manage assignments.
- Resident advisors handle assigned conflict queues.

## API Overview
Base URL: `/api`

### Auth
- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me`
- `POST /auth/logout`
- `POST /auth/forgot-password`
- `POST /auth/reset-password`

### Student & Preferences
- `GET /students/<student_id>`
- `GET /students/<student_id>/assignment`
- `POST /preferences/`
- `PUT /preferences/`
- `GET /preferences/<student_id>`

### Admin Allocation
- `GET /admin/allocation/preview`
- `POST /admin/allocation/approve-all`
- `POST /admin/allocation/approve-pair`
- `POST /admin/allocation/override`
- `PATCH /admin/allocation/assignments/<assignment_id>/undo`
- `GET /admin/allocation/assignments`

### Conflicts
- `POST /conflicts`
- `GET /conflicts`
- `PUT /conflicts/<conflict_id>` (RA)
- `PUT /conflicts/<conflict_id>/escalation` (Admin)
- `PATCH /conflicts/<conflict_id>/disable` (Admin)

## Testing
Run backend tests:
```bash
cd backend
pytest tests -q
```

## Known Limitations
- Flask dev server and in-memory rate limit storage are not production-safe defaults.
- Frontend lint still has non-blocking prop-types/hook warnings to clean up.
- Deployment pipeline is documented but not fully automated.

## Contributors
- Clive (Project Owner)
- Gabriel Kibet

## License
MIT (see [LICENSE](LICENSE)).
