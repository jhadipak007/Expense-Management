# Stop Expense Sarathi. Data in db/ is kept.
Set-Location (Join-Path $PSScriptRoot '..') -ErrorAction Stop
docker compose down
Write-Host 'Expense Sarathi stopped.'
