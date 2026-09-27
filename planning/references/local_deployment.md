# Expense Sarathi - Local Deployment

How to build, run, test and troubleshoot the app on a developer machine with Docker Compose and SQLite.

Related: [aws_deployment.md](aws_deployment.md) (production), [configuration.md](configuration.md) (settings), [database.md](database.md) (migrations), [testing.md](testing.md).

## 1. What runs locally

```
Browser ──http://localhost:8080──> Docker container "app"
                                     ├─ uvicorn + FastAPI
                                     │    ├─ /api/*       -> API routes
                                     │    └─ everything else -> built frontend (index.html fallback)
                                     └─ SQLite file  <── bind mount ── ./db/ on the host
```

- One container. FastAPI serves both the API and the built React app on one origin.
- The SQLite file lives in the git-ignored `db/` folder on the host, so data survives container rebuilds.
- AWS Lambda Web Adapter is copied into the image but does nothing outside Lambda.

## 2. Prerequisites

| Tool | Why | Check |
|---|---|---|
| Git | Clone the repo | `git --version` |
| Docker Desktop (Compose v2) | Build and run the container | `docker compose version` |
| `openssl` (Git Bash on Windows includes it) | Generate a local JWT secret | `openssl version` |
| Optional: `uv`, Node.js 22 LTS | Run tests or dev servers outside Docker | `uv --version`, `node --version` |

Windows only: allow local PowerShell scripts once with `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.

## 3. Files involved

| File | Purpose |
|---|---|
| `Dockerfile` | Multi-stage build: frontend build, then Python app image |
| `docker-compose.yml` | Runs the `app` service locally (and an optional `postgres` service) |
| `.env.example` | Committed template of every setting |
| `.env` | Git-ignored local values, created from `.env.example` |
| `db/` | Git-ignored SQLite folder, mounted into the container |
| `scripts/start_mac.sh`, `scripts/start_windows.ps1` | Build, start, wait until healthy, print the URL |
| `scripts/stop_mac.sh`, `scripts/stop_windows.ps1` | Stop the app |
| `.gitattributes` | `*.sh text eol=lf` so shell scripts keep Unix line endings on Windows |

### Dockerfile (outline)

```dockerfile
# Stage 1: build the frontend
FROM node:22-alpine AS frontend
WORKDIR /frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: backend image (used locally and on Lambda)
FROM python:3.13-slim
# Lambda Web Adapter: inactive locally, translates Lambda events on AWS. Pin the latest release.
COPY --from=public.ecr.aws/awsguru/aws-lambda-adapter:0.9.1 /lambda-adapter /opt/extensions/lambda-adapter
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

WORKDIR /app
ENV PATH="/app/.venv/bin:$PATH" \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    PORT=8080 \
    FRONTEND_DIST_DIR=/app/frontend_dist

COPY backend/pyproject.toml backend/uv.lock ./
RUN uv sync --locked --no-dev --no-install-project
COPY backend/ ./
RUN uv sync --locked --no-dev
COPY --from=frontend /frontend/dist ./frontend_dist

EXPOSE 8080
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
```

Notes:
- Port 8080 is used everywhere because it is Lambda Web Adapter's default.
- The image `CMD` does **not** run migrations. Locally, Compose runs them before uvicorn. On AWS they are a separate deploy step.

### docker-compose.yml (outline)

```yaml
services:
  app:
    build: .
    image: expense-sarathi:local
    ports:
      - "8080:8080"
    env_file: .env
    volumes:
      - ./db:/app/db
    command: sh -c "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8080"
    healthcheck:
      test: ["CMD", "python", "-c", "import urllib.request; urllib.request.urlopen('http://localhost:8080/api/health')"]
      interval: 5s
      timeout: 3s
      retries: 20

  postgres:                      # only for the release check, started with --profile postgres
    image: postgres:17
    profiles: ["postgres"]
    environment:
      POSTGRES_USER: expense
      POSTGRES_PASSWORD: expense
      POSTGRES_DB: expense_sarathi
    ports:
      - "5432:5432"
```

## 4. First-time setup

1. **Clone the repository.**
   ```bash
   git clone <repo-url> "Expense Tracker"
   cd "Expense Tracker"
   ```
2. **Create `.env` from the template.**
   ```bash
   cp .env.example .env            # PowerShell: Copy-Item .env.example .env
   ```
3. **Set a local JWT secret** in `.env`:
   ```bash
   openssl rand -hex 32            # paste the output as JWT_SECRET=...
   ```
4. **Check the local values in `.env`:**
   ```dotenv
   ENVIRONMENT=local
   USE_POSTGRESQL_DB=false
   SQLITE_PATH=db/expense_sarathi.db
   JWT_SECRET=<generated value>
   COOKIE_SECURE=false
   ALLOWED_HOSTS=["localhost","127.0.0.1"]
   ENABLE_API_DOCS=true
   LOG_LEVEL=DEBUG
   ```
   `COOKIE_SECURE=false` is required locally because `http://localhost` is not HTTPS; otherwise the browser drops the refresh cookie.
