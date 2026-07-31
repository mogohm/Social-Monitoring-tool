"""Dump the raw code points of recently scraped content to identify how
Facebook obfuscates its injected tokens."""
import asyncio, sys, os, unicodedata
from collections import Counter
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.models.database import AsyncSessionLocal
from backend.models.models import Mention
from sqlalchemy import select, desc

async def run():
    async with AsyncSessionLocal() as db:
        rows = (await db.execute(
            select(Mention).order_by(desc(Mention.id)).limit(6)
        )).scalars().all()

        invisible = Counter()
        for m in rows:
            txt = m.content or ""
            # Count every non-printing / format / mark character
            for ch in txt:
                cat = unicodedata.category(ch)
                if cat in ("Cf", "Mn", "Cc") and ch not in "\n\r\t":
                    invisible[f"U+{ord(ch):04X} {unicodedata.name(ch, '?')} [{cat}]"] += 1

        print("=== invisible / combining characters found ===")
        if invisible:
            for name, n in invisible.most_common(10):
                print(f"  {n:5d} x  {name}")
        else:
            print("  none")

        print("\n=== sample: first 60 code points of newest post ===")
        m = rows[0]
        print(f"  id={m.id} author={m.author}")
        for ch in (m.content or "")[:60]:
            vis = ch if unicodedata.category(ch)[0] not in ("C", "M") else "·"
            print(f"    {vis!r:8} U+{ord(ch):04X}  {unicodedata.name(ch, '?')}")

asyncio.run(run())
