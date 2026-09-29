# Expense Tracker Project - Expense Sarathi

## Overview

Expense Sarathi is an application for recording and reviewing personal and family expenses.

It tracks spending in three categories (as of now):

- **Grocery**: day-to-day household purchases
- **Eating Out**: restaurants, cafes, and food delivery
- **Trips**: travel, stays, and other trip-related costs

## Intended Development process

When instructed to build a feature:
1. Use your Atlassian tools to read the feature instructions from Jira
2. Read @planning/architecture_plan.md before designing or writing any code. For deployment or infrastructure tasks, also read `planning/deployment_architecture.md`
3. Develop the feature - do not skip any step from the feature-dev 7 step process which is provided to you as a plugin.
4. Run tests that cover the changed behavior, including relevant unit and integration tests where they exist. Add or update tests for new behavior and fix failures. Do not require unrelated test suites for a change.
5. Submit a PR using your github tools

Jira project key: EM

## Git workflow
Applies to every change related to feature implementation or bug fixes:
- Never edit files on `main`. Before the first edit, update `main` and create a branch: `git checkout -b <type>/<short-name>` (e.g. `feature/EM-12-add-expense`, `docs/api-design`, `fix/login-timeout`).
- Commit on that branch, push it, and open a PR to `main`.
- Merge a PR only when explicitly asked.

## Intended Technical design

These are the intended architecture and implementation constraints for the project.

### Backend
- The backend lives in `backend/`, uses FastAPI, and is managed as a `uv` project.
- Use `uv run` to run Python commands and `uv add` to add dependencies; do not use `python3` or `pip install` directly.
- Use `pydantic-settings` to read configuration (including database URLs and secrets) from environment variables and the local git-ignored `.env` file. Define one `Settings` class and do not read `os.environ` directly.
- API routes live under `/api`.
- The backend runs as one container image locally and on AWS Lambda. The image starts FastAPI with uvicorn. In production, AWS Lambda Web Adapter translates Lambda events into HTTP requests. Do not use Mangum.
- Use SQLAlchemy 2.0 and Alembic migrations. Keep database code dialect-neutral and avoid PostgreSQL- or SQLite-specific SQL.
- Select the database with `USE_POSTGRESQL_DB`:
  - Unset or `false`: SQLite for local development and automated tests.
  - `true`: PostgreSQL for AWS RDS in production.
- Support multiple users with login. Users can create families and invite others; a user can belong to multiple families.
- Each expense is either personal (visible only to its recorder) or shared with one family (visible to all its members, including in reports).
- Store a currency code on each expense and group totals by currency without conversion.

### Frontend
- The frontend lives in `frontend/` and uses React + Vite.
- Build all UI with shadcn/ui components and Tailwind CSS; do not use CSS Modules. Run the shadcn CLI from `frontend/`.
- Build the frontend as static assets. Locally, FastAPI serves the built assets; in production, S3 and CloudFront serve them. The API and app share one origin.

### Local development
- The SQLite database file is stored in the git-ignored `db/` directory in the project root and mounted into the backend container.
- FastAPI serves the built frontend during local runs.
- Start and stop scripts live in `scripts/` and wrap `docker compose`:
  - Mac: `start_mac.sh` and `stop_mac.sh` (bash)
  - Windows: `start_windows.ps1` and `stop_windows.ps1` (PowerShell)
  - Start builds and runs the app in the background and prints the local URL; stop shuts it down.

### Release checks
- Before a release, run the test suite against a local PostgreSQL container with `USE_POSTGRESQL_DB=true`.

Detailed application architecture: see @planning/architecture_plan.md.


## Intended Deployment Architecture
- AWS CloudFront is the CDN and single origin: `/api/*` routes to API Gateway -> Lambda; everything else to S3 (static Vite build).
- Backend: the same container image as local, pushed to Amazon ECR and deployed to AWS Lambda with AWS Lambda Web Adapter.
- Database: AWS RDS for PostgreSQL (`USE_POSTGRESQL_DB=true` in production).
- Lambda runs in the VPC to reach RDS; secrets live in AWS Secrets Manager.
- Alembic migrations run as a separate deploy step.

Detailed deployment architecture: see `planning/deployment_architecture.md`.

## Kanban workflow:
- Pick the issue from JIRA project key (EM) as instructed.
- Move it to "In Progress" when starting
- After the PR is merged, move the Jira issue to "Done" and add the PR link as a comment.

## Implementation Updates:
- After finishing each Jira issue, always add a detailed document to `dataflow/` that describes the implementation changes and the resulting data flow.

## Key learnings
Record important lessons here as you discover them, one short bullet each. Add only points worth remembering for future work.

## Personal progress tracking

All personal feature progress shuld be tracked in a file planning/progress.local.md. If such file doesn't exist create it in the planning/ directory. 

@planning/progress.local.md

Update planning/progress.local.md when you finish a feature, or when I ask.
Format: one line per Jira issue, newest first. If the issue already has a line, update it instead of adding a new one.
`<JIRA-KEY> — <done / in progress / blocked> — <YYYY-MM-DD HH:MM> — <one-line summary> — PR #<n>`