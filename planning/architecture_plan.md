# Expense Sarathi - Architecture Plan

## Overview
Expense Sarathi is a multi-user web application for recording and reviewing personal and family expenses.

Each user logs in and, by default, can access only their own expenses. A user can also create a family and invite other users to join it. All members of a family can view and add the family's expenses and see all of its expense details and reports.

Expenses fall into three categories:
- **Grocery**: day-to-day household purchases
- **Eating Out**: restaurants, cafes, and food delivery
- **Trips**: travel, stays, and other trip-related costs

Each expense stores a currency code. Totals are grouped by currency, with no conversion.

At a high level:
- **Backend**: FastAPI (Python, managed with `uv`), SQLAlchemy 2.0 and Alembic. API routes live under `/api`.
- **Frontend**: React + Vite, built as static assets. The API and app share one origin.
- **Database**: SQLite locally and in tests; PostgreSQL (AWS RDS) in production, selected by `USE_POSTGRESQL_DB`.
- **Local run**: Docker Compose, wrapped by start/stop scripts in `scripts/`. FastAPI serves the built frontend.
- **Production**: the same backend container image runs on AWS Lambda via Lambda Web Adapter; CloudFront routes `/api/*` to API Gateway and everything else to S3.

## Project Structure
```
Expense Tracker/
├── AGENTS.md
├── README.md
├── docker-compose.yml         # local run: backend container + mounted db/
├── Dockerfile                 # one image: builds frontend, runs FastAPI with uvicorn
├── .env                       # git-ignored local settings
├── db/                        # git-ignored SQLite database file
├── planning/                  # architecture and deployment docs
├── scripts/
│   ├── start_mac.sh
│   ├── stop_mac.sh
│   ├── start_windows.ps1
│   └── stop_windows.ps1
├── backend/                   # uv project
│   ├── pyproject.toml
│   ├── uv.lock
│   ├── alembic.ini
│   ├── alembic/
│   │   └── versions/
│   ├── app/
│   │   ├── main.py            # FastAPI app, mounts /api and serves built frontend
│   │   ├── config.py          # Settings (pydantic-settings)
│   │   ├── db.py              # engine and session
│   │   ├── models/            # SQLAlchemy models: user, family, expense
│   │   ├── schemas/           # Pydantic request/response models
│   │   ├── routers/           # /api routes: auth, families, expenses, reports
│   │   └── services/          # business logic and access checks
│   └── tests/
│       ├── unit/
│       └── integration/
└── frontend/                  # React + Vite
    ├── package.json
    ├── vite.config.js         # React + Tailwind plugins, @/ alias
    ├── components.json        # shadcn/ui config (JavaScript)
    ├── jsconfig.json          # @/ -> src/ alias for editors and the shadcn CLI
    ├── index.html
    ├── e2e/                   # Playwright end-to-end tests
    └── src/                   # component tests sit next to components (*.test.jsx)
        ├── main.jsx
        ├── App.jsx
        ├── api/               # fetch wrappers for /api
        ├── pages/             # Login, Expenses, Family, Reports
        ├── components/        # app components
        │   └── ui/            # shadcn/ui components (generated, committed)
        ├── lib/utils.js       # cn() class name helper
        └── styles/            # global.css: Tailwind entry and theme tokens
```

- `backend/app` is split by layer: routers call services, and services use models.
- The production image is the same `Dockerfile` pushed to ECR. Frontend assets from `frontend/dist` go to S3.

## Data Model
Read [planning/references/data_model.md](references/data_model.md) before any task that touches database models, migrations, auth, families, expenses, or reports.

## Authentication
JWT access tokens (10 minutes) with rotating refresh tokens stored in the database. Read [planning/references/authentication.md](references/authentication.md) before any task that touches login, tokens, or protected routes.

## API Design
REST API under `/api`, authenticated by default, with Pydantic validation on every input. Read [planning/references/api_design.md](references/api_design.md) before any task that adds or changes an API endpoint.

## Frontend
React + Vite (JavaScript), React Router, shadcn/ui components styled with Tailwind CSS v4. Read [planning/references/frontend.md](references/frontend.md), including its responsive UI rules, before any frontend task.

## Database and Migrations
SQLAlchemy 2.0 ORM with typed models, relationships and derived fields; Alembic for all schema changes. Read [planning/references/database.md](references/database.md) before any task that touches models, queries or migrations.

## Configuration
One pydantic-settings `Settings` class reads environment variables and `.env`; secrets come from AWS Secrets Manager in production. Read [planning/references/configuration.md](references/configuration.md) before any task that adds or uses a setting.

## Testing
Backend: pytest with unit and integration tests on SQLite (PostgreSQL for release checks). Frontend: Vitest + React Testing Library, and Playwright for end-to-end and responsive checks. Read [planning/references/testing.md](references/testing.md) before writing or changing tests.

## Deployment
- **Frontend**: the Vite build is uploaded to a private S3 bucket and served through CloudFront. A CloudFront Function rewrites page paths to `index.html` so deep links work.
- **Backend**: the same container image used locally is pushed to Amazon ECR and runs on AWS Lambda with AWS Lambda Web Adapter (no Mangum).
- **Routing**: CloudFront is the single origin; `/api/*` goes to API Gateway and then Lambda, everything else to S3.
- **Database**: AWS RDS for PostgreSQL (`USE_POSTGRESQL_DB=true`). Lambda runs in the VPC to reach it.
- **Secrets**: database credentials and `JWT_SECRET` live in one AWS Secrets Manager secret, read at cold start through a VPC endpoint.
- **Migrations**: `alembic upgrade head` runs as a one-off ECS Fargate task (same image) before the new Lambda version takes traffic.
- **Releases**: GitHub Actions (OIDC, no stored AWS keys) tests, pushes the image, migrates, moves the Lambda alias `live`, and uploads the frontend.
- **Infrastructure**: can be created with the AWS Console, the AWS CLI or Terraform; all three are described step by step.

Details: see [planning/deployment_architecture.md](deployment_architecture.md) for deployment or infrastructure tasks.
