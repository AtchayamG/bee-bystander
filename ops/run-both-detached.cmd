@echo off
setlocal
set "P=%~dp0.."

echo === Stopping anything already on 3002 / 5175 ===
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3002" ^| findstr LISTENING') do taskkill /F /PID %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5175" ^| findstr LISTENING') do taskkill /F /PID %%a >nul 2>&1

echo === Starting Bystander MCP backend from source ===
start "Bystander Backend" /min "%~dp0_launch-server.cmd"

echo === Starting Bystander Surface web app from source ===
start "Bystander Surface" /min "%~dp0_launch-surface.cmd"

ping -n 8 127.0.0.1 >nul
echo === Listening ports ===
netstat -ano | findstr LISTENING | findstr ":3002"
netstat -ano | findstr LISTENING | findstr ":5175"

echo === Backend status ===
curl -s -m 5 http://127.0.0.1:3002/api/status
echo.
echo === Surface page served? ===
curl -s -m 5 -o NUL -w "HTTP %{http_code}" http://127.0.0.1:5175/
echo.
echo === Protocol floor verification ===
node "%~dp0probe-protocol-version.mjs"
endlocal
