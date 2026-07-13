
' เปิด scraper โดยไม่มี console window ปรากฏ
Set WshShell = CreateObject("WScript.Shell")
WshShell.Run Chr(34) & "h:\Social Monitoring Tool\run_scraper.bat" & Chr(34), 0, False
