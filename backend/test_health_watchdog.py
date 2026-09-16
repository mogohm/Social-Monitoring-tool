# -*- coding: utf-8 -*-
r"""watchdog ต้องแจ้งครั้งเดียวต่อหนึ่งเหตุ และแจ้งอีกครั้งตอนกลับมา

รัน:  .venv\Scripts\python.exe backend\test_health_watchdog.py

ทำไมต้องมีไฟล์นี้: การแจ้งเตือนที่ยิงซ้ำทุกชั่วโมงจะถูกผู้รับตั้งกรองทิ้งภายในวันเดียว
แล้วเหตุจริงครั้งถัดไปก็จะไม่มีใครเห็น — กลายเป็นแย่กว่าไม่มีระบบแจ้งเตือนเลย
"""
import asyncio
import os
import sys
from datetime import datetime, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://u:p@localhost/db")
os.environ.setdefault("ADMIN_TOKEN", "test-token")

from backend.routers import admin as A                    # noqa: E402
from backend.models.models import ScraperConfig           # noqa: E402


class FakeDB:
    def __init__(self, row): self.row = row; self.commits = 0
    async def commit(self): self.commits += 1
    async def __aenter__(self): return self
    async def __aexit__(self, *a): return False


sent: list = []


async def fake_send(recipients, subject, title, colour, lines):
    sent.append(subject)
    return True


async def fake_send_fails(recipients, subject, title, colour, lines):
    sent.append(subject)
    return False


def run_check(row, sender):
    """เรียก endpoint โดยสลับ DB และตัวส่งเมลเป็นของปลอม"""
    db = FakeDB(row)
    A.AsyncSessionLocal = lambda: db
    A._get_or_create_default = lambda _db: _ret(row)
    A.send_scraper_status_email = sender
    return asyncio.run(A.scraper_health_check(x_admin_token="test-token"))


async def _ret(v):
    return v


def row(minutes_ago, enabled=True, last_status="ok", alerted=None):
    r = ScraperConfig(name="default", enabled=enabled, interval_minutes=30)
    r.last_run_at = datetime.utcnow() - timedelta(minutes=minutes_ago)
    r.last_posts_count = 3
    r.last_status = last_status
    r.down_alert_sent_at = alerted
    return r


def main() -> int:
    failed = 0

    def check(name, got, expect):
        nonlocal failed
        ok = got == expect
        failed += 0 if ok else 1
        print(f"  {'PASS' if ok else 'FAIL'}  {name}: expected {expect}, got {got}")

    # ปกติ ไม่ต้องแจ้งอะไร
    sent.clear()
    r = row(5)
    check("ทำงานปกติ → ไม่ส่ง", run_check(r, fake_send)["action"], "none")

    # เพิ่งตาย → แจ้ง 1 ใบ
    sent.clear()
    r = row(60 * 24 * 5)
    check("เงียบ 5 วัน ครั้งแรก → ส่ง", run_check(r, fake_send)["action"], "alert_sent")
    check("  จำนวนอีเมล", len(sent), 1)

    # ยังตายอยู่ รอบถัดไป → ต้องเงียบ
    sent.clear()
    check("ยังตายอยู่ รอบถัดมา → ไม่ส่งซ้ำ",
          run_check(r, fake_send)["action"], "none")
    check("  จำนวนอีเมล", len(sent), 0)

    # กลับมาทำงาน → แจ้งว่ากลับมาแล้ว และล้างธง
    sent.clear()
    r2 = row(5, alerted=datetime.utcnow() - timedelta(days=5))
    res = run_check(r2, fake_send)
    check("กลับมาทำงาน → ส่ง recovery", res["action"], "recovery_sent")
    check("  ธงถูกล้าง", r2.down_alert_sent_at, None)

    # ส่งเมลไม่สำเร็จ → ห้ามตั้งธง ไม่งั้นเหตุนี้จะเงียบตลอดไป
    sent.clear()
    r3 = row(60 * 24 * 5)
    check("ส่งเมลล้มเหลว → ไม่ตั้งธง",
          run_check(r3, fake_send_fails)["action"], "alert_failed")
    check("  ธงยังว่าง (รอบหน้าลองใหม่)", r3.down_alert_sent_at, None)

    # session หลุดก็ต้องแจ้ง แม้ heartbeat จะยังมา
    sent.clear()
    r4 = row(2, last_status="session_expired")
    check("session หลุด → แจ้ง", run_check(r4, fake_send)["action"], "alert_sent")

    total = 9
    print(f"\n{total - failed}/{total} passed")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
