"""
Re-clean garbled content in existing mentions.
Removes Facebook obfuscation tokens (long alphanumeric strings) from post content.
Run once: python -m backend.clean_garbled_posts
"""
import asyncio, sys, os, re, unicodedata
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.models.database import AsyncSessionLocal
from backend.models.models import Mention
from sqlalchemy import select

# Same logic as webhook.py _clean_content
_LONG_TOKEN = re.compile(r'[A-Za-z0-9]{12,}')

def _clean_content(text: str) -> str:
    text = unicodedata.normalize("NFC", text)
    def _strip_token(m: re.Match) -> str:
        s = m.group(0)
        if s.isalpha():
            return s  # keep pure alphabetic (names, real words)
        if s.isdigit():
            return s  # keep pure numeric
        digit_count = sum(1 for c in s if c.isdigit())
        if len(s) >= 15 and digit_count >= 2:
            return ""
        if len(s) >= 25:
            return ""
        return s  # keep short mixed (N8Thailand, etc.)
    text = _LONG_TOKEN.sub(_strip_token, text)
    text = re.sub(r'[ \t]{2,}', ' ', text).strip()
    return text

def _has_token(text: str) -> bool:
    """True if the content contains what looks like a garbled token."""
    for m in _LONG_TOKEN.finditer(text):
        s = m.group(0)
        if s.isalpha() or s.isdigit():
            continue
        digit_count = sum(1 for c in s if c.isdigit())
        if (len(s) >= 15 and digit_count >= 2) or len(s) >= 25:
            return True
    return False

async def run():
    fixed = skipped = 0
    async with AsyncSessionLocal() as db:
        rows = (await db.execute(select(Mention).order_by(Mention.id))).scalars().all()
        print(f"Total mentions: {len(rows)}")
        for m in rows:
            if not m.content or not _has_token(m.content):
                continue
            cleaned = _clean_content(m.content)
            if cleaned == m.content:
                continue
            if len(cleaned) < 5:
                skipped += 1
                continue
            print(f"  [{m.id}] BEFORE: {m.content[:80]!r}")
            print(f"        AFTER:  {cleaned[:80]!r}")
            m.content = cleaned
            fixed += 1
        await db.commit()
    print(f"\nDone — fixed {fixed} mentions, skipped {skipped} (too short after clean)")

asyncio.run(run())
