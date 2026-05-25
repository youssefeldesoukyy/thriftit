@echo off
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
  echo Install Node.js from https://nodejs.org then run this again.
  pause
  exit /b 1
)

echo.
echo  [1] Starting site server on http://localhost:5173
echo  [2] Keep the "ThriftIt Server" window OPEN
echo  [3] Backend must run on http://localhost:4000 BEFORE npm start
echo  [4] npm start proxies /api to :4000 — do not open HTML as file://
echo.

start "ThriftIt Server" cmd /k npm start
timeout /t 4 /nobreak >nul
start http://localhost:5173/seller.html

echo Opened seller page in your browser.
echo If the page is blank, wait a few seconds and refresh.
pause
