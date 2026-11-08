# Backup / restore of the StockFlow PostgreSQL database running in Docker.
#   .\scripts\backup-db.ps1                     -> backups\stockflow-YYYYMMDD-HHMMSS.sql
#   .\scripts\backup-db.ps1 -Restore <file.sql> -> restores that file (overwrites data!)
#   -ComposeFile docker-compose.prod.yml        -> on the production server
param([string]$Restore = '', [string]$ComposeFile = 'docker-compose.yml')
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
if ($Restore) {
    if (!(Test-Path $Restore)) { throw "File not found: $Restore" }
    Get-Content -Raw -Encoding UTF8 $Restore | docker compose -f $ComposeFile exec -T db psql -U stockflow -d stockflow
    "Restored from $Restore"
} else {
    New-Item -ItemType Directory -Force backups | Out-Null
    $file = "backups\stockflow-$(Get-Date -Format yyyyMMdd-HHmmss).sql"
    docker compose -f $ComposeFile exec -T db pg_dump -U stockflow -d stockflow --clean --if-exists | Out-File -Encoding utf8 $file
    "Backup saved: $file"
}
