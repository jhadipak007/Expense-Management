# Expense Tracker Project - Expense Sarathi

## Overview

Expense Sarathi is an application for recording and reviewing personal expenses.

It tracks spending in three categories (as of now):

- **Grocery**: day-to-day household purchases
- **Eating Out**: restaurants, cafes, and food delivery
- **Trips**: travel, stays, and other trip-related costs

## Development process

When instructed to build a feature:
1. Use your Atlassian tools to read the feature instructions from Jira
2. Read planning/architecture_plan.md before designing or writing any code. For deployment or infrastructure tasks, also read planning/deployment_architecture.md
3. Develop the feature - do not skip any step from the feature-dev 7 step process
4. Thoroughly test the feature with unit tests and integration tests and fix any issues
5. Submit a PR using your github tools
6. Update the Implementation Status section of this file: update the summary and add or update your feature's status line

Jira project key: EM

## Technical design

The backend should be in backend/ and be a uv project, using FastAPI. 
The frontend should be in frontend/  
- The backend runs as a single container image, used both locally and on AWS Lambda.
  The image starts FastAPI with uvicorn; in production, AWS Lambda Web Adapter translates Lambda events into HTTP requests. Do not use Mangum.
- The database is selected by `USE_POSTGRESQL_DB`:
  - unset or `false`: SQLite (local development and automated tests)
  - `true`: PostgreSQL (AWS RDS in production)
- Keep database code dialect-neutral: use SQLAlchemy only, with no PostgreSQL- or SQLite-specific SQL.
- Before a release, run the tests once against a local PostgreSQL container with `USE_POSTGRESQL_DB=true`.
- Local run: `docker compose up` starts the backend container with the SQLite file on a volume mounted from `db/` in the project root (git-ignored); FastAPI also serves the built frontend.
The frontend is statically exported. In local dev FastAPI serves it; in production S3 + CloudFront serve it. Either way the API and the app share one origin. 
The frontend is a React + Vite project.
use `uv` as Python package manager. Always `uv run xxx` never `python3 xxx`. Always `uv add xxx` never `pip install xxx`
- Data layer: SQLAlchemy 2.0 + Alembic migrations.
- API routes live under `/api`.
- Multi-user with login; each user sees only their own expenses.
- Multi-currency: each expense stores a currency code; totals are grouped by currency (no conversion).

Detailed application architecture: see `planning/architecture_plan.md`.


## Color Scheme
Base:
- Primary Blue: `#3a78b5` (all buttons and links)
- Accent Amber: `#e6b340` (small highlights and badges only)
- Deep Navy: `#1c2b3f` (headings)
- Slate Gray: `#556270` (body text)
- Background: `#f6f7f9`
- Cards: `#ffffff`
- Borders: `#e4e7eb`

Categories:
- Grocery: Olive Green `#8aa84a`
- Eating Out: Soft Orange `#e08e5a`
- Trips: Sea Green `#3a9e84`

Status:
- Error / over budget: Warm Red `#d0584c`
- Success: Sea Green `#3a9e84`

## Deployment Architecture
- AWS CloudFront is the CDN and single origin: `/api/*` routes to API Gateway -> Lambda; everything else to S3 (static Vite build).
- Backend: the same container image as local, pushed to Amazon ECR and deployed to AWS Lambda with AWS Lambda Web Adapter.
- Database: AWS RDS for PostgreSQL (`USE_POSTGRESQL_DB=true` in production).
- Lambda runs in the VPC to reach RDS; secrets live in AWS Secrets Manager.
- Alembic migrations run as a separate deploy step.

Detailed deployment architecture: see `planning/deployment_architecture.md`.

## Kanban workflow:
- Pick the top issue from "To Do" unless told a specific key
- Move it to "In Progress" when starting
- Move it to "Done" when the PR is merged; add the PR link as a comment


## Implementation Status
Update this section in the same PR as the feature.

### Summary of completed work
Describes what the application can do today, from the user's point of view.

Rules:
- Include only features merged into main.
- Write at most 5 bullet points, one per functional area (e.g. Auth, Expenses, Reports).
- Each bullet says what works, not how it was built. No file names, no class names.

How to update when your feature is done:
1. If your feature belongs to an existing area, edit that area's bullet to include it.
2. If it is a new area, add a new bullet.
3. If there are now more than 5 bullets, merge the most closely related ones.

Example:
- Auth: users can register, log in, and log out; each user sees only their own data.
- Expenses: users can add, edit, and delete expenses with date, amount, currency, category, and note.

Current summary:
- Nothing implemented yet.

### Latest status
One line per Jira issue, newest first:
`<JIRA-KEY> — <done / in progress / blocked> — <YYYY-MM-DD HH:MM> — <one-line summary> — PR #<n>`
Only add or edit the line for your own feature.

- None yet.
