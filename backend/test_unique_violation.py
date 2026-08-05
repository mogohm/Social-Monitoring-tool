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

from sqlalchemy.exc import IntegrityError            # noqa: E402
from backend.routers.webhook import _is_unique_violation   # noqa: E402


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


def main() -> int:
    failed = 0
    for name, exc, expected in CASES:
        got = _is_unique_violation(exc)
        ok = got == expected
        failed += 0 if ok else 1
        print(f"  {'PASS' if ok else 'FAIL'}  {name}: expected {expected}, got {got}")
    print(f"\n{len(CASES) - failed}/{len(CASES)} passed")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
