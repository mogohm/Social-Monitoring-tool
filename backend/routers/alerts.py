from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from backend.models.database import AsyncSessionLocal
from backend.models.models import Alert, Mention
from backend.services.email_service import send_alert_email
from sqlalchemy import select

router = APIRouter(prefix="/api/alerts", tags=["alerts"])


# ─── Schemas ────────────────────────────────────────────────────────────────

class AlertBody(BaseModel):
    name: str
    condition_type: str = "keyword_match"  # all | keyword_match | risk_score | category
    threshold: Optional[float] = None       # for risk_score: min score 0-100
    keywords: Optional[list[str]] = None    # for keyword_match: [] means any keyword
    category_filter: Optional[list[str]] = None  # for category filter
    channels: Optional[list[str]] = None    # [] means all channels
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


# ─── Trigger: called by webhook after saving a mention ──────────────────────

async def check_and_send_alerts(mention: Mention, matched_keyword_names: list[str]):
    """
    Load active alerts, evaluate each condition against the mention,
    and send emails when the condition is met.
    """
    async with AsyncSessionLocal() as db:
        active_alerts = (await db.execute(
            select(Alert).where(Alert.is_active == True)
        )).scalars().all()

    for alert in active_alerts:
        if not alert.email_recipients:
            continue

        # Channel filter
        if alert.channels:
            if mention.channel not in alert.channels:
                continue

        triggered = False
        trigger_keywords: list[str] = []

        ctype = alert.condition_type

        if ctype == "all":
            triggered = True
            trigger_keywords = matched_keyword_names

        elif ctype == "keyword_match":
            # If alert.keywords is empty, any keyword match triggers
            watch = [k.lower() for k in (alert.keywords or [])]
            if watch:
                hits = [k for k in matched_keyword_names if k.lower() in watch]
            else:
                hits = matched_keyword_names
            if hits:
                triggered = True
                trigger_keywords = hits

        elif ctype == "risk_score":
            min_score = alert.threshold or 60
            if (mention.risk_score or 0) >= min_score:
                triggered = True
                trigger_keywords = matched_keyword_names

        elif ctype == "category":
            cats = [c.lower() for c in (alert.category_filter or [])]
            if cats and (mention.topic or "general") in cats:
                triggered = True
                trigger_keywords = matched_keyword_names

        if triggered:
            await send_alert_email(
                mention=mention,
                alert_name=alert.name,
                recipients=alert.email_recipients,
                matched_keywords=trigger_keywords,
            )
