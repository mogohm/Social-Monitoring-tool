from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
import os
from backend.models.database import AsyncSessionLocal
from backend.models.models import Alert, AlertLog, Mention
from backend.services.email_service import send_alert_email, send_alert_emails
from sqlalchemy import select, desc

router = APIRouter(prefix="/api/alerts", tags=["alerts"])


# ─── Schemas ────────────────────────────────────────────────────────────────

class AlertBody(BaseModel):
    name: str
    condition_type: str = "keyword_match"
    threshold: Optional[float] = None
    keywords: Optional[list[str]] = None
    category_filter: Optional[list[str]] = None
    channels: Optional[list[str]] = None
    email_recipients: Optional[list[str]] = None
    is_active: bool = True


def _serialize(row: Alert) -> dict:
    return {
        "id": row.id,
        "name": row.name,
        "condition_type": row.condition_type,
        "threshold": row.threshold,
        "keywords": row.keywords or [],
        "category_filter": row.category_filter or [],
        "channels": row.channels or [],
        "email_recipients": row.email_recipients or [],
        "notify_email": row.notify_email,
        "is_active": row.is_active,
        "created_at": row.created_at.isoformat() if row.created_at else None,
    }


def _serialize_log(row: AlertLog) -> dict:
    return {
        "id": row.id,
        "alert_id": row.alert_id,
        "mention_id": row.mention_id,
        "sent_at": row.sent_at.isoformat() if row.sent_at else None,
        "recipients": row.recipients or [],
        "channel": row.channel,
        "author": row.author,
        "content_preview": row.content_preview,
        "risk_score": row.risk_score,
        "topic": row.topic,
        "matched_keywords": row.matched_keywords or [],
        "mention_url": row.mention_url,
        "status": row.status or "sent",
        "error": row.error,
    }


# ─── Diagnostics ────────────────────────────────────────────────────────────

@router.get("/smtp-status")
async def smtp_status():
    """Report whether SMTP env vars are configured (never exposes the password)."""
    host = os.getenv("SMTP_HOST", "")
    port = os.getenv("SMTP_PORT", "")
    user = os.getenv("SMTP_USER", "")
    has_pass = bool(os.getenv("SMTP_PASS", ""))
    configured = bool(user and has_pass)
    return {
        "configured": configured,
        "smtp_host": host or "(not set — defaults to smtp.gmail.com)",
        "smtp_port": port or "(not set — defaults to 587)",
        "smtp_user": user or "(not set)",
        "smtp_pass_set": has_pass,
        "message": (
            "SMTP พร้อมใช้งาน — alert จะส่ง email ได้"
            if configured
            else "ยังไม่ได้ตั้งค่า SMTP_USER / SMTP_PASS ใน Vercel — alert จะไม่ส่ง email"
        ),
    }


class TestEmailBody(BaseModel):
    recipients: list[str]


@router.post("/test-email")
async def test_email(body: TestEmailBody):
    """Send a test alert email to verify SMTP works end-to-end."""
    if not os.getenv("SMTP_USER") or not os.getenv("SMTP_PASS"):
        raise HTTPException(400, "SMTP_USER / SMTP_PASS ยังไม่ได้ตั้งค่าใน Vercel")
    if not body.recipients:
        raise HTTPException(400, "ต้องระบุ recipients อย่างน้อย 1 อีเมล")

    class _FakeMention:
        author = "SocialEye Test"
        content = "นี่คือ email ทดสอบระบบแจ้งเตือน — ถ้าคุณได้รับอีเมลนี้ แสดงว่า SMTP ทำงานถูกต้องแล้ว"
        url = "https://social-monitoring-tool.vercel.app/alerts"
        image_url = None
        topic = "general"
        risk_score = 50
        priority = "medium"
        published_at = datetime.utcnow()

    await send_alert_email(
        mention=_FakeMention(),
        alert_name="ทดสอบระบบแจ้งเตือน",
        recipients=body.recipients,
        matched_keywords=["ทดสอบ"],
    )
    return {"status": "sent", "recipients": body.recipients}


# ─── CRUD ───────────────────────────────────────────────────────────────────

@router.get("")
async def list_alerts():
    async with AsyncSessionLocal() as db:
        rows = (await db.execute(select(Alert).order_by(Alert.id))).scalars().all()
        return [_serialize(r) for r in rows]


@router.post("", status_code=201)
async def create_alert(body: AlertBody):
    async with AsyncSessionLocal() as db:
        row = Alert(
            name=body.name,
            condition_type=body.condition_type,
            threshold=body.threshold,
            keywords=body.keywords or [],
            category_filter=body.category_filter or [],
            channels=body.channels or [],
            email_recipients=body.email_recipients or [],
            notify_email=True,
            is_active=body.is_active,
        )
        db.add(row)
        await db.commit()
        await db.refresh(row)
        return _serialize(row)


