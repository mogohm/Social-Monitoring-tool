from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from datetime import datetime, timedelta
from typing import Optional
from backend.models.database import get_db
from backend.models.models import Mention, Keyword
from backend.services.ai_service import analyze_text
from backend.utils.timefmt import utc_iso
from backend.utils.daterange import resolve_range, normalise_offset
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


async def _match_keywords(content: str, db: AsyncSession) -> list[dict]:
    """Return list of {word, category, is_negative} for every active keyword found in content."""
    kws = (await db.execute(
        select(Keyword).where(Keyword.is_active == True)
    )).scalars().all()
    matched = []
    lower = content.lower()
    for kw in kws:
        if kw.word.lower() in lower:
            matched.append({"word": kw.word, "category": kw.category or "general", "is_negative": kw.is_negative})
            kw.match_count = (kw.match_count or 0) + 1
    return matched


@router.get("")
async def list_mentions(
    channel: Optional[str] = None,
    sentiment: Optional[str] = None,
    priority: Optional[str] = None,
    keyword: Optional[str] = None,
    author: Optional[str] = None,
    project_id: Optional[int] = None,
    days: int = Query(7, ge=1, le=90),
    date_from: Optional[str] = Query(None, description="YYYY-MM-DD; overrides days"),
    date_to: Optional[str] = Query(None, description="YYYY-MM-DD; inclusive"),
    tz_offset: Optional[int] = Query(None, description="Client minutes east of UTC, e.g. 420 for Bangkok"),
    limit: int = Query(50, le=200),
    offset: int = 0,
    with_total: bool = Query(
        False,
        description="Return {items, total, limit, offset} instead of a bare list, "
                    "so the UI can page and show a truthful count",
    ),
    db: AsyncSession = Depends(get_db),
):
    since, until = resolve_range(days, date_from, date_to, tz_offset)

    filtered = select(Mention).where(
        Mention.created_at.between(since, until)
    ).where(Mention.is_spam == False)
    if channel:
        filtered = filtered.where(Mention.channel == channel)
    if sentiment:
        filtered = filtered.where(Mention.sentiment == sentiment)
    if priority:
        filtered = filtered.where(Mention.priority == priority)
    if keyword:
        filtered = filtered.where(Mention.content.ilike(f"%{keyword}%"))
    if author:
        filtered = filtered.where(Mention.author == author)
    if project_id:
        filtered = filtered.where(Mention.project_id == project_id)

    page = filtered.order_by(desc(Mention.created_at)).limit(limit).offset(offset)
    mentions = (await db.execute(page)).scalars().all()
    items = [_serialize(m) for m in mentions]

    # Default stays a bare list so existing callers are untouched.
    if not with_total:
        return items

    total = (await db.execute(
        select(func.count()).select_from(filtered.subquery())
    )).scalar() or 0
    return {"items": items, "total": total, "limit": limit, "offset": offset}


@router.get("/stats")
async def get_stats(
    days: int = Query(7, ge=1, le=90),
    date_from: Optional[str] = Query(None, description="YYYY-MM-DD; overrides days"),
    date_to: Optional[str] = Query(None, description="YYYY-MM-DD; inclusive"),
    tz_offset: Optional[int] = Query(None, description="Client minutes east of UTC, e.g. 420 for Bangkok"),
    project_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
):
    since, until = resolve_range(days, date_from, date_to, tz_offset)
    base = select(Mention).where(Mention.created_at.between(since, until)).where(Mention.is_spam == False)
    if project_id:
        base = base.where(Mention.project_id == project_id)

    total_q = select(func.count()).select_from(base.subquery())
    sentiment_q = (
        select(Mention.sentiment, func.count().label("cnt"))
        .where(Mention.created_at.between(since, until)).where(Mention.is_spam == False)
        .group_by(Mention.sentiment)
    )
    channel_q = (
        select(Mention.channel, func.count().label("cnt"))
        .where(Mention.created_at.between(since, until))
        .group_by(Mention.channel).order_by(desc("cnt"))
    )
    risk_q      = select(func.avg(Mention.risk_score)).where(Mention.created_at.between(since, until))
    engagement_q = select(func.sum(Mention.engagement)).where(Mention.created_at.between(since, until))

    total            = (await db.execute(total_q)).scalar() or 0
    sentiment_rows   = (await db.execute(sentiment_q)).all()
    channel_rows     = (await db.execute(channel_q)).all()
    avg_risk         = (await db.execute(risk_q)).scalar() or 0
    total_engagement = (await db.execute(engagement_q)).scalar() or 0

    sentiment_map = {r.sentiment: r.cnt for r in sentiment_rows}
    positive = sentiment_map.get("positive", 0)
    negative = sentiment_map.get("negative", 0)
    neutral  = sentiment_map.get("neutral", 0)

    return {
        "total_mentions": total,
        "positive": positive, "negative": negative, "neutral": neutral,
        "positive_pct": round(positive / total * 100, 1) if total else 0,
        "negative_pct": round(negative / total * 100, 1) if total else 0,
        "neutral_pct":  round(neutral  / total * 100, 1) if total else 0,
        "net_sentiment": round((positive - negative) / total * 100, 1) if total else 0,
        "avg_risk_score": round(float(avg_risk), 1),
        "total_engagement": int(total_engagement),
        "channels": [{"channel": r.channel, "count": r.cnt} for r in channel_rows],
    }


