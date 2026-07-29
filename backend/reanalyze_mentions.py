"""
Re-analyze all existing mentions with updated risk scoring logic.
Run: python -m backend.reanalyze_mentions
"""
import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.models.database import AsyncSessionLocal
from backend.models.models import Mention, Keyword
from backend.services.ai_service import analyze_text
from sqlalchemy import select


async def _match_keywords(content: str, kw_list: list) -> list[dict]:
    lower = content.lower()
    matched = []
    for kw in kw_list:
        if kw.word.lower() in lower:
            matched.append({"word": kw.word, "category": kw.category or "general", "is_negative": kw.is_negative})
    return matched


async def run():
    async with AsyncSessionLocal() as db:
        # Load all active keywords once
        kw_list = (await db.execute(select(Keyword).where(Keyword.is_active == True))).scalars().all()
        print(f"Loaded {len(kw_list)} keywords")

        # Load all mentions
        mentions = (await db.execute(select(Mention).order_by(Mention.id))).scalars().all()
        print(f"Found {len(mentions)} mentions to re-analyze\n")

        updated = 0
        for i, m in enumerate(mentions, 1):
            analysis = await analyze_text(m.content)
            tags = await _match_keywords(m.content, kw_list)

            # Apply negative keyword boost (same logic as webhook.py)
            neg_hits = [t for t in tags if t.get("is_negative")]
            if neg_hits:
                analysis["sentiment"] = "negative"
                analysis["emotion"] = "anger"
                analysis["intent"] = "complaint"
                boost = min(len(neg_hits) * 35, 70)
                analysis["risk_score"] = min((analysis.get("risk_score") or 0) + boost, 100)
                score = analysis["risk_score"]
                if score >= 80:
                    analysis["priority"] = "critical"
                elif score >= 60:
                    analysis["priority"] = "high"
                elif score >= 40:
                    analysis["priority"] = "medium"

            m.sentiment      = analysis.get("sentiment")
            m.emotion        = analysis.get("emotion")
            m.intent         = analysis.get("intent")
            m.topic          = analysis.get("topic")
            m.risk_score     = analysis.get("risk_score")
            m.priority       = analysis.get("priority")
            m.ai_summary     = analysis.get("summary")
            m.suggested_action = analysis.get("suggested_action")
            m.tags           = tags if tags else m.tags

            neg_label = f"  NEG={[t['word'] for t in neg_hits]}" if neg_hits else ""
            print(f"  [{i:3}/{len(mentions)}] id={m.id:4}  risk={m.risk_score:5.0f}  {m.sentiment:8}  {m.priority:8}{neg_label}")
            updated += 1

        await db.commit()
        print(f"\nDone -- updated {updated} mentions")


if __name__ == "__main__":
    asyncio.run(run())
