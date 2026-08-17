# Offense Tracker

React + FastAPI + SQLite offense tracking system for student discipline records.

## Features

- Dashboard KPIs for incidents, minor/major counts, active students, open cases, and high-risk students
- Incident logging with auto-generated incident numbers
- Student records by grade, section, adviser, and status
- Authenticated student portal for viewing personal offense records
- Bulk selection and deletion for incidents, students, and offenses
- Minor and major offense catalog with severity points and recommended actions
- Student offense count report with risk bands
- Monthly incident and severity reports
- SQLite persistence
- Excel `.xlsx` bulk import for student and incident records
- Automatic seed data on first run: 100 students, offense catalog, and sample incidents
- Docker Compose deployment for Hostinger VPS

## Project Structure

```text
backend/        FastAPI app and SQLite API
frontend/       React/Vite user interface served by Nginx
data/           SQLite database volume
docker-compose.yml
```

## Local Run With Docker

```bash
docker compose up --build
```

Open:

```text
http://localhost:8080
```

Backend health check:

```text
http://localhost:8080/api/health
```

## Local Development Without Docker

Backend:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Frontend:

```bash
cd frontend
npm install
VITE_API_BASE_URL=http://localhost:8000/api npm run dev
```

Open the Vite URL shown in the terminal.

## Hostinger VPS Deployment

Hostinger’s official docs currently direct Docker projects to Hostinger VPS/Docker Manager. This app is packaged for that route.

1. Create or open a Hostinger VPS that uses the Docker template.
2. Upload this project folder to the VPS or push it to a GitHub repository.
3. In hPanel, open VPS > Manage > Docker Manager.
4. Create a Docker project from this repository or upload/use `docker-compose.yml`.
5. Deploy the project.
6. Map your domain or reverse proxy to the frontend container port `8080`.
7. Keep the `data/` folder backed up. It contains the SQLite database.

Set a private portal signing key before production deployment:

```bash
export PORTAL_SECRET_KEY="replace-with-a-long-random-secret"
```

Useful commands on the VPS:

```bash
docker compose up -d --build
docker compose logs -f
docker compose down
```

## Data Notes

The database is created automatically at:

```text
data/offense_tracker.db
```

Delete that file only if you intentionally want to reset all saved records and reseed test data.

## Excel Import Format

Upload an `.xlsx` workbook from the add-student or log-incident form. The first worksheet is imported.

Student columns:

- Required: `Student No.`, `First Name`, `Last Name`, `Grade`, `Section`
- Optional: `Adviser`, `Status`

Incident columns:

- Required: `Incident Date`, `Student No.`, `Offense Code`
- Optional: `Action Taken`, `Status`, `Reported By`, `Notes`

Use `YYYY-MM-DD` for incident dates. Student numbers and offense codes must already exist before importing incidents.

## Student Portal

Open the app and choose **Student Portal**. Student credentials are generated whenever a student is saved:

- Username: Student ID / Student No.
- Password: Student ID followed by Last Name, with spaces removed

For example, student `RTS-00003` with last name `Dela Cruz` receives password `RTS-00003DelaCruz`. Passwords are stored as salted hashes. Saving changes to the Student ID or last name resets the password to the new generated value.

## API Summary

- `GET /api/students`
- `POST /api/students`
- `POST /api/students/import`
- `PUT /api/students/{id}`
- `POST /api/students/bulk-delete`
- `DELETE /api/students/{id}`
- `POST /api/student-portal/login`
- `GET /api/student-portal/me`
- `GET /api/offenses`
- `POST /api/offenses`
- `PUT /api/offenses/{id}`
- `POST /api/offenses/bulk-delete`
- `DELETE /api/offenses/{id}`
- `GET /api/incidents`
- `POST /api/incidents`
- `POST /api/incidents/import`
- `PUT /api/incidents/{id}`
- `POST /api/incidents/bulk-delete`
- `DELETE /api/incidents/{id}`
- `GET /api/reports/dashboard`
- `GET /api/reports/student-summary`