@router.get("/trend")
async def get_trend(
    days: int = Query(7, ge=1, le=90),
    date_from: Optional[str] = Query(None, description="YYYY-MM-DD; overrides days"),
    date_to: Optional[str] = Query(None, description="YYYY-MM-DD; inclusive"),
    tz_offset: Optional[int] = Query(None, description="Client minutes east of UTC, e.g. 420 for Bangkok"),
    db: AsyncSession = Depends(get_db),
):
    since, until = resolve_range(days, date_from, date_to, tz_offset)
    off = normalise_offset(tz_offset)

    # Bucket by the viewer's calendar day, not the UTC one. Truncating raw UTC
    # put a 05:44 Bangkok post into the previous day's bar, so the chart
    # disagreed with the timestamps printed on the mention cards.
    local_ts = Mention.created_at + timedelta(minutes=off)
    q = (
        select(
            func.date_trunc("day", local_ts).label("day"),
            Mention.sentiment, func.count().label("cnt"),
        )
        .where(Mention.created_at.between(since, until)).where(Mention.is_spam == False)
        .group_by("day", Mention.sentiment).order_by("day")
    )
    rows = (await db.execute(q)).all()

    # Seed every day in the range at zero first. Grouping alone only returns
    # days that happen to have mentions, so a "14 days" chart rendered just 3
    # bars and looked like the range selector was broken.
    result: dict = {}
    start = (since + timedelta(minutes=off)).date()
    end = (until + timedelta(minutes=off)).date()
    cur = start
    while cur <= end:
        key = cur.strftime("%Y-%m-%d")
        result[key] = {"date": key, "positive": 0, "neutral": 0, "negative": 0}
        cur += timedelta(days=1)

    for r in rows:
        if not r.day:
            continue
        day_str = r.day.strftime("%Y-%m-%d")
        if day_str not in result:
            result[day_str] = {"date": day_str, "positive": 0, "neutral": 0, "negative": 0}
        result[day_str][r.sentiment or "neutral"] = r.cnt

    return [result[k] for k in sorted(result)]


@router.get("/users")
async def get_user_analytics(
    days: int = Query(30, ge=1, le=90),
    date_from: Optional[str] = Query(None, description="YYYY-MM-DD; overrides days"),
    date_to: Optional[str] = Query(None, description="YYYY-MM-DD; inclusive"),
    tz_offset: Optional[int] = Query(None, description="Client minutes east of UTC, e.g. 420 for Bangkok"),
    db: AsyncSession = Depends(get_db),
):
    since, until = resolve_range(days, date_from, date_to, tz_offset)
    mentions = (await db.execute(
        select(Mention).where(Mention.created_at.between(since, until), Mention.is_spam == False)
    )).scalars().all()

    users: dict[str, dict] = {}
    for m in mentions:
        author = (m.author or "Unknown").strip()
        if not author or author == "Manual Entry":
            continue
        if author not in users:
            users[author] = {
                "author": author,
                "count": 0, "positive": 0, "neutral": 0, "negative": 0,
                "engagement": 0, "channels": set(), "risk_scores": [],
                "last_seen": m.created_at,
            }
        u = users[author]
        u["count"] += 1
        u[m.sentiment or "neutral"] += 1
        u["engagement"] += m.engagement or 0
        u["channels"].add(m.channel or "unknown")
        if m.risk_score:
            u["risk_scores"].append(float(m.risk_score))
        if m.created_at and m.created_at > u["last_seen"]:
            u["last_seen"] = m.created_at

    result = []
    for u in users.values():
        c = u["count"] or 1
        risks = u["risk_scores"]
        avg_risk = round(sum(risks) / len(risks), 1) if risks else 0
        pos, neg, neu = u["positive"], u["negative"], u["neutral"]
        dominant = "positive" if pos >= neg and pos >= neu else ("negative" if neg > pos else "neutral")
        result.append({
            "author": u["author"],
            "count": u["count"],
            "positive": pos, "neutral": neu, "negative": neg,
            "positive_pct": round(pos / c * 100),
            "negative_pct": round(neg / c * 100),
            "engagement": u["engagement"],
            "channels": sorted(u["channels"]),
            "avg_risk": avg_risk,
            "dominant_sentiment": dominant,
            "last_seen": utc_iso(u["last_seen"]) if u["last_seen"] else None,
        })

    result.sort(key=lambda x: x["count"], reverse=True)
    return result[:50]


