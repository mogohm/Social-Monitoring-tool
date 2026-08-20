# -*- coding: utf-8 -*-
"""_liveness ต้องตอบ "ยังทำงานอยู่ไหม" จาก heartbeat ไม่ใช่จากธง enabled

รัน:  .venv\Scripts\python.exe backend\test_scraper_liveness.py

ทำไมต้องมีไฟล์นี้: หน้า admin เดิมตัดสินสถานะจาก config.enabled อย่างเดียว
ซึ่งเป็นแค่สิ่งที่ผู้ดูแลสั่งไว้ ไม่ใช่สิ่งที่ process กำลังทำ ตอน scraper ตายไป
5 วัน หน้าเว็บยังขึ้นไฟเขียว Running อยู่ — โกหกในสถานการณ์เดียวที่มันมีไว้เพื่อบอก
"""
import os
import sys
from datetime import datetime, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://u:p@localhost/db")

from backend.routers.admin import _liveness          # noqa: E402
from backend.models.models import ScraperConfig      # noqa: E402


def row(last_run_at=None, enabled=True, interval_minutes=30, last_status="ok"):
    r = ScraperConfig(name="default", enabled=enabled, interval_minutes=interval_minutes)
    r.last_run_at = last_run_at
    r.last_status = last_status
    return r


def main() -> int:
    now = datetime.utcnow()
    ago = lambda **kw: now - timedelta(**kw)

    cases = [
        ("ตายไป 5 วัน แต่ enabled ยังเป็น True",
         row(last_run_at=ago(days=5)), "down"),
        ("heartbeat เพิ่งเข้ามาเมื่อครู่",
         row(last_run_at=ago(minutes=1)), "running"),
        ("เงียบ 40 นาที ที่ interval 30 — ยังไม่เกินเกณฑ์",
         row(last_run_at=ago(minutes=40)), "running"),
        ("เงียบ 80 นาที ที่ interval 30 — เกิน 2.5 รอบ",
         row(last_run_at=ago(minutes=80)), "down"),
        ("ไม่เคยรายงานเลย",
         row(last_run_at=None), "never_reported"),
        ("ยังรายงานอยู่ แต่ Facebook เตะออก",
         row(last_run_at=ago(minutes=2), last_status="session_expired"), "needs_login"),
        ("ยังรายงานอยู่ แต่ login ไม่ผ่าน",
         row(last_run_at=ago(minutes=2), last_status="login_failed"), "needs_login"),
        ("ผู้ดูแลสั่งหยุด และ process ยังมีชีวิต",
         row(last_run_at=ago(minutes=2), enabled=False), "paused"),
        # ถ้าเช็ค enabled ก่อน staleness จะได้ paused ซึ่งอ่านว่า "ตั้งใจหยุด"
        # ทั้งที่ความจริงคือเครื่องดับไปแล้ว
        ("ผู้ดูแลสั่งหยุด แต่ process ตายไปแล้ว — ต้องเป็น down",
         row(last_run_at=ago(days=2), enabled=False), "down"),
        ("interval 1 นาที เงียบ 4 นาที — พื้นขั้นต่ำ 5 นาทีกันการเตือนเกินเหตุ",
         row(last_run_at=ago(minutes=4), interval_minutes=1), "running"),
    ]

    failed = 0
    for name, r, expected in cases:
        got = _liveness(r)["state"]
        ok = got == expected
        failed += 0 if ok else 1
        print(f"  {'PASS' if ok else 'FAIL'}  {name}: expected {expected}, got {got}")

    print(f"\n{len(cases) - failed}/{len(cases)} passed")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
