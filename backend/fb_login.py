# -*- coding: utf-8 -*-
r"""เปิด Chromium แบบเห็นหน้าต่าง ให้ล็อกอิน Facebook ด้วยมือ แล้วเซฟ session

รัน:  .venv\Scripts\python.exe backend\fb_login.py

ใช้เมื่อหน้า admin ขึ้นสถานะ needs_login หรือ down พร้อม last_status เป็น
session_expired / login_failed — คือ Facebook เตะ scraper ออกแล้ว

ไม่ต้องมี FB_EMAIL/FB_PASSWORD ใน .env: รหัสผ่านพิมพ์ในหน้าต่าง browser เท่านั้น
สคริปต์นี้ไม่อ่านและไม่บันทึกรหัสผ่านที่ไหนเลย เก็บเฉพาะ cookie ของ session

สำคัญ — ต้องหยุด scraper ก่อนรันสคริปต์นี้ แล้วค่อยเปิดใหม่หลังเสร็จ:

    1. ปิดหน้าต่าง/process ของ scraper ให้หมด
    2. รันสคริปต์นี้ แล้ว login
    3. เปิด scraper ใหม่ด้วย run_scraper_hidden.vbs

ถ้าไม่หยุดก่อน process เดิมจะยังถือ session ที่ตายแล้วไว้ในหน่วยความจำ แล้ว
วนเจอ SessionLost ต่อไปเรื่อย ๆ — และ process ที่รันอยู่ก็จะไม่เห็นไฟล์ใหม่นี้
จนกว่าจะเริ่มใหม่อยู่ดี
"""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import importlib.util                                    # noqa: E402

_HERE = Path(__file__).resolve().parent
_spec = importlib.util.spec_from_file_location("fbs", _HERE / "fb_group_scraper.py")
fbs = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(fbs)

WAIT_MINUTES = 15
STABLE_CHECKS = 3    # ต้องผ่านติดกัน 3 ครั้ง กัน state ครึ่ง ๆ ระหว่าง redirect


async def main() -> int:
    try:
        from playwright.async_api import async_playwright
    except ImportError:
        print("❌ ไม่มี playwright ใน venv นี้")
        return 1

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(
            headless=False,
            args=[
                "--disable-blink-features=AutomationControlled",
                "--no-sandbox",
                "--disable-dev-shm-usage",
                "--disable-extensions",
                "--no-first-run",
            ],
        )
        ctx_args = {
            "viewport": {"width": 1280, "height": 900},
            "user_agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36"
            ),
        }
        if fbs.SESSION_FILE.exists():
            print(f"📂 มี {fbs.SESSION_FILE.name} อยู่แล้ว — ลองใช้ก่อน")
            ctx_args["storage_state"] = str(fbs.SESSION_FILE)

        ctx = await browser.new_context(**ctx_args)
        page = await ctx.new_page()
        await page.goto("https://www.facebook.com/", wait_until="domcontentloaded")
        await asyncio.sleep(4)

        if await fbs.is_logged_in(page):
            print("✅ session เดิมยัง login อยู่ — เซฟทับแล้วจบ")
        else:
            print("=" * 64)
            print("🖥  หน้าต่าง Chromium เปิดแล้ว — กรุณา login Facebook ในหน้าต่างนั้น")
            print("   มี checkpoint / 2FA ก็ทำให้เสร็จในหน้าต่างเดียวกัน")
            print(f"   รอสูงสุด {WAIT_MINUTES} นาที แล้วจะเซฟ session ให้อัตโนมัติ")
            print("=" * 64)
            sys.stdout.flush()

            hits = 0
            for elapsed in range(WAIT_MINUTES * 60):
                await asyncio.sleep(1)
                try:
                    ok = await fbs.is_logged_in(page)
                except Exception:
                    print("❌ หน้าต่าง browser ถูกปิดไปแล้ว — ยังไม่ได้เซฟ session")
                    return 1
                hits = hits + 1 if ok else 0
                if hits >= STABLE_CHECKS:
                    break
                if elapsed % 30 == 29:
                    print(f"   ... รออยู่ ({elapsed + 1}s)")
                    sys.stdout.flush()
            else:
                print(f"⏰ ครบ {WAIT_MINUTES} นาทีแล้วยังไม่ login — ไม่ได้เซฟอะไร")
                await browser.close()
                return 1

            print("✅ ตรวจพบว่า login แล้ว")

        await asyncio.sleep(3)                    # ให้ cookie ลงตัวก่อนเซฟ
        await ctx.storage_state(path=str(fbs.SESSION_FILE))
        print(f"💾 บันทึก session → {fbs.SESSION_FILE}")

        # ยืนยันด้วย context ใหม่ที่โหลดจากไฟล์ที่เพิ่งเขียน — พิสูจน์ว่าไฟล์ใช้ได้จริง
        # ไม่ใช่แค่ browser ตัวนี้ยัง login ค้างอยู่ในหน่วยความจำ
        verify_ctx = await browser.new_context(
            viewport={"width": 1280, "height": 900},
            storage_state=str(fbs.SESSION_FILE),
        )
        verify_page = await verify_ctx.new_page()
        await verify_page.goto("https://www.facebook.com/", wait_until="domcontentloaded")
        await asyncio.sleep(4)
        good = await fbs.is_logged_in(verify_page)
        print("🔎 โหลด session จากไฟล์แล้วทดสอบซ้ำ: "
              + ("ผ่าน" if good else "ไม่ผ่าน — session ใช้ไม่ได้"))
        if good:
            print("")
            print("👉 ขั้นต่อไป: restart scraper เพื่อให้มันโหลด session ใหม่")
            print("   process ที่รันอยู่โหลด session ตั้งแต่ตอนเริ่ม จะไม่เห็นไฟล์นี้เอง")

        await browser.close()
        return 0 if good else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
