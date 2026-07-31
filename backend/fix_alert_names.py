import asyncio, sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from backend.models.database import AsyncSessionLocal
from sqlalchemy import text

NAMES = {
    17: "แจ้งทุกโพสต์ Facebook",
    18: "แจ้งเมื่อมี Keyword ตรง",
    19: "แจ้งเมื่อ Risk Score >= 70",
    20: "แจ้งโพสต์โกง / ฝากถอน",
}

async def run():
    async with AsyncSessionLocal() as db:
        for aid, name in NAMES.items():
            await db.execute(text("UPDATE alerts SET name = :n WHERE id = :id"), {"n": name, "id": aid})
        await db.commit()
        rows = (await db.execute(text("SELECT id, name FROM alerts ORDER BY id"))).fetchall()
        for r in rows:
            print(f"  id={r[0]}  {r[1]}")

asyncio.run(run())
