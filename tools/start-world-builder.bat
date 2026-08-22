@echo off
setlocal
cd /d "%~dp0.."

echo Starting Little Realm World Builder...

REM Prefer Windows PowerShell because it is included with Windows 10/11.
if exist "%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" (
  "%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-builder.ps1"
  goto :done
)

REM Fallback for systems that only have PowerShell 7.
where pwsh >nul 2>nul
if %errorlevel%==0 (
  pwsh -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-builder.ps1"
  goto :done
)

echo.
echo Could not find Windows PowerShell or PowerShell 7.
echo Please open the builder manually with another local web server.

echo.
:done
if not "%errorlevel%"=="0" pause
endlocal
