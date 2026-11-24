@echo off
setlocal
echo Starting CIMS Spring Boot Backend...
cd /d "%~dp0"

powershell -NoProfile -Command "try { [System.Net.Sockets.TcpClient]::new('127.0.0.1', 5432).Close(); exit 0 } catch { exit 1 }"
if not errorlevel 1 (
	echo PostgreSQL is already running on port 5432.
	goto :db_ready
)

echo Starting PostgreSQL container via Docker...
docker compose up -d --wait cims-postgres
if errorlevel 1 (
	echo Could not start PostgreSQL container and local port 5432 is not open.
	echo Make sure Docker Desktop is running or local PostgreSQL service is started.
	pause
	exit /b 1
)

:db_ready
powershell -NoProfile -Command "try { $response = Invoke-WebRequest -UseBasicParsing -Uri 'http://localhost:8080/api/auth/policy' -TimeoutSec 3; if ($response.StatusCode -eq 200) { exit 0 } } catch {}; exit 1"
if not errorlevel 1 (
	echo CIMS backend is already responding at http://localhost:8080
	exit /b 0
)
cd /d "%~dp0backend"
if "%SPRING_DATASOURCE_URL%"=="" set "SPRING_DATASOURCE_URL=jdbc:postgresql://127.0.0.1:5432/cims_db_dev"
call mvnw.cmd "-Dmaven.test.skip=true" spring-boot:run
if errorlevel 1 echo Backend startup failed. Check the database connection and Maven output above.
pause
