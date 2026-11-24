param(
    [string]$PostgresBin = 'C:\Program Files\PostgreSQL\17\bin'
)

$ErrorActionPreference = 'Stop'
$repoPath = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$localPath = Join-Path $repoPath '.vendelier-local'
$dataPath = Join-Path $localPath 'postgres'
$envPath = Join-Path $repoPath '.env'
$rolesPath = Join-Path $repoPath 'infrastructure/docker/postgres/init-roles.sql'
$databaseAddress = '127.0.0.1:55432'
$pgCtl = Join-Path $PostgresBin 'pg_ctl.exe'
$initDb = Join-Path $PostgresBin 'initdb.exe'
$psql = Join-Path $PostgresBin 'psql.exe'

function Invoke-PostgresCommand($Executable, $CommandArguments) {
    & $Executable @CommandArguments
    if ($LASTEXITCODE -ne 0) { throw "Error al ejecutar $([IO.Path]::GetFileName($Executable)): $LASTEXITCODE" }
}

function New-LocalSecret {
    $bytes = [byte[]]::new(32)
    $generator = [Security.Cryptography.RandomNumberGenerator]::Create()
    try { $generator.GetBytes($bytes) } finally { $generator.Dispose() }
    [BitConverter]::ToString($bytes).Replace('-', '').ToLowerInvariant()
}

foreach ($program in @($pgCtl, $initDb, $psql)) {
    if (-not (Test-Path -LiteralPath $program -PathType Leaf)) { throw "No se encontró $program. Pasa -PostgresBin con la carpeta bin de PostgreSQL." }
}

if (-not (Test-Path -LiteralPath $envPath)) {
    if (Test-Path -LiteralPath (Join-Path $dataPath 'PG_VERSION')) {
        throw 'La base local ya existe. Recupera el archivo .env que contiene sus credenciales.'
    }
    $postgresPassword = New-LocalSecret
    $migratorPassword = New-LocalSecret
    $appPassword = New-LocalSecret
    [IO.File]::WriteAllLines($envPath, [string[]]@(
        "POSTGRES_PASSWORD=$postgresPassword"
        "VENDELIER_MIGRATOR_PASSWORD=$migratorPassword"
        "VENDELIER_APP_PASSWORD=$appPassword"
        "DATABASE_URL=postgresql://vendelier_app:${appPassword}@$databaseAddress/vendelier"
        "DATABASE_MIGRATION_URL=postgresql://vendelier_migrator:${migratorPassword}@$databaseAddress/vendelier"
        "DATABASE_SHADOW_URL=postgresql://vendelier_migrator:${migratorPassword}@$databaseAddress/vendelier_shadow"
        "SESSION_SECRET=$(New-LocalSecret)"
        "DEMO_ADMIN_TOKEN=$(New-LocalSecret)"
    ))
}

$values = @{}
foreach ($line in Get-Content -LiteralPath $envPath) {
    if ($line -match '^([A-Z_]+)=(.*)$') { $values[$Matches[1]] = $Matches[2] }
}
foreach ($variable in @('POSTGRES_PASSWORD', 'VENDELIER_MIGRATOR_PASSWORD', 'VENDELIER_APP_PASSWORD', 'SESSION_SECRET', 'DEMO_ADMIN_TOKEN')) {
    if (!$values[$variable]) { throw "Falta $variable en .env para la base de demostración." }
}
foreach ($variable in @('DATABASE_URL', 'DATABASE_MIGRATION_URL', 'DATABASE_SHADOW_URL')) {
    if ($values[$variable] -notlike "*@$databaseAddress/vendelier*") { throw "$variable ya apunta a otra base. Conserva esa configuración o usa un .env para PostgreSQL local en el puerto 55432." }
}

[IO.Directory]::CreateDirectory($localPath) | Out-Null
if (-not (Test-Path -LiteralPath (Join-Path $dataPath 'PG_VERSION'))) {
    $passwordFile = New-TemporaryFile
    try {
        Set-Content -LiteralPath $passwordFile.FullName -Value $values['POSTGRES_PASSWORD'] -Encoding ascii
        Invoke-PostgresCommand $initDb @('-D', $dataPath, '--username=postgres', '--encoding=UTF8', '--locale=C', '--auth=scram-sha-256', '--pwfile', $passwordFile.FullName)
    } finally {
        Remove-Item -LiteralPath $passwordFile.FullName
    }
}

& $pgCtl status -D $dataPath | Out-Null
if ($LASTEXITCODE -ne 0) {
    Invoke-PostgresCommand $pgCtl @('start', '-D', $dataPath, '-l', (Join-Path $localPath 'postgres.log'), '-o', '-h 127.0.0.1 -p 55432', '-w')
}

$savedPassword = $env:PGPASSWORD
$savedMigrator = $env:VENDELIER_MIGRATOR_PASSWORD
$savedApp = $env:VENDELIER_APP_PASSWORD
try {
    $env:PGPASSWORD = $values['POSTGRES_PASSWORD']
    $env:VENDELIER_MIGRATOR_PASSWORD = $values['VENDELIER_MIGRATOR_PASSWORD']
    $env:VENDELIER_APP_PASSWORD = $values['VENDELIER_APP_PASSWORD']
    $psqlArguments = @('-X', '-q', '--no-password', '--host=127.0.0.1', '--port=55432', '--username=postgres', '--set=ON_ERROR_STOP=1')
    @'
SELECT 'CREATE DATABASE vendelier'
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'vendelier') \gexec
'@ | & $psql @psqlArguments --dbname=postgres
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo preparar la base vendelier.' }
    Invoke-PostgresCommand $psql ($psqlArguments + @('--dbname=vendelier', '--file', $rolesPath))
} finally {
    $env:PGPASSWORD = $savedPassword
    $env:VENDELIER_MIGRATOR_PASSWORD = $savedMigrator
    $env:VENDELIER_APP_PASSWORD = $savedApp
}

Write-Output 'PostgreSQL de demostración está disponible en 127.0.0.1:55432. Las variables locales están en .env.'
