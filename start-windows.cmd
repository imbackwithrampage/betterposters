@echo off
setlocal
cd /d "%~dp0"
start "" "http://127.0.0.1:7000/configure"
npm start
if errorlevel 1 pause
