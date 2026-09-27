# Expense Sarathi

A web app for recording and reviewing personal and family expenses.

- Track spending in three categories: **Grocery**, **Eating Out** and **Trips**.
- Each user has private expenses. Users can also create families, invite others, and share expenses and reports with family members.
- Every expense has a currency; totals are grouped by currency with no conversion.

## Status

Login, logout and the dashboard greeting work. Registration, families, expenses and reports are next.

## Tech stack

| Area | Choice |
|---|---|
| Backend | FastAPI, SQLAlchemy 2.0, Alembic, managed with `uv` |
| Frontend | React + Vite |
| Database | SQLite locally, PostgreSQL (AWS RDS) in production |
| Auth | JWT access tokens with rotating refresh tokens |
| Hosting | CloudFront + S3 (frontend), API Gateway + Lambda (API) |

## Running locally

Requires Docker Desktop.

```bash
cp .env.example .env              # then set JWT_SECRET (openssl rand -hex 32)
./scripts/start_mac.sh            # Windows: .\scripts\start_windows.ps1
```

The app runs at `http://localhost:8080`. Log in with the local test user `test@gmail.com` / `P@ssw0rd`. Stop it with `./scripts/stop_mac.sh` (Windows: `.\scripts\stop_windows.ps1`).

## Tests

```bash
cd backend && uv run pytest       # API, on SQLite
cd frontend && npm test           # components
cd frontend && npm run e2e        # end to end, against the running app
```

## Documentation

- [Architecture plan](planning/architecture_plan.md)
- [Deployment](planning/deployment_architecture.md): which local or AWS deployment guide to use
- Detailed designs: [planning/references/](planning/references/)
