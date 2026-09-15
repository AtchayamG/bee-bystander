@echo off
setlocal
echo === Stopping Bystander servers on 3002 / 5175 ===
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3002" ^| findstr LISTENING') do taskkill /F /PID %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5175" ^| findstr LISTENING') do taskkill /F /PID %%a >nul 2>&1
echo Done.
endlocal
