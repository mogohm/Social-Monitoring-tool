' เปิด scraper โดยไม่มี console window ปรากฏ
' อ้างอิงโฟลเดอร์ของตัวเอง ไม่ผูกกับ path เครื่องใดเครื่องหนึ่ง
Set fso = CreateObject("Scripting.FileSystemObject")
here = fso.GetParentFolderName(WScript.ScriptFullName)
Set WshShell = CreateObject("WScript.Shell")
WshShell.Run Chr(34) & here & "\run_scraper.bat" & Chr(34), 0, False
