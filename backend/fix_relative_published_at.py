# -*- coding: utf-8 -*-
"""ซ่อม published_at ที่เพี้ยนจากการอ่านอายุโพสต์เป็นเวลานาฬิกา

ก่อน bef2279 ฝั่ง server ส่ง "20h" (20 ชั่วโมงที่แล้ว) ให้ dateutil ซึ่งอ่าน
เป็น "20:00 ของวันนี้" แถวที่โดนจึงมีลายเซ็นชัดเจน:

    published_at = วันเดียวกับ created_at เวลา HH:00:00 พอดี

โดยที่ HH คือจำนวนชั่วโมงที่โพสต์นั้นเก่า เวลาที่ถูกจึงกู้คืนได้ตรงๆ:

    published_at ที่ถูก = created_at - HH ชั่วโมง

รันดูอย่างเดียว (ไม่แก้อะไร):
    .venv\\Scripts\\python.exe backend\\fix_relative_published_at.py

รันจริง:
    .venv\\Scripts\\python.exe backend\\fix_relative_published_at.py --apply

ต้องมี DATABASE_URL ใน backend/.env
"""
import asyncio
import os
import sys
from datetime import timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text                                  # noqa: E402
from backend.models.database import AsyncSessionLocal        # noqa: E402

APPLY = "--apply" in sys.argv

# แถวที่เก็บหลังเวลานี้ใช้โค้ดที่แก้แล้ว ไม่ต้องแตะ
FIX_DEPLOYED_AT = "2026-08-05 13:36:00"

SELECT_SQL = text("""
    SELECT id, author, published_at, created_at
    FROM mentions
    WHERE created_at < :cutoff
      AND published_at IS NOT NULL
      AND published_at <> created_at
      AND EXTRACT(MINUTE FROM published_at) = 0
      AND EXTRACT(SECOND FROM published_at) = 0
      AND EXTRACT(HOUR FROM published_at) > 0
      AND published_at::date = created_at::date
    ORDER BY id
""")


async def run():
    async with AsyncSessionLocal() as db:
        rows = (await db.execute(SELECT_SQL, {"cutoff": FIX_DEPLOYED_AT})).fetchall()

        if not rows:
            print("ไม่พบแถวที่เข้าลายเซ็นนี้ — ไม่มีอะไรต้องซ่อม")
            return

        print(f"พบ {len(rows)} แถวที่ต้องซ่อม"
              f"{'' if APPLY else '  (ยังไม่แก้ ใส่ --apply เพื่อแก้จริง)'}\n")
        print(f"{'id':<6} {'ผู้โพสต์':<22} {'เดิม (ผิด)':<20} {'ใหม่ (ถูก)':<20} อายุ")
        print("-" * 82)

        updates = []
        for r in rows:
            mid, author, pub, created = r
            age_hours = pub.hour
            correct = created - timedelta(hours=age_hours)
            updates.append({"id": mid, "pub": correct})
            print(f"{mid:<6} {(author or '')[:20]:<22} "
                  f"{pub:%Y-%m-%d %H:%M:%S}  {correct:%Y-%m-%d %H:%M:%S}  {age_hours}h")

        if not APPLY:
            print("\nยังไม่ได้แก้อะไร — รันซ้ำด้วย --apply ถ้าค่าใหม่ถูกต้องแล้ว")
            return

        for u in updates:
            await db.execute(
                text("UPDATE mentions SET published_at = :pub WHERE id = :id"), u
            )
        await db.commit()
        print(f"\nแก้แล้ว {len(updates)} แถว")


asyncio.run(run())
