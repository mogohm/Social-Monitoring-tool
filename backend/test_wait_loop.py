# -*- coding: utf-8 -*-
r"""_wait_for_next_cycle ต้องกลับมาตรงเวลาเสมอ แม้ control plane จะค้างหรือล่ม

รัน:  .venv\Scripts\python.exe backend\test_wait_loop.py

ทำไมต้องมีไฟล์นี้: เวอร์ชันแรกนับเวลาที่รอจากผลรวมของ sleep ที่ทำสำเร็จ พอเครื่อง
เสีย DNS แต่ละ poll ค้างราว 25 นาที เวลาที่นับได้จึงแทบไม่ขยับ — scraper ค้างอยู่
ระหว่างรอบนานสองชั่วโมงครึ่งโดยที่ process ยังดูมีชีวิตดี และ browser ตายไปแล้ว

เทสต์นี้ใช้เวลาจริงแต่ย่อส่วน (รอบละ ~3 วินาที) แทนการ patch นาฬิกา เพราะสิ่งที่
ต้องพิสูจน์คือ asyncio.wait_for ตัดการเรียกที่ค้างได้จริง ซึ่งวัดด้วยเวลาเสมือนไม่ได้
"""
import asyncio
import importlib.util
import os
import sys
import time
from pathlib import Path

os.environ.setdefault("FB_GROUP_URL", "https://www.facebook.com/groups/1")

_spec = importlib.util.spec_from_file_location(
    "fbs", Path(__file__).resolve().parent / "fb_group_scraper.py")
fbs = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(fbs)

CYCLE_MIN = 0.05          # 3 วินาที
CYCLE_SEC = CYCLE_MIN * 60


def setup():
    fbs.CONTROL_POLL_SEC = 0.3
    fbs.CONTROL_FETCH_TIMEOUT = 0.1
    fbs.INTERVAL_MIN = CYCLE_MIN      # ค่า fallback ตอนติดต่อ API ไม่ได้
    fbs._acked_run_request[0] = None


async def scenario(name, fetch_impl, lo, hi):
    setup()
    fbs.fetch_config = fetch_impl
    t0 = time.monotonic()
    try:
        await asyncio.wait_for(fbs._wait_for_next_cycle(), timeout=hi + 3)
        elapsed = time.monotonic() - t0
        returned = True
    except asyncio.TimeoutError:
        elapsed = time.monotonic() - t0
        returned = False

    ok = returned and lo <= elapsed <= hi
    print(f"  {'PASS' if ok else 'FAIL'}  {name}: returned={returned} "
          f"elapsed={elapsed:.1f}s (ต้องอยู่ระหว่าง {lo:.1f}-{hi:.1f}s)")
    return 0 if ok else 1


async def healthy():
    return CYCLE_MIN, True, None


async def hangs_forever():
    """resolver ค้าง — wait_for ต้องตัดทิ้งทุกครั้ง ไม่งั้นลูปจะไม่มีวันจบ"""
    await asyncio.sleep(30)
    raise OSError("getaddrinfo failed")


async def always_errors():
    raise RuntimeError("500 from control plane")


async def run_now():
    return CYCLE_MIN, True, "2026-08-25T12:00:00Z"


_paused = {"n": 0}


async def paused_then_enabled():
    _paused["n"] += 1
    return (CYCLE_MIN, False, None) if _paused["n"] < 3 else (CYCLE_MIN, True, None)


async def main() -> int:
    failed = 0
    failed += await scenario("ปกติ", healthy, CYCLE_SEC * 0.9, CYCLE_SEC + 1.5)
    # หัวใจของไฟล์นี้: poll ค้างไม่จำกัด แต่เส้นตายต้องยังเดิน
    failed += await scenario("resolver ค้างทุกครั้ง", hangs_forever,
                             CYCLE_SEC * 0.9, CYCLE_SEC + 2.5)
    failed += await scenario("control plane ตอบ error ตลอด", always_errors,
                             CYCLE_SEC * 0.9, CYCLE_SEC + 1.5)
    failed += await scenario("run-now สั่งจากหน้าเว็บ", run_now, 0, 1.0)
    _paused["n"] = 0
    failed += await scenario("paused แล้วปลดล็อก", paused_then_enabled,
                             CYCLE_SEC * 0.9, CYCLE_SEC + 3.0)

    print(f"\n{5 - failed}/5 passed")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
