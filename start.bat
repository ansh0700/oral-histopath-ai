@echo off
echo Starting Oral Histopathology AI Analyzer...

start cmd /k "cd /d %~dp0backend && py -3.14 -m uvicorn app.main:app --host 127.0.0.1 --port 8000"
start cmd /k "cd /d %~dp0frontend && npm run dev -- --host 127.0.0.1 --port 5173"

echo Both servers starting! Open http://localhost:5173 in your browser.
