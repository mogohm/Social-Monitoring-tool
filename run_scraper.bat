@echo off
title SocialEye FB Scraper
set PYTHONIOENCODING=utf-8
set PYTHONUNBUFFERED=1
cd /d "h:\Social Monitoring Tool\backend"

:loop
echo [%date% %time%] Starting SocialEye Facebook Group Scraper...
"h:\Social Monitoring Tool\backend\.venv\Scripts\python.exe" -u fb_group_scraper.py >> scraper_run.log 2>> scraper_err.log
echo [%date% %time%] Scraper exited (code %errorlevel%) - restarting in 15s...
timeout /t 15 /nobreak >nul
goto loop
