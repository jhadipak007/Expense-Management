#!/usr/bin/env bash
# Build and start Expense Sarathi in Docker, wait until healthy, print the URL.
set -euo pipefail
cd "$(dirname "$0")/.."

if ! docker info >/dev/null 2>&1; then
  echo "Docker is not running. Start Docker Desktop and try again." >&2
  exit 1
fi
if [ ! -f .env ]; then
  echo "Missing .env. Create it with: cp .env.example .env (then set JWT_SECRET)." >&2
  exit 1
fi
mkdir -p db

docker compose up -d --build

echo "Waiting for the app to become healthy..."
for _ in $(seq 1 60); do
  status=$(docker inspect --format '{{.State.Health.Status}}' "$(docker compose ps -q app)")
  if [ "$status" = "healthy" ]; then
    echo "Expense Sarathi is running at http://localhost:8080"
    exit 0
  fi
  sleep 1
done

echo "The app did not become healthy in time. Recent logs:" >&2
docker compose logs --tail 50 app >&2
exit 1
