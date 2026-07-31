"""Remove the [TEST] mentions created while verifying the alert pipeline.

Alert log rows survive (alert_logs.mention_id is ON DELETE SET NULL) and keep
their denormalised author/content/risk copies, so the history stays intact.
"""
import asyncio, sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.models.database import AsyncSessionLocal
from backend.models.models import Mention
from sqlalchemy import select

async def run():
    async with AsyncSessionLocal() as db:
        rows = (await db.execute(
            select(Mention).where(Mention.external_id.like("test_alert_verify%"))
        )).scalars().all()
        for m in rows:
            print(f"  deleting id={m.id} external_id={m.external_id} content={m.content[:60]!r}")
            await db.delete(m)
        await db.commit()
        print(f"Deleted {len(rows)} test mentions")

asyncio.run(run())
