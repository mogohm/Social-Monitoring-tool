from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, and_
from datetime import datetime, timedelta
from typing import Optional
from backend.models.database import get_db
from backend.models.models import Mention
from backend.services.ai_service import analyze_text
from pydantic import BaseModel

router = APIRouter(prefix="/api/mentions", tags=["mentions"])


class MentionCreate(BaseModel):
    channel: str
    author: Optional[str] = None
    content: str
    url: Optional[str] = None
    external_id: Optional[str] = None
    published_at: Optional[datetime] = None
    likes: int = 0
    comments: int = 0
    shares: int = 0
    views: int = 0
    project_id: Optional[int] = None


@router.get("")
async def list_mentions(
    channel: Optional[str] = None,
    sentiment: Optional[str] = None,
    priority: Optional[str] = None,
    project_id: Optional[int] = None,
    days: int = Query(7, ge=1, le=90),
    limit: int = Query(50, le=200),
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
):
    since = datetime.utcnow() - timedelta(days=days)
    q = select(Mention).where(Mention.created_at >= since).where(Mention.is_spam == False)
    if channel:
        q = q.where(Mention.channel == channel)
    if sentiment:
        q = q.where(Mention.sentiment == sentiment)
    if priority:
        q = q.where(Mention.priority == priority)
    if project_id:
        q = q.where(Mention.project_id == project_id)
    q = q.order_by(desc(Mention.created_at)).limit(limit).offset(offset)
    result = await db.execute(q)
    mentions = result.scalars().all()
    return [_serialize(m) for m in mentions]


@router.post("")
async def create_mention(data: MentionCreate, db: AsyncSession = Depends(get_db)):
    analysis = await analyze_text(data.content)
    engagement = data.likes + data.comments + data.shares
    mention = Mention(
        channel=data.channel,
        author=data.author,
        content=data.content,
        url=data.url,
        external_id=data.external_id,
        published_at=data.published_at or datetime.utcnow(),
        likes=data.likes,
        comments=data.comments,
        shares=data.shares,
        views=data.views,
        engagement=engagement,
        project_id=data.project_id,
        sentiment=analysis.get("sentiment"),
        emotion=analysis.get("emotion"),
        intent=analysis.get("intent"),
        topic=analysis.get("topic"),
        risk_score=analysis.get("risk_score"),
        priority=analysis.get("priority"),
        suggested_action=analysis.get("suggested_action"),
        ai_summary=analysis.get("summary"),
    )
    db.add(mention)
    await db.commit()
    await db.refresh(mention)
    return _serialize(mention)


@router.get("/stats")
async def get_stats(
    days: int = Query(7, ge=1, le=90),
    project_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
):
    since = datetime.utcnow() - timedelta(days=days)
    base = select(Mention).where(Mention.created_at >= since).where(Mention.is_spam == False)
    if project_id:
        base = base.where(Mention.project_id == project_id)

    total_q = select(func.count()).select_from(base.subquery())
    sentiment_q = (
        select(Mention.sentiment, func.count().label("cnt"))
        .where(Mention.created_at >= since)
        .where(Mention.is_spam == False)
        .group_by(Mention.sentiment)
    )
    channel_q = (
        select(Mention.channel, func.count().label("cnt"))
        .where(Mention.created_at >= since)
        .group_by(Mention.channel)
        .order_by(desc("cnt"))
    )
    risk_q = select(func.avg(Mention.risk_score)).where(Mention.created_at >= since)
    engagement_q = select(func.sum(Mention.engagement)).where(Mention.created_at >= since)

    total = (await db.execute(total_q)).scalar() or 0
    sentiment_rows = (await db.execute(sentiment_q)).all()
    channel_rows = (await db.execute(channel_q)).all()
    avg_risk = (await db.execute(risk_q)).scalar() or 0
    total_engagement = (await db.execute(engagement_q)).scalar() or 0

    sentiment_map = {r.sentiment: r.cnt for r in sentiment_rows}
    positive = sentiment_map.get("positive", 0)
    negative = sentiment_map.get("negative", 0)
    neutral = sentiment_map.get("neutral", 0)

    return {
        "total_mentions": total,
        "positive": positive,
        "negative": negative,
        "neutral": neutral,
        "positive_pct": round(positive / total * 100, 1) if total else 0,
        "negative_pct": round(negative / total * 100, 1) if total else 0,
        "net_sentiment": round((positive - negative) / total * 100, 1) if total else 0,
        "avg_risk_score": round(float(avg_risk), 1),
        "total_engagement": int(total_engagement),
        "channels": [{"channel": r.channel, "count": r.cnt} for r in channel_rows],
    }


@router.get("/trend")
async def get_trend(
    days: int = Query(7, ge=1, le=90),
    db: AsyncSession = Depends(get_db),
):
    since = datetime.utcnow() - timedelta(days=days)
    q = (
        select(
            func.date_trunc("day", Mention.created_at).label("day"),
            Mention.sentiment,
            func.count().label("cnt"),
        )
        .where(Mention.created_at >= since)
        .where(Mention.is_spam == False)
        .group_by("day", Mention.sentiment)
        .order_by("day")
    )
    rows = (await db.execute(q)).all()
    result = {}
    for r in rows:
        day_str = r.day.strftime("%Y-%m-%d") if r.day else "unknown"
        if day_str not in result:
            result[day_str] = {"date": day_str, "positive": 0, "neutral": 0, "negative": 0}
        result[day_str][r.sentiment or "neutral"] = r.cnt
    return list(result.values())


@router.patch("/{mention_id}/review")
async def mark_reviewed(mention_id: int, db: AsyncSession = Depends(get_db)):
    m = await db.get(Mention, mention_id)
    if m:
        m.is_reviewed = True
        await db.commit()
    return {"ok": True}


def _serialize(m: Mention) -> dict:
    return {
        "id": m.id,
        "channel": m.channel,
        "author": m.author,
        "content": m.content,
        "url": m.url,
        "sentiment": m.sentiment,
        "emotion": m.emotion,
        "intent": m.intent,
        "topic": m.topic,
        "risk_score": m.risk_score,
        "priority": m.priority,
        "engagement": m.engagement,
        "reach": m.reach,
        "likes": m.likes,
        "comments": m.comments,
        "shares": m.shares,
        "views": m.views,
        "virality_score": m.virality_score,
        "ai_summary": m.ai_summary,
        "suggested_action": m.suggested_action,
        "tags": m.tags,
        "is_reviewed": m.is_reviewed,
        "published_at": m.published_at.isoformat() if m.published_at else None,
        "created_at": m.created_at.isoformat() if m.created_at else None,
    }
