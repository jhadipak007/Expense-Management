# Expense Sarathi

A web app for recording and reviewing personal and family expenses.

- Track spending in three categories: **Grocery**, **Eating Out** and **Trips**.
- Each user has private expenses. Users can also create families, invite others, and share expenses and reports with family members.
- Every expense has a currency; totals are grouped by currency with no conversion.

## Status

In the design phase. The architecture and plans are written; application code has not been started.

## Tech stack

| Area | Choice |
|---|---|
| Backend | FastAPI, SQLAlchemy 2.0, Alembic, managed with `uv` |
| Frontend | React + Vite |
| Database | SQLite locally, PostgreSQL (AWS RDS) in production |
| Auth | JWT access tokens with rotating refresh tokens |
| Hosting | CloudFront + S3 (frontend), API Gateway + Lambda (API) |

## Running locally (planned)

Requires Docker Desktop.

```bash
cp .env.example .env              # then set JWT_SECRET
./scripts/start_mac.sh            # Windows: .\scripts\start_windows.ps1
```

The app runs at `http://localhost:8080`. Stop it with `./scripts/stop_mac.sh` (Windows: `.\scripts\stop_windows.ps1`).

## Documentation

- [Architecture plan](planning/architecture_plan.md)
- [Deployment](planning/deployment_architecture.md): which local or AWS deployment guide to use
- Detailed designs: [planning/references/](planning/references/)
