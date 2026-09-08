@echo off
echo ==========================================
echo Starting Collateral Insurance Management System (CIMS)
echo ==========================================
start "CIMS Backend (Port 8080)" cmd /k "%~dp0start-backend.bat"
start "CIMS Frontend (Port 3000)" cmd /k "%~dp0start-frontend.bat"
echo Services are starting in separate windows...
echo Backend: http://localhost:8080
echo Frontend: http://localhost:3000
