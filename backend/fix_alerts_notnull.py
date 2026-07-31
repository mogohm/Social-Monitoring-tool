"""Fix notify_line and notify_telegram NOT NULL constraints"""
import asyncio, sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from backend.models.database import AsyncSessionLocal
from sqlalchemy import text

async def run():
    async with AsyncSessionLocal() as db:
        sqls = [
            "ALTER TABLE alerts ALTER COLUMN notify_line SET DEFAULT FALSE",
            "ALTER TABLE alerts ALTER COLUMN notify_telegram SET DEFAULT FALSE",
            "ALTER TABLE alerts ALTER COLUMN project_id DROP NOT NULL",
            "UPDATE alerts SET notify_line = FALSE WHERE notify_line IS NULL",
            "UPDATE alerts SET notify_telegram = FALSE WHERE notify_telegram IS NULL",
        ]
        for sql in sqls:
            try:
                await db.execute(text(sql))
                print(f"OK: {sql[:60]}")
            except Exception as e:
                print(f"SKIP ({e}): {sql[:60]}")
        await db.commit()
        print("Done")

asyncio.run(run())
