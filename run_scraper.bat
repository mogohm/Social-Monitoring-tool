@echo off
title SocialEye FB Scraper
cd /d "h:\Social Monitoring Tool"
set PYTHONIOENCODING=utf-8
echo [%date% %time%] Starting SocialEye Facebook Group Scraper...
"h:\Social Monitoring Tool\backend\.venv\Scripts\python.exe" -m backend.fb_group_scraper
echo [%date% %time%] Scraper exited.
pause
