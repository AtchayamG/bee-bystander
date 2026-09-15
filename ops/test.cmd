@echo off
setlocal
echo === Testing Bystander Consent Layer ===
cd /d "%~dp0..\services\bystander"
call npm.cmd test
if %ERRORLEVEL% neq 0 (
    echo [FAIL] Bystander service tests failed!
    exit /b %ERRORLEVEL%
)

echo.
echo === Typechecking and Building Surface Web App ===
cd /d "%~dp0..\apps\surface"
call npm.cmd run build
if %ERRORLEVEL% neq 0 (
    echo [FAIL] Surface build failed!
    exit /b %ERRORLEVEL%
)

echo.
echo === ALL SUITES GREEN ===
exit /b 0
endlocal
