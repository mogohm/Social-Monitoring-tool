"""Risk scoring driven by an editable config rather than hardcoded numbers.

The score used to be fixed in code (negative sentiment +40, each keyword +10,
long text +10, operator-flagged keyword +35, thresholds 80/60/40), so retuning
it meant a deploy. Those numbers now live in the `risk_configs` row and can be
changed from the dashboard.

When an OpenAI key is present and `use_ai` is on, the model supplies the base
score and the operator's keyword weights are added on top — deliberately in
that order, so a word the operator marked dangerous still raises the score even
if the model judged the post harmless.
"""
from dataclasses import dataclass
from typing import Optional

from sqlalchemy import select

from backend.models.models import RiskConfig


@dataclass(frozen=True)
class RiskWeights:
    negative_sentiment_pts: float = 40
    keyword_hit_pts: float = 10
    keyword_hit_cap: float = 40
    long_text_pts: float = 10
    long_text_chars: int = 200
    user_negative_pts: float = 35
    user_negative_cap: float = 70
    critical_at: float = 80
    high_at: float = 60
    medium_at: float = 40
    use_ai: bool = True


DEFAULTS = RiskWeights()


async def load_weights(db) -> RiskWeights:
    """Read the config row, falling back to defaults if it isn't there yet."""
    try:
        row = (await db.execute(
            select(RiskConfig).where(RiskConfig.name == "default")
        )).scalar_one_or_none()
    except Exception:
        return DEFAULTS
    if not row:
        return DEFAULTS
    return RiskWeights(
        negative_sentiment_pts=row.negative_sentiment_pts,
        keyword_hit_pts=row.keyword_hit_pts,
        keyword_hit_cap=row.keyword_hit_cap,
        long_text_pts=row.long_text_pts,
        long_text_chars=row.long_text_chars,
        user_negative_pts=row.user_negative_pts,
        user_negative_cap=row.user_negative_cap,
        critical_at=row.critical_at,
        high_at=row.high_at,
        medium_at=row.medium_at,
        use_ai=row.use_ai,
    )


def priority_for(score: float, w: RiskWeights = DEFAULTS) -> str:
    if score >= w.critical_at:
        return "critical"
    if score >= w.high_at:
        return "high"
    if score >= w.medium_at:
        return "medium"
    return "low"


def rule_score(text: str, sentiment: str, neg_hits: int, w: RiskWeights = DEFAULTS) -> float:
    """The keyword-counting score, with every number coming from the config."""
    score = 0.0
    if sentiment == "negative":
        score += w.negative_sentiment_pts
    score += min(neg_hits * w.keyword_hit_pts, w.keyword_hit_cap)
    if len(text) > w.long_text_chars:
        score += w.long_text_pts
    return min(score, 100.0)


def apply_user_keywords(
    base_score: float,
    matched_tags: list[dict],
    w: RiskWeights = DEFAULTS,
) -> tuple[float, list[dict]]:
    """Add the operator's negative-keyword weighting on top of `base_score`.

    Each matched keyword contributes its own `risk_weight` when set, otherwise
    the shared `user_negative_pts`. Returns (score, the negative tags that hit).
    """
    neg = [t for t in matched_tags if t.get("is_negative")]
    if not neg:
        return base_score, []
    boost = sum(
        (t.get("risk_weight") if t.get("risk_weight") is not None else w.user_negative_pts)
        for t in neg
    )
    boost = min(boost, w.user_negative_cap)
    return min(base_score + boost, 100.0), neg


def explain(
    text: str,
    sentiment: str,
    neg_hits: int,
    matched_tags: list[dict],
    w: RiskWeights = DEFAULTS,
    ai_score: Optional[float] = None,
) -> dict:
    """Score plus a per-component breakdown, so the UI can preview a change."""
    parts = []
    if ai_score is not None:
        base = min(ai_score, 100.0)
        parts.append({"label": "AI ประเมิน", "points": round(base, 1)})
    else:
        base = 0.0
        if sentiment == "negative":
            base += w.negative_sentiment_pts
            parts.append({"label": "sentiment เป็นลบ", "points": w.negative_sentiment_pts})
        kw = min(neg_hits * w.keyword_hit_pts, w.keyword_hit_cap)
        if kw:
            parts.append({"label": f"คำลบของระบบ {neg_hits} คำ", "points": kw})
            base += kw
        if len(text) > w.long_text_chars:
            base += w.long_text_pts
            parts.append({"label": f"ข้อความยาวเกิน {w.long_text_chars} ตัว", "points": w.long_text_pts})
        base = min(base, 100.0)

    score, neg = apply_user_keywords(base, matched_tags, w)
    if neg:
        parts.append({
            "label": "keyword ที่ตั้งเป็น Negative: " + ", ".join(t.get("word", "") for t in neg),
            "points": round(score - base, 1),
        })

    return {
        "score": round(score, 1),
        "priority": priority_for(score, w),
        "breakdown": parts,
    }
