@echo off
setlocal
title SocialEye - ติดตั้ง autostart แบบทนรีบูต

rem ต้องรันด้วยสิทธิ์ admin: คลิกขวาที่ไฟล์นี้ แล้วเลือก "Run as administrator"
net session >nul 2>&1
if errorlevel 1 (
  echo.
  echo   [!] ต้องรันด้วยสิทธิ์ผู้ดูแลระบบ
  echo       คลิกขวาที่ install_autostart.bat แล้วเลือก "Run as administrator"
  echo.
  pause
  exit /b 1
)

set "TASK=SocialEye FB Scraper"
set "VBS=%~dp0run_scraper_hidden.vbs"
set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\SocialEye FB Scraper.lnk"

echo.
echo   จะสร้าง Scheduled Task ชื่อ "%TASK%"
echo     - เริ่มทำงานตอนเครื่องบูต ไม่ต้องรอใคร logon
echo     - รันได้แม้ไม่มีใคร login อยู่
echo     - สั่ง: wscript.exe "%VBS%"
echo.
echo   Windows จะถามรหัสผ่านของบัญชี %USERDOMAIN%\%USERNAME%
echo   เพื่อเก็บไว้แบบเข้ารหัสสำหรับรัน task นี้ (ไม่ได้เก็บเป็นข้อความธรรมดา)
echo.
pause

schtasks /create /tn "%TASK%" /tr "wscript.exe \"%VBS%\"" /sc onstart /ru "%USERDOMAIN%\%USERNAME%" /rl LIMITED /f
if errorlevel 1 (
  echo.
  echo   [!] สร้าง task ไม่สำเร็จ
  pause
  exit /b 1
)

echo.
echo   [OK] สร้าง task แล้ว
echo.

rem ถอด Startup folder ออก ไม่งั้นพอ logon จะได้ scraper ตัวที่สอง
if exist "%STARTUP%" (
  del "%STARTUP%"
  echo   [OK] ถอด shortcut ใน Startup folder ออกแล้ว ^(กันไม่ให้เปิดซ้ำสองตัว^)
) else (
  echo   [-] ไม่มี shortcut ใน Startup folder อยู่แล้ว
)

echo.
echo   ตรวจผล:
schtasks /query /tn "%TASK%" /fo list | findstr /i "TaskName Status Schedule"
echo.
echo   เสร็จแล้ว ครั้งหน้าที่เครื่องบูต scraper จะเริ่มเองโดยไม่ต้อง login
echo.
pause
