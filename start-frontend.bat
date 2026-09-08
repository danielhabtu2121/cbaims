@echo off
echo Starting CIMS Frontend...
cd /d "%~dp0frontend"
npm.cmd run dev
pause
