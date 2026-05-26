from fastapi import APIRouter, Request, HTTPException
from backend.services.ai_service import analyze_text
from backend.models.database import AsyncSessionLocal
from backend.models.models import Mention, AdminChat
from datetime import datetime

router = APIRouter(prefix="/api/webhook", tags=["webhook"])


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
