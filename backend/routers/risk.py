import os
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select

from backend.config import settings
from backend.models.database import AsyncSessionLocal
from backend.models.models import RiskConfig, Keyword
from backend.services.ai_service import count_negative_hits, _rule_based_sentiment
from backend.services.risk_service import load_weights, explain
from backend.utils.timefmt import utc_iso

router = APIRouter(prefix="/api/risk-config", tags=["risk"])


async def _get_or_create(db) -> RiskConfig:
    row = (await db.execute(
        select(RiskConfig).where(RiskConfig.name == "default")
    )).scalar_one_or_none()
    if not row:
        row = RiskConfig(name="default")
        db.add(row)
        await db.commit()
        await db.refresh(row)
    return row


def _serialize(row: RiskConfig) -> dict:
    ai_key_present = bool(settings.OPENAI_API_KEY or os.getenv("OPENAI_API_KEY"))
    return {
        "negative_sentiment_pts": row.negative_sentiment_pts,
        "keyword_hit_pts": row.keyword_hit_pts,
        "keyword_hit_cap": row.keyword_hit_cap,
        "long_text_pts": row.long_text_pts,
        "long_text_chars": row.long_text_chars,
        "user_negative_pts": row.user_negative_pts,
        "user_negative_cap": row.user_negative_cap,
        "critical_at": row.critical_at,
        "high_at": row.high_at,
        "medium_at": row.medium_at,
        "use_ai": row.use_ai,
        # Whether AI can actually run — the toggle alone does nothing without a key
        "ai_key_present": ai_key_present,
        "scoring_mode": "ai" if (ai_key_present and row.use_ai) else "rules",
        "updated_at": utc_iso(row.updated_at),
    }


@router.get("")
async def get_risk_config():
    async with AsyncSessionLocal() as db:
        return _serialize(await _get_or_create(db))


class RiskPatch(BaseModel):
    negative_sentiment_pts: Optional[float] = Field(None, ge=0, le=100)
    keyword_hit_pts: Optional[float] = Field(None, ge=0, le=100)
    keyword_hit_cap: Optional[float] = Field(None, ge=0, le=100)
    long_text_pts: Optional[float] = Field(None, ge=0, le=100)
    long_text_chars: Optional[int] = Field(None, ge=1, le=5000)
    user_negative_pts: Optional[float] = Field(None, ge=0, le=100)
    user_negative_cap: Optional[float] = Field(None, ge=0, le=100)
    critical_at: Optional[float] = Field(None, ge=0, le=100)
    high_at: Optional[float] = Field(None, ge=0, le=100)
    medium_at: Optional[float] = Field(None, ge=0, le=100)
    use_ai: Optional[bool] = None


@router.patch("")
async def update_risk_config(body: RiskPatch):
    async with AsyncSessionLocal() as db:
        row = await _get_or_create(db)
        for field, value in body.model_dump(exclude_unset=True).items():
            setattr(row, field, value)

        # Thresholds that cross over would make a band unreachable.
        if not (row.critical_at >= row.high_at >= row.medium_at):
            raise HTTPException(
                422, "เกณฑ์ต้องเรียงจากมากไปน้อย: critical ≥ high ≥ medium"
            )
        await db.commit()
        await db.refresh(row)
        return _serialize(row)


class PreviewBody(BaseModel):
    text: str


@router.post("/preview")
async def preview_score(body: PreviewBody):
    """Score a sample post with the saved weights and show the breakdown, so a
    change can be sanity-checked before it starts affecting live data."""
    text = body.text.strip()
    if not text:
        raise HTTPException(422, "กรุณาใส่ข้อความ")

    async with AsyncSessionLocal() as db:
        weights = await load_weights(db)
        kws = (await db.execute(
            select(Keyword).where(Keyword.is_active == True)
        )).scalars().all()

    lower = text.lower()
    tags = [
        {"word": k.word, "is_negative": k.is_negative, "risk_weight": k.risk_weight}
        for k in kws if k.word.lower() in lower
    ]
    sentiment = _rule_based_sentiment(text)
    result = explain(text, sentiment, count_negative_hits(text), tags, weights)
    result["sentiment"] = sentiment
    result["matched_keywords"] = [t["word"] for t in tags]
    # Preview always uses the rules so the weights are visible; live scoring may
    # use the model, which does not decompose into these components.
    result["note"] = (
        "ตัวอย่างนี้คำนวณด้วยสูตร เพื่อให้เห็นผลของน้ำหนักแต่ละข้อ"
    )
    return result
