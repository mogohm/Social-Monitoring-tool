"""Check actual alerts table columns in DB"""
import asyncio, sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from backend.models.database import AsyncSessionLocal
from sqlalchemy import text

async def run():
    async with AsyncSessionLocal() as db:
        result = await db.execute(text("""
            SELECT column_name, data_type, column_default
            FROM information_schema.columns
            WHERE table_name = 'alerts'
            ORDER BY ordinal_position
        """))
        rows = result.fetchall()
        print("Columns in alerts table:")
        for r in rows:
            print(f"  {r[0]:30} {r[1]:20} default={r[2]}")

asyncio.run(run())
