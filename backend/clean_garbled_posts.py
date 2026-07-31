"""Re-clean garbled content in existing mentions.

Facebook hides its injected tracking tokens by inserting U+034F COMBINING
GRAPHEME JOINER between every character, so the token never appears as a
contiguous alphanumeric run. This strips the invisible characters and then
the token itself — reusing webhook._clean_content so the two can't drift.

Run: backend/.venv/Scripts/python.exe backend/clean_garbled_posts.py
"""
import asyncio, sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.models.database import AsyncSessionLocal
from backend.models.models import Mention
from backend.routers.webhook import _clean_content
from sqlalchemy import select


async def run():
    fixed = skipped = 0
    async with AsyncSessionLocal() as db:
        rows = (await db.execute(select(Mention).order_by(Mention.id))).scalars().all()
        print(f"Total mentions: {len(rows)}")
        for m in rows:
            if not m.content:
                continue
            cleaned = _clean_content(m.content)
            if cleaned == m.content:
                continue
            if len(cleaned) < 5:
                skipped += 1
                continue
            print(f"  [{m.id}] {m.content[:60]!r}")
            print(f"     -> {cleaned[:60]!r}")
            m.content = cleaned
            fixed += 1
        await db.commit()
    print(f"\nDone — fixed {fixed}, skipped {skipped} (too short after clean)")


asyncio.run(run())