5. **Make sure the `db/` folder exists** (the start script creates it if missing). It must stay git-ignored.

## 5. Start the app

Run the start script from the project root:

```bash
./scripts/start_mac.sh                  # macOS / Linux
.\scripts\start_windows.ps1             # Windows PowerShell
```

What the start script does, in order:
1. Checks that Docker is running (`docker info`); exits with a clear message if not.
2. Checks that `.env` exists; if not, tells the user to create it from `.env.example` and exits.
3. Creates `db/` if it is missing.
4. Runs `docker compose up -d --build`, which:
   1. builds the frontend in the Node stage,
   2. installs the backend dependencies with `uv sync --locked`,
   3. starts the container,
   4. runs `alembic upgrade head` against the SQLite file (creates tables, seeds categories),
   5. starts uvicorn on port 8080.
5. Waits until the container health check reports `healthy` (polls `docker compose ps`), with a timeout of about 60 seconds. On timeout it prints `docker compose logs app` and exits with an error.
6. Prints the URL: `Expense Sarathi is running at http://localhost:8080`.

## 6. Verify

1. `http://localhost:8080/api/health` returns `{"status": "ok"}`.
2. `http://localhost:8080` shows the login page.
3. Register a user, log in, add an expense and see it in the list.
4. Reload a deep link such as `http://localhost:8080/reports`; the app loads (index.html fallback works).
5. `http://localhost:8080/docs` shows the API docs (enabled locally only).
6. Stop and start again; the expense is still there (data persisted in `db/`).

## 7. Day-to-day operations

| Task | Command |
|---|---|
| Stop the app | `./scripts/stop_mac.sh` or `.\scripts\stop_windows.ps1` (runs `docker compose down`) |
| Follow logs | `docker compose logs -f app` |
| Rebuild after code changes | Run the start script again (it always uses `--build`) |
| Open a shell in the container | `docker compose exec app sh` |
| Create a migration | `cd backend && uv run alembic revision --autogenerate -m "<message>"`, then review the file |
| Apply migrations | Happens automatically on start; manually: `docker compose exec app alembic upgrade head` |
| Reset the local database | Stop the app, delete `db/expense_sarathi.db`, start again |
| Back up the local database | Stop the app and copy `db/expense_sarathi.db` |

## 8. Development mode (hot reload, optional)

For fast frontend/backend iteration without rebuilding the image:

1. Backend: `cd backend && uv sync && uv run alembic upgrade head && uv run uvicorn app.main:app --reload --port 8000`
2. Frontend: `cd frontend && npm install && npm run dev`
3. `vite.config.js` proxies `/api` to `http://localhost:8000`, so the browser still sees one origin (`http://localhost:5173`) and cookies work.
4. Add `localhost` to `ALLOWED_HOSTS` (already in the local defaults).

## 9. Tests and release check

1. Backend tests on SQLite: `cd backend && uv run pytest`
2. Frontend tests: `cd frontend && npm test`
3. End-to-end tests against the running container: start the app, then `cd frontend && npx playwright test`
4. **Release check against PostgreSQL** (required before every release):
   ```bash
   docker compose --profile postgres up -d postgres
   cd backend
   USE_POSTGRESQL_DB=true DB_HOST=localhost DB_PORT=5432 DB_NAME=expense_sarathi \
   DB_USER=expense DB_PASSWORD=expense uv run pytest
   docker compose --profile postgres down
   ```
   PowerShell: set each variable with `$env:NAME="value"` before `uv run pytest`.

## 10. Troubleshooting

| Symptom | Cause and fix |
|---|---|
| `port is already allocated` | Something else uses 8080. Stop it, or change the host port in `docker-compose.yml` (`"8081:8080"`). |
| Logged out after every reload | `COOKIE_SECURE=true` locally. Set it to `false` in `.env`. |
| `400 Invalid host header` | The host you used is not in `ALLOWED_HOSTS`. |
| Script fails with `\r: command not found` | The `.sh` file has Windows line endings. Check `.gitattributes`, then re-checkout the file. |
| PowerShell refuses to run the script | Set the execution policy (see section 2). |
| Database locked or corrupted | Stop the app, delete `db/expense_sarathi.db`, start again (local data is lost). |
