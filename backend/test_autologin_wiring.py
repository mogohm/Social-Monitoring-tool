# -*- coding: utf-8 -*-
r"""มีรหัสใน .env แล้ว do_login ต้องลอง login จริง ไม่ใช่ยอมแพ้ตั้งแต่ต้น

รัน:  .venv\Scripts\python.exe backend\test_autologin_wiring.py

ขอบเขตของไฟล์นี้: พิสูจน์ว่า "สายไฟต่อถูก" เท่านั้น — เมื่อมีรหัส โค้ดจะเดินไป
เส้นทางกรอกฟอร์มจริง และเมื่อไม่มีรหัสจะไม่เสียเวลากรอกค่าว่างแล้วรายงานผิดว่า
เป็น checkpoint

สิ่งที่ไฟล์นี้พิสูจน์ไม่ได้คือ Facebook จะยอมรับการ login นั้นหรือไม่ ซึ่งรู้ได้
ตอน session หมดอายุจริงเท่านั้น การไปลอง login จริงเพื่อทดสอบมีความเสี่ยงที่จะ
กระตุ้น checkpoint และทำให้ session ที่ใช้งานอยู่พังไปด้วย
"""
import asyncio
import importlib.util
import os
import sys
from pathlib import Path

os.environ.setdefault("FB_GROUP_URL", "https://www.facebook.com/groups/1")

_HERE = Path(__file__).resolve().parent
_spec = importlib.util.spec_from_file_location("fbs", _HERE / "fb_group_scraper.py")
fbs = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(fbs)


class FakePage:
    """บันทึกว่าโค้ดพยายามทำอะไรกับหน้าเว็บบ้าง"""
    def __init__(self):
        self.filled = {}
        self.goto_urls = []
        self.pressed = []

    async def goto(self, url, **kw):
        self.goto_urls.append(url)

    async def query_selector(self, sel):
        return None                       # ไม่เจอปุ่ม/ช่องใด ๆ

    async def wait_for_selector(self, sel, timeout=0):
        raise Exception("not found")

    async def fill(self, sel, val):
        self.filled[sel] = val

    async def press(self, sel, key):
        self.pressed.append((sel, key))

    async def wait_for_url(self, *a, **kw):
        raise Exception("no redirect")

    @property
    def url(self):
        return "https://www.facebook.com/login"


def main() -> int:
    failed = 0

    def check(name, got, expect):
        nonlocal failed
        ok = got == expect
        failed += 0 if ok else 1
        print(f"  {'PASS' if ok else 'FAIL'}  {name}: expected {expect}, got {got}")

    # --- ไม่มีรหัส: ต้องไม่พยายามกรอกฟอร์ม ---
    fbs.FB_EMAIL, fbs.FB_PASSWORD = "", ""
    fbs.FB_HEADLESS = True
    page = FakePage()
    result = asyncio.run(fbs.do_login(page))
    check("ไม่มีรหัส → do_login คืน False", result, False)
    check("  ไม่ไปหน้า login โดยเปล่าประโยชน์", len(page.goto_urls), 0)
    check("  ไม่กรอกฟอร์มด้วยค่าว่าง", page.filled, {})

    # --- มีรหัส: ต้องเดินเส้นทาง login จริง ---
    fbs.FB_EMAIL, fbs.FB_PASSWORD = "someone@example.com", "hunter2"
    page = FakePage()
    result = asyncio.run(fbs.do_login(page))
    check("มีรหัส → ลอง login จริง (เปิดหน้า login)",
          any("login" in u for u in page.goto_urls), True)
    check("  สุดท้ายคืน False เพราะ fake page ไม่มีฟอร์ม", result, False)

    # --- ค่าที่ใช้จริงใน .env ต้องถูกอ่านเข้ามาได้ ---
    from dotenv import dotenv_values
    env = dotenv_values(_HERE / ".env")
    check("ไฟล์ .env มี FB_EMAIL", bool((env.get("FB_EMAIL") or "").strip()), True)
    check("ไฟล์ .env มี FB_PASSWORD", bool((env.get("FB_PASSWORD") or "").strip()), True)

    total = 7
    print(f"\n{total - failed}/{total} passed")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
