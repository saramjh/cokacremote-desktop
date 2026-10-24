@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0platform\windows\install.ps1"
if errorlevel 1 (
  echo.
  echo Manager setup is incomplete. Review the message above.
  pause
)
endlocal
