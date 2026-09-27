# Stop Expense Sarathi. Data in db/ is kept.
$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..')
docker compose down
Write-Host 'Expense Sarathi stopped.'
