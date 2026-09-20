# -*- coding: utf-8 -*-
r"""ล็อกต้องกัน scraper ตัวที่สอง แต่ต้องไม่กันตัวเองตลอดไปเมื่อล็อกค้าง

รัน:  .venv\Scripts\python.exe backend\test_single_instance.py

ทำไมต้องมีไฟล์นี้: ตอนย้ายจาก Startup folder ไป Task Scheduler ถ้าลืมถอดอันเก่า
ทั้งสองทางจะเปิด scraper คนละตัว สองตัวเขียน .fb_seen.json ทับกันและยิง Facebook
เป็นสองเท่า ซึ่งเป็นพฤติกรรมที่เสี่ยงโดนบล็อกที่สุดเท่าที่ระบบนี้ทำได้

และล็อกที่กันเกินจริงก็อันตรายพอกัน — ถ้าเครื่องดับตอน scraper ทำงาน ไฟล์ล็อกจะ
ค้างพร้อม pid ที่ไม่มีอยู่แล้ว ถ้าโค้ดไม่ยอมเขียนทับ scraper จะไม่มีวันเริ่มอีกเลย
"""
import importlib.util
import os
import sys
from pathlib import Path

os.environ.setdefault("FB_GROUP_URL", "https://www.facebook.com/groups/1")
_spec = importlib.util.spec_from_file_location(
    "fbs", Path(__file__).resolve().parent / "fb_group_scraper.py")
fbs = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(fbs)


def main() -> int:
    failed = 0
    lock = fbs.LOCK_FILE
    backup = lock.with_suffix(".lock.testbak")
    had = lock.exists()
    if had:
        lock.replace(backup)

    def check(name, got, expect):
        nonlocal failed
        ok = got == expect
        failed += 0 if ok else 1
        print(f"  {'PASS' if ok else 'FAIL'}  {name}: expected {expect}, got {got}")

    try:
        # ไม่มีล็อก → ต้องได้
        lock.unlink(missing_ok=True)
        check("ไม่มีล็อกมาก่อน → เริ่มได้", fbs.acquire_single_instance(), True)
        check("  เขียน pid ตัวเองลงไฟล์",
              lock.read_text(encoding="utf-8").strip(), str(os.getpid()))

        # ล็อกของ process ที่ยังอยู่จริง (ตัวเราเอง แต่แกล้งเป็นคนอื่นไม่ได้)
        # จึงใช้ pid ของ process อื่นที่ยังมีชีวิต: parent ของเรา
        ppid = os.getppid()
        lock.write_text(str(ppid), encoding="utf-8")
        check("ล็อกของ process ที่ยังมีชีวิต → ต้องไม่ให้เริ่ม",
              fbs.acquire_single_instance(), False)
        check("  ไม่ไปแตะไฟล์ล็อกของเจ้าของเดิม",
              lock.read_text(encoding="utf-8").strip(), str(ppid))

        # ล็อกค้างจาก pid ที่ตายแล้ว → ต้องเขียนทับ ไม่ใช่ติดตาย
        dead = 999999            # pid สูงเกินกว่าจะมีอยู่จริง
        lock.write_text(str(dead), encoding="utf-8")
        check("ล็อกค้างจาก pid ที่ไม่มีแล้ว → เริ่มได้",
              fbs.acquire_single_instance(), True)
        check("  เขียนทับด้วย pid ตัวเอง",
              lock.read_text(encoding="utf-8").strip(), str(os.getpid()))

        # ไฟล์ล็อกเสียหาย → ไม่ควรทำให้ scraper เริ่มไม่ได้
        lock.write_text("ไม่ใช่ตัวเลข", encoding="utf-8")
        check("ไฟล์ล็อกเสียหาย → ยังเริ่มได้", fbs.acquire_single_instance(), True)

        # ปล่อยล็อก
        fbs.release_single_instance()
        check("ปล่อยล็อกแล้วไฟล์ต้องหายไป", lock.exists(), False)

        # ปล่อยล็อกของคนอื่น ต้องไม่ไปลบให้เขา
        lock.write_text(str(ppid), encoding="utf-8")
        fbs.release_single_instance()
        check("ไม่ลบล็อกที่ไม่ใช่ของตัวเอง", lock.exists(), True)
    finally:
        lock.unlink(missing_ok=True)
        if had:
            backup.replace(lock)

    total = 10
    print(f"\n{total - failed}/{total} passed")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
