@echo off
setlocal
cd /d "%~dp0..\.."
node ops\video\assemble.mjs > "%~dp0assemble.log" 2>&1
echo assemble exit %ERRORLEVEL%
type "%~dp0assemble.log" | findstr /v /c:"frame=" /c:"size="
call "%~dp0verify-video.cmd"
endlocal
