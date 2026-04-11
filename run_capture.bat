@echo off
chcp 65001 > nul
cd /d "%~dp0"

echo.
echo ========================================
echo   serenkit 캡처 도구
echo ========================================
echo.

node capture.js

echo.
pause
