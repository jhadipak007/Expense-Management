# Build and start Expense Sarathi in Docker, wait until healthy, print the URL.
$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..')

docker info *> $null
if ($LASTEXITCODE -ne 0) {
    Write-Error 'Docker is not running. Start Docker Desktop and try again.'
    exit 1
}
if (-not (Test-Path .env)) {
    Write-Error 'Missing .env. Create it with: Copy-Item .env.example .env (then set JWT_SECRET).'
    exit 1
}
New-Item -ItemType Directory -Force db | Out-Null

docker compose up -d --build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host 'Waiting for the app to become healthy...'
$container = docker compose ps -q app
for ($i = 0; $i -lt 60; $i++) {
    $status = docker inspect --format '{{.State.Health.Status}}' $container
    if ($status -eq 'healthy') {
        Write-Host 'Expense Sarathi is running at http://localhost:8080'
        exit 0
    }
    Start-Sleep -Seconds 1
}

Write-Host 'The app did not become healthy in time. Recent logs:'
docker compose logs --tail 50 app
exit 1
