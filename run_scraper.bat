@echo off
title SocialEye FB Scraper
set PYTHONIOENCODING=utf-8
set PYTHONUNBUFFERED=1
rem %~dp0 คือโฟลเดอร์ที่ไฟล์นี้อยู่ (มี \ ปิดท้าย) — path จึงเดินตาม checkout
rem ไม่ต้องแก้ทุกครั้งที่ย้ายเครื่อง
cd /d "%~dp0backend"

:loop
echo [%date% %time%] Starting SocialEye Facebook Group Scraper... >> scraper_run.log
"%~dp0backend\.venv\Scripts\python.exe" -u fb_group_scraper.py >> scraper_run.log 2>> scraper_err.log
echo [%date% %time%] Scraper exited (code %errorlevel%) - restarting in 15s... >> scraper_run.log
timeout /t 15 /nobreak >nul
goto loop
