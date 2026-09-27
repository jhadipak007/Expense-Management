#!/usr/bin/env bash
# Stop Expense Sarathi. Data in db/ is kept.
set -euo pipefail
cd "$(dirname "$0")/.."
docker compose down
echo "Expense Sarathi stopped."