@router.patch("/{alert_id}")
async def update_alert(alert_id: int, body: AlertBody):
    async with AsyncSessionLocal() as db:
        row = (await db.execute(
            select(Alert).where(Alert.id == alert_id)
        )).scalar_one_or_none()
        if not row:
            raise HTTPException(404, "Alert not found")
        row.name             = body.name
        row.condition_type   = body.condition_type
        row.threshold        = body.threshold
        row.keywords         = body.keywords or []
        row.category_filter  = body.category_filter or []
        row.channels         = body.channels or []
        row.email_recipients = body.email_recipients or []
        row.is_active        = body.is_active
        await db.commit()
        await db.refresh(row)
        return _serialize(row)


@router.delete("/{alert_id}", status_code=204)
async def delete_alert(alert_id: int):
    async with AsyncSessionLocal() as db:
        row = (await db.execute(
            select(Alert).where(Alert.id == alert_id)
        )).scalar_one_or_none()
        if not row:
            raise HTTPException(404, "Alert not found")
        await db.delete(row)
        await db.commit()


# ─── Logs ────────────────────────────────────────────────────────────────────

@router.get("/{alert_id}/logs")
async def get_alert_logs(alert_id: int, limit: int = 50):
    async with AsyncSessionLocal() as db:
        rows = (await db.execute(
            select(AlertLog)
            .where(AlertLog.alert_id == alert_id)
            .order_by(desc(AlertLog.sent_at))
            .limit(limit)
        )).scalars().all()
        return {
            "alert_id": alert_id,
            "total": len(rows),
            "logs": [_serialize_log(r) for r in rows],
        }


# ─── Trigger: called by webhook after saving a mention ──────────────────────

def _alert_matches(alert: Alert, mention: Mention,
                   matched_keyword_names: list[str]) -> tuple[bool, list[str]]:
    """Return (triggered, keywords_that_triggered) for one alert."""
    if not alert.email_recipients:
        return False, []
    if alert.channels and mention.channel not in alert.channels:
        return False, []

    ctype = alert.condition_type

    if ctype == "all":
        return True, matched_keyword_names

    if ctype == "keyword_match":
        watch = [k.lower() for k in (alert.keywords or [])]
        hits = ([k for k in matched_keyword_names if k.lower() in watch]
                if watch else matched_keyword_names)
        return (bool(hits), hits)

    if ctype == "risk_score":
        if (mention.risk_score or 0) >= (alert.threshold or 60):
            return True, matched_keyword_names
        return False, []

    if ctype == "category":
        cats = [c.lower() for c in (alert.category_filter or [])]
        if cats and (mention.topic or "general").lower() in cats:
            return True, matched_keyword_names
        return False, []

    return False, []


async def check_and_send_alerts(mention: Mention, matched_keyword_names: list[str]) -> int:
    """Evaluate every active alert against this mention, send emails, write logs.

    Must be awaited inside the request — Vercel freezes the function once the
    HTTP response is returned, so a fire-and-forget task would never run.
    Returns the number of emails successfully sent.
    """
    async with AsyncSessionLocal() as db:
        active_alerts = (await db.execute(
            select(Alert).where(Alert.is_active == True)
        )).scalars().all()

    triggered = []
    for alert in active_alerts:
        ok, kws = _alert_matches(alert, mention, matched_keyword_names)
        if ok:
            triggered.append((alert, kws))

    if not triggered:
        return 0

    print(f"[alerts] {len(triggered)} alert(s) triggered for mention {mention.id}")

    # One SMTP connection for all of them
    results = await send_alert_emails([
        {
            "mention": mention,
            "alert_name": alert.name,
            "recipients": alert.email_recipients,
            "matched_keywords": kws,
        }
        for alert, kws in triggered
    ])

    # Log every send attempt (successful or not) in one transaction
    now = datetime.utcnow()
    async with AsyncSessionLocal() as db:
        for (alert, kws), (ok, err) in zip(triggered, results):
            db.add(AlertLog(
                alert_id=alert.id,
                mention_id=mention.id,
                sent_at=now,
                recipients=alert.email_recipients,
                channel=mention.channel,
                author=mention.author,
                content_preview=(mention.content or "")[:280],
                risk_score=mention.risk_score,
                topic=mention.topic,
                matched_keywords=kws,
                mention_url=mention.url,
                status="sent" if ok else "failed",
                error=None if ok else err[:500],
            ))
        await db.commit()

    return sum(1 for ok, _ in results if ok)
