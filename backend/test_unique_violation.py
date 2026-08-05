# -*- coding: utf-8 -*-
"""_is_unique_violation ต้องแยก duplicate key ออกจาก constraint อื่นให้ถูก

รันตรงๆ:  .venv\\Scripts\\python.exe -m backend.test_unique_violation
(หรือ python backend/test_unique_violation.py จาก root ของ repo)

ทำไมต้องมีไฟล์นี้: เวอร์ชันแรกอ่าน exc.orig.sqlstate อย่างเดียว ซึ่ง SQLAlchemy
asyncpg adapter ไม่ได้ใส่มาให้ ทุก duplicate เลยหลุดเป็น 500 ต่อไปโดยที่โค้ด
"ดูเหมือนถูก" — พังบน production เท่านั้น เทสต์นี้ครอบทุกรูปแบบที่ driver stack
อาจส่งมา เพื่อให้ความเปลี่ยนแปลงของ stack พังตรงนี้แทนที่จะไปพังตอน deploy
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

# ต้องมีค่าก่อน import config ที่ต้องการ DATABASE_URL
import os
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://u:p@localhost/db")

from datetime import datetime, timedelta            # noqa: E402
from sqlalchemy.exc import IntegrityError            # noqa: E402
from backend.routers.webhook import (                # noqa: E402
    _is_unique_violation,
    _parse_published_at,
)


def wrap(orig):
    return IntegrityError("INSERT ...", {}, orig)


class HasSqlstate(Exception):
    def __init__(self, code):
        self.sqlstate = code


class HasPgcode(Exception):
    def __init__(self, code):
        self.pgcode = code


class Wrapper(Exception):
    """เลียนแบบ wrapper ของ SQLAlchemy ที่ไม่ได้พา code มาด้วย"""


class Bare(Exception):
    pass


def _wrapped(cause_code):
    w = Wrapper("wrapped")
    w.__cause__ = HasSqlstate(cause_code)
    return w


CASES = [
    ("asyncpg .sqlstate = 23505",        wrap(HasSqlstate("23505")), True),
    ("asyncpg .sqlstate = 23502",        wrap(HasSqlstate("23502")), False),
    ("psycopg .pgcode = 23505",          wrap(HasPgcode("23505")),   True),
    ("psycopg .pgcode = 23503",          wrap(HasPgcode("23503")),   False),
    ("ห่อไว้ __cause__ = 23505",          wrap(_wrapped("23505")),    True),
    ("ห่อไว้ __cause__ = 23502",          wrap(_wrapped("23502")),    False),
    ("เหลือแค่ข้อความ (unique)",
     wrap(Bare('duplicate key value violates unique constraint "mentions_external_id_key"')),
     True),
    ("เหลือแค่ข้อความ (not null)",
     wrap(Bare('null value in column "channel" violates not-null constraint')),
     False),
    ("ไม่มี orig เลย",                    IntegrityError("stmt", {}, None), False),
]


# published_at ต้องออกมาเป็น naive UTC เสมอ — column เป็น TIMESTAMP WITHOUT
# TIME ZONE ถ้าหลุด aware ออกไป asyncpg จะปฏิเสธแล้วทั้ง request พังเป็น 500
PUB_CASES = [
    ("มี Z ต่อท้าย",        "2026-08-03T04:00:00Z",      datetime(2026, 8, 3, 4, 0, 0)),
    ("offset +07:00",       "2026-08-03T11:00:00+07:00", datetime(2026, 8, 3, 4, 0, 0)),
    ("offset -05:00",       "2026-08-02T23:00:00-05:00", datetime(2026, 8, 3, 4, 0, 0)),
    ("naive ไม่มี offset",  "2026-08-03 04:00:00",       datetime(2026, 8, 3, 4, 0, 0)),
    ("unix timestamp",      "1785729600",                datetime.utcfromtimestamp(1785729600)),
]

# เวลาสัมพัทธ์ที่ Facebook ส่งมาจริง — วัดจากหน้ากลุ่มได้ '3h' '2h' '5h'
# dateutil อ่าน '20h' เป็น 20:00 ของวันนี้ ซึ่งผิดวันและมักเป็นอนาคต
# คู่ค่าคือ (ข้อความ, จำนวนวินาทีที่ควรถอยหลังจาก now)
REL_CASES = [
    ("3h",          3 * 3600),
    ("20h",         20 * 3600),
    ("45m",         45 * 60),
    ("2d",          2 * 86400),
    ("1w",          7 * 86400),
    ("30s",         30),
    ("5 ชม.",       5 * 3600),
    ("2 ชั่วโมง",   2 * 3600),
    ("10 นาที",     10 * 60),
    ("3 วัน",       3 * 86400),
    ("2 hours ago", 2 * 3600),
    ("Just now",    0),
    ("เมื่อสักครู่", 0),
]


def main() -> int:
    failed = 0
    for name, exc, expected in CASES:
        got = _is_unique_violation(exc)
        ok = got == expected
        failed += 0 if ok else 1
        print(f"  {'PASS' if ok else 'FAIL'}  {name}: expected {expected}, got {got}")

    print()
    for name, raw, expected in PUB_CASES:
        got = _parse_published_at(raw)
        ok = got == expected and got.tzinfo is None
        failed += 0 if ok else 1
        print(f"  {'PASS' if ok else 'FAIL'}  published_at {name}: expected {expected}, got {got}")

    print()
    for raw, back_seconds in REL_CASES:
        before = datetime.utcnow()
        got = _parse_published_at(raw)
        after = datetime.utcnow()
        # ต้องอยู่ระหว่าง (before - delta) ถึง (after - delta) เผื่อเวลาที่ใช้รัน
        lo = before - timedelta(seconds=back_seconds) - timedelta(seconds=2)
        hi = after - timedelta(seconds=back_seconds) + timedelta(seconds=2)
        ok = lo <= got <= hi and got.tzinfo is None
        failed += 0 if ok else 1
        print(f"  {'PASS' if ok else 'FAIL'}  relative {raw!r} → ย้อนหลัง {back_seconds}s: {got}")

    print()
    # ค่าอ่านไม่ออกต้องไม่ทำให้ mention ตกไป — ตกกลับไปใช้เวลาปัจจุบันแบบ naive
    fallback = _parse_published_at("เมื่อวานตอนบ่าย")
    ok = fallback.tzinfo is None
    failed += 0 if ok else 1
    print(f"  {'PASS' if ok else 'FAIL'}  อ่านไม่ออก → naive fallback")

    # ไม่ว่าทางไหนก็ห้ามได้เวลาอนาคต
    future = _parse_published_at("2099-01-01T00:00:00Z")
    ok = future <= datetime.utcnow() + timedelta(minutes=5)
    failed += 0 if ok else 1
    print(f"  {'PASS' if ok else 'FAIL'}  เวลาอนาคตถูกปัดกลับเป็นปัจจุบัน: {future}")

    # ของเก่าที่เป็นอดีตจริงต้องไม่โดนปัด
    past = _parse_published_at("2026-08-03T04:00:00Z")
    ok = past == datetime(2026, 8, 3, 4, 0, 0)
    failed += 0 if ok else 1
    print(f"  {'PASS' if ok else 'FAIL'}  อดีตจริงไม่ถูกแตะ: {past}")

    total = len(CASES) + len(PUB_CASES) + len(REL_CASES) + 3
    print(f"\n{total - failed}/{total} passed")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
