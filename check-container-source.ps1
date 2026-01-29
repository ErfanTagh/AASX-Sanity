# PowerShell script to check Docker container source locations

Write-Host "=== Checking Docker Containers ===" -ForegroundColor Cyan

# Check if containers are running
Write-Host "`n1. Running Containers:" -ForegroundColor Yellow
docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}"

Write-Host "`n2. Inspecting Container Volumes:" -ForegroundColor Yellow
$containers = docker ps --format "{{.Names}}"
foreach ($container in $containers) {
    Write-Host "`n--- Container: $container ---" -ForegroundColor Green
    docker inspect $container --format='{{range .Mounts}}{{.Source}} -> {{.Destination}}{{println}}{{end}}'
}

Write-Host "`n3. Full Container Details (JSON):" -ForegroundColor Yellow
Write-Host "Run: docker inspect <container-name>" -ForegroundColor Gray
Write-Host "Or: docker inspect <container-name> | ConvertFrom-Json | Select-Object -ExpandProperty Mounts" -ForegroundColor Gray

Write-Host "`n4. Check docker-compose.yml:" -ForegroundColor Yellow
Write-Host "The volumes section shows host -> container mappings" -ForegroundColor Gray
