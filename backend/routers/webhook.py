from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
from typing import Optional
from backend.services.ai_service import analyze_text
from backend.models.database import AsyncSessionLocal
from backend.models.models import Mention, Keyword, AdminChat
from sqlalchemy import select
from datetime import datetime

router = APIRouter(prefix="/api/webhook", tags=["webhook"])


class MentionPayload(BaseModel):
    channel: str
    author: str
    content: str
    url: Optional[str] = None
    image_url: Optional[str] = None
    image_urls: Optional[list] = None   # รูปทั้งหมดในโพสต์
    author_id: Optional[str] = None
    external_id: Optional[str] = None
    published_at: Optional[str] = None  # ISO string หรือ unix timestamp str
    likes: int = 0
    comments: int = 0
    shares: int = 0
    views: int = 0


async def _match_keywords(content: str, db) -> list[dict]:
    kws = (await db.execute(select(Keyword).where(Keyword.is_active == True))).scalars().all()
    matched, lower = [], content.lower()
    for kw in kws:
        if kw.word.lower() in lower:
            matched.append({"word": kw.word, "category": kw.category or "general", "is_negative": kw.is_negative})
            kw.match_count = (kw.match_count or 0) + 1
    return matched


@router.post("/mention")
async def generic_webhook(payload: MentionPayload):
    """Universal endpoint — receives data from any external collector (Python scripts, n8n, Make.com)."""
    async with AsyncSessionLocal() as db:
        analysis = await analyze_text(payload.content)
        tags = await _match_keywords(payload.content, db)
        # parse published_at
        pub_at = datetime.utcnow()
        if payload.published_at:
            try:
                ts = payload.published_at.strip()
                if ts.isdigit():
                    pub_at = datetime.utcfromtimestamp(int(ts))
                else:
                    from dateutil import parser as dp
                    pub_at = dp.parse(ts)
            except Exception:
                pass

        # รูปหลัก — ใช้รูปแรกใน image_urls ถ้ามี (filter rsrc.php / static icons)
        def _is_content_image(url: str) -> bool:
            return bool(url and "scontent" in url and "rsrc.php" not in url)

        img_url = payload.image_url if _is_content_image(payload.image_url or "") else None
        if not img_url and payload.image_urls:
            for u in payload.image_urls:
                if _is_content_image(u):
                    img_url = u
                    break

        extra_tags = tags if tags else []

        mention = Mention(
            channel=payload.channel,
            author=payload.author,
            author_id=payload.author_id,
            external_id=payload.external_id,
            content=payload.content,
            url=payload.url,
            image_url=img_url,
            likes=payload.likes,
            comments=payload.comments,
            shares=payload.shares,
            views=payload.views,
            engagement=payload.likes + payload.comments + payload.shares,
            sentiment=analysis.get("sentiment"),
            emotion=analysis.get("emotion"),
            intent=analysis.get("intent"),
            topic=analysis.get("topic"),
            risk_score=analysis.get("risk_score"),
            priority=analysis.get("priority"),
            ai_summary=analysis.get("summary"),
            suggested_action=analysis.get("suggested_action"),
            tags=extra_tags if extra_tags else None,
            published_at=pub_at,
        )
        db.add(mention)
        await db.commit()
    return {"status": "ok", "channel": payload.channel, "keywords_matched": len(tags)}


@router.post("/line")
async def line_webhook(request: Request):
    body = await request.json()
    events = body.get("events", [])
    async with AsyncSessionLocal() as db:
        for event in events:
            if event.get("type") == "message" and event["message"]["type"] == "text":
                text = event["message"]["text"]
                source = event.get("source", {})
                user_id = source.get("userId", "unknown")
                is_from_admin = source.get("type") == "group"

                if not is_from_admin:
                    analysis = await analyze_text(text)
                    mention = Mention(
                        channel="line_oa",
                        author=user_id,
                        content=text,
                        sentiment=analysis.get("sentiment"),
                        risk_score=analysis.get("risk_score"),
                        priority=analysis.get("priority"),
                        ai_summary=analysis.get("summary"),
                        published_at=datetime.utcnow(),
                    )
                    db.add(mention)

                chat = AdminChat(
                    admin_id="line_system",
                    customer_id=user_id,
                    channel="line_oa",
                    message=text,
                    direction="in" if not is_from_admin else "out",
                    created_at=datetime.utcnow(),
                )
                db.add(chat)
        await db.commit()
    return {"status": "ok"}


@router.post("/facebook")
async def facebook_webhook(request: Request):
    body = await request.json()
    entries = body.get("entry", [])
    async with AsyncSessionLocal() as db:
        for entry in entries:
            for change in entry.get("changes", []):
                value = change.get("value", {})
                message = value.get("message", {})
                if message:
                    text = message.get("message", "")
                    if text:
                        analysis = await analyze_text(text)
                        mention = Mention(
                            channel="facebook",
                            author=value.get("from", {}).get("name"),
                            content=text,
                            sentiment=analysis.get("sentiment"),
                            risk_score=analysis.get("risk_score"),
                            priority=analysis.get("priority"),
                            ai_summary=analysis.get("summary"),
                            published_at=datetime.utcnow(),
                        )
                        db.add(mention)
        await db.commit()
    return {"status": "ok"}


@router.get("/facebook")
async def facebook_verify(request: Request):
    params = dict(request.query_params)
    if params.get("hub.verify_token") == "socialeye_verify_token":
        return int(params.get("hub.challenge", 0))
    raise HTTPException(status_code=403, detail="Invalid verify token")
