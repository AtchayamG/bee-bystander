@echo off
setlocal
cd /d "%~dp0..\apps\surface"
call npm.cmd run dev
endlocal
