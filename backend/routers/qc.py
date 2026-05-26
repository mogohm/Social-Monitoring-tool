from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from datetime import datetime, timedelta
from typing import Optional
from backend.models.database import get_db
from backend.models.models import AdminChat
from pydantic import BaseModel

router = APIRouter(prefix="/api/qc", tags=["qc"])

FORBIDDEN_WORDS = ["ไอ้", "อีสัตว์", "มึง", "กู", "บ้า"]


class ChatCreate(BaseModel):
    admin_id: str
    admin_name: Optional[str] = None
    customer_id: str
    channel: str = "line_oa"
    message: str
    direction: str = "out"
    response_time_sec: Optional[int] = None


@router.post("/chats")
async def create_chat(data: ChatCreate, db: AsyncSession = Depends(get_db)):
    has_forbidden = any(w in data.message for w in FORBIDDEN_WORDS)
    politeness = 90.0 if not has_forbidden else 30.0
    chat = AdminChat(
        admin_id=data.admin_id,
        admin_name=data.admin_name,
        customer_id=data.customer_id,
        channel=data.channel,
        message=data.message,
        direction=data.direction,
        response_time_sec=data.response_time_sec,
        politeness_score=politeness,
        has_forbidden_words=has_forbidden,
    )
    db.add(chat)
    await db.commit()
    await db.refresh(chat)
    return {"id": chat.id, "politeness_score": chat.politeness_score}


@router.get("/scoreboard")
async def get_scoreboard(
    days: int = Query(7, ge=1, le=90),
    db: AsyncSession = Depends(get_db),
):
    since = datetime.utcnow() - timedelta(days=days)
    q = (
        select(
            AdminChat.admin_id,
            AdminChat.admin_name,
            func.count().label("total_chats"),
            func.avg(AdminChat.response_time_sec).label("avg_response_sec"),
            func.avg(AdminChat.politeness_score).label("avg_politeness"),
            func.avg(AdminChat.accuracy_score).label("avg_accuracy"),
            func.sum(func.cast(AdminChat.has_forbidden_words, func.Integer if False else None)).label("forbidden_count"),
        )
        .where(AdminChat.created_at >= since)
        .where(AdminChat.direction == "out")
        .group_by(AdminChat.admin_id, AdminChat.admin_name)
        .order_by(desc("avg_politeness"))
    )
    rows = (await db.execute(q)).all()
    result = []
    for r in rows:
        avg_response_min = round(r.avg_response_sec / 60, 1) if r.avg_response_sec else None
        sla_pass = 100.0 if avg_response_min and avg_response_min <= 3 else 75.0
        score = round(
            (r.avg_politeness or 0) * 0.4
            + (r.avg_accuracy or 80) * 0.4
            + sla_pass * 0.2,
            1,
        )
        result.append({
            "admin_id": r.admin_id,
            "admin_name": r.admin_name,
            "total_chats": r.total_chats,
            "avg_response_min": avg_response_min,
            "sla_pass_pct": sla_pass,
            "avg_politeness": round(r.avg_politeness or 0, 1),
            "avg_accuracy": round(r.avg_accuracy or 80, 1),
            "score": score,
        })
    return result


@router.get("/chats")
async def list_chats(
    admin_id: Optional[str] = None,
    days: int = 7,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
):
    since = datetime.utcnow() - timedelta(days=days)
    q = select(AdminChat).where(AdminChat.created_at >= since).order_by(desc(AdminChat.created_at)).limit(limit)
    if admin_id:
        q = q.where(AdminChat.admin_id == admin_id)
    rows = (await db.execute(q)).scalars().all()
    return [
        {
            "id": c.id,
            "admin_id": c.admin_id,
            "admin_name": c.admin_name,
            "customer_id": c.customer_id,
            "message": c.message,
            "direction": c.direction,
            "response_time_sec": c.response_time_sec,
            "politeness_score": c.politeness_score,
            "has_forbidden_words": c.has_forbidden_words,
            "qc_reviewed": c.qc_reviewed,
            "created_at": c.created_at.isoformat(),
        }
        for c in rows
    ]