@router.get("/topics")
async def get_topics(
    days: int = Query(30, ge=1, le=90),
    date_from: Optional[str] = Query(None, description="YYYY-MM-DD; overrides days"),
    date_to: Optional[str] = Query(None, description="YYYY-MM-DD; inclusive"),
    tz_offset: Optional[int] = Query(None, description="Client minutes east of UTC, e.g. 420 for Bangkok"),
    db: AsyncSession = Depends(get_db),
):
    since, until = resolve_range(days, date_from, date_to, tz_offset)
    mentions = (await db.execute(
        select(Mention).where(Mention.created_at.between(since, until), Mention.is_spam == False)
    )).scalars().all()

    topics: dict[str, dict] = {}
    for m in mentions:
        key = (m.topic or "General").strip()
        if key not in topics:
            topics[key] = {"topic": key, "count": 0, "positive": 0, "neutral": 0, "negative": 0, "engagement": 0}
        topics[key]["count"] += 1
        sent = m.sentiment or "neutral"
        topics[key][sent] = topics[key][sent] + 1
        topics[key]["engagement"] += m.engagement or 0

    result = sorted(topics.values(), key=lambda x: x["count"], reverse=True)[:15]
    total = len(mentions) or 1
    for t in result:
        c = t["count"] or 1
        t["positive_pct"] = round(t["positive"] / c * 100)
        t["negative_pct"] = round(t["negative"] / c * 100)
        t["neutral_pct"] = round(t["neutral"] / c * 100)
        t["dominant_sentiment"] = (
            "positive" if t["positive"] >= t["negative"] and t["positive"] >= t["neutral"]
            else ("negative" if t["negative"] > t["positive"] else "neutral")
        )
        t["share_pct"] = round(t["count"] / total * 100, 1)
    return result


@router.get("/competitors")
async def get_competitors(
    days: int = Query(30, ge=1, le=90),
    date_from: Optional[str] = Query(None, description="YYYY-MM-DD; overrides days"),
    date_to: Optional[str] = Query(None, description="YYYY-MM-DD; inclusive"),
    tz_offset: Optional[int] = Query(None, description="Client minutes east of UTC, e.g. 420 for Bangkok"),
    db: AsyncSession = Depends(get_db),
):
    since, until = resolve_range(days, date_from, date_to, tz_offset)
    keywords = (await db.execute(select(Keyword).where(Keyword.is_active == True))).scalars().all()
    kw_set = {kw.word for kw in keywords}

    mentions = (await db.execute(
        select(Mention).where(Mention.created_at.between(since, until), Mention.is_spam == False)
    )).scalars().all()

    stats: dict[str, dict] = {
        w: {"keyword": w, "count": 0, "positive": 0, "neutral": 0, "negative": 0, "engagement": 0}
        for w in kw_set
    }
    for m in mentions:
        for tag in (m.tags or []):
            w = tag.get("word", "")
            if w in stats:
                stats[w]["count"] += 1
                sent = m.sentiment or "neutral"
                stats[w][sent] = stats[w][sent] + 1
                stats[w]["engagement"] += m.engagement or 0

    result = sorted([v for v in stats.values() if v["count"] > 0], key=lambda x: x["count"], reverse=True)[:15]
    total_count = sum(r["count"] for r in result) or 1
    for r in result:
        c = r["count"] or 1
        r["sov_pct"] = round(r["count"] / total_count * 100, 1)
        r["positive_pct"] = round(r["positive"] / c * 100)
        r["negative_pct"] = round(r["negative"] / c * 100)
    return result


@router.get("/{mention_id}")
async def get_mention(mention_id: int, db: AsyncSession = Depends(get_db)):
    m = await db.get(Mention, mention_id)
    if not m:
        raise HTTPException(404, "mention not found")
    return _serialize(m)


@router.post("")
async def create_mention(data: MentionCreate, db: AsyncSession = Depends(get_db)):
    analysis = await analyze_text(data.content)
    matched  = await _match_keywords(data.content, db)
    engagement = data.likes + data.comments + data.shares

    mention = Mention(
        channel=data.channel, author=data.author, content=data.content,
        url=data.url, external_id=data.external_id,
        published_at=data.published_at or datetime.utcnow(),
        likes=data.likes, comments=data.comments, shares=data.shares,
        views=data.views, engagement=engagement, project_id=data.project_id,
        sentiment=analysis.get("sentiment"), emotion=analysis.get("emotion"),
        intent=analysis.get("intent"), topic=analysis.get("topic"),
        risk_score=analysis.get("risk_score"), priority=analysis.get("priority"),
        suggested_action=analysis.get("suggested_action"),
        ai_summary=analysis.get("summary"),
        tags=matched if matched else None,
    )
    db.add(mention)
    await db.commit()
    await db.refresh(mention)
    return _serialize(mention)


@router.post("/retag-keywords")
async def retag_all_keywords(db: AsyncSession = Depends(get_db)):
    """Retroactively match keywords against all existing mentions."""
    mentions = (await db.execute(select(Mention))).scalars().all()
    updated = 0
    for m in mentions:
        matched = await _match_keywords(m.content, db)
        if matched:
            m.tags = matched
            updated += 1
    await db.commit()
    return {"updated": updated, "total": len(mentions)}


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
        "image_url": m.image_url,
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
        "tags": m.tags or [],
        "is_reviewed": m.is_reviewed,
        "published_at": utc_iso(m.published_at) if m.published_at else None,
        "created_at": utc_iso(m.created_at) if m.created_at else None,
    }
