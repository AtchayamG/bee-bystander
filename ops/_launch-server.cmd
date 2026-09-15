@echo off
setlocal
cd /d "%~dp0..\services\bystander"
call npm.cmd start
endlocal
