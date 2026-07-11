@echo off
title TVS LP-46 Print Service
echo ========================================
echo Starting TVS LP-46 Print Service
echo ========================================
echo.

cd /d %~dp0

echo Installing dependencies (first time only)...
call npm install

echo.
echo Starting print service...
echo.

node server.js

pause