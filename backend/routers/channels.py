from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional
from datetime import datetime
from backend.models.database import get_db
from backend.models.models import MonitoredChannel
from pydantic import BaseModel

router = APIRouter(prefix="/api/channels", tags=["channels"])

ALL_CHANNELS = [
    {"name": "facebook", "display_name": "Facebook"},
    {"name": "twitter", "display_name": "X (Twitter)"},
    {"name": "tiktok", "display_name": "TikTok"},
    {"name": "youtube", "display_name": "YouTube"},
    {"name": "instagram", "display_name": "Instagram"},
    {"name": "pantip", "display_name": "Pantip"},
    {"name": "line_oa", "display_name": "LINE OA"},
    {"name": "news", "display_name": "Online News"},
    {"name": "webboard", "display_name": "Webboard"},
    {"name": "reddit", "display_name": "Reddit"},
    {"name": "blog", "display_name": "Blog"},
]


class ChannelCreate(BaseModel):
    name: str
    display_name: str
    webhook_url: Optional[str] = None
    api_key: Optional[str] = None


class ChannelUpdate(BaseModel):
    display_name: Optional[str] = None
    webhook_url: Optional[str] = None
    api_key: Optional[str] = None
    is_active: Optional[bool] = None


@router.get("")
async def list_channels(db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(MonitoredChannel).order_by(MonitoredChannel.display_name))).scalars().all()
    return [_ser(c) for c in rows]


@router.post("/init")
async def init_default_channels(db: AsyncSession = Depends(get_db)):
    """Upsert all default channels."""
    added = 0
    for ch in ALL_CHANNELS:
        existing = (await db.execute(
            select(MonitoredChannel).where(MonitoredChannel.name == ch["name"])
        )).scalar_one_or_none()
        if not existing:
            db.add(MonitoredChannel(**ch))
            added += 1
    await db.commit()
    return {"added": added}


@router.post("", status_code=201)
async def create_channel(data: ChannelCreate, db: AsyncSession = Depends(get_db)):
    existing = (await db.execute(
        select(MonitoredChannel).where(MonitoredChannel.name == data.name)
    )).scalar_one_or_none()
    if existing:
        raise HTTPException(409, f"channel '{data.name}' already exists")
    ch = MonitoredChannel(**data.model_dump())
    db.add(ch)
    await db.commit()
    await db.refresh(ch)
    return _ser(ch)


@router.patch("/{ch_id}")
async def update_channel(ch_id: int, data: ChannelUpdate, db: AsyncSession = Depends(get_db)):
    ch = await db.get(MonitoredChannel, ch_id)
    if not ch:
        raise HTTPException(404, "not found")
    for field, val in data.model_dump(exclude_none=True).items():
        setattr(ch, field, val)
    if data.is_active and ch.last_synced is None:
        ch.last_synced = datetime.utcnow()
    await db.commit()
    await db.refresh(ch)
    return _ser(ch)


@router.delete("/{ch_id}", status_code=204)
async def delete_channel(ch_id: int, db: AsyncSession = Depends(get_db)):
    ch = await db.get(MonitoredChannel, ch_id)
    if not ch:
        raise HTTPException(404, "not found")
    await db.delete(ch)
    await db.commit()


def _ser(c: MonitoredChannel) -> dict:
    return {
        "id": c.id,
        "name": c.name,
        "display_name": c.display_name,
        "webhook_url": c.webhook_url,
        "is_active": c.is_active,
        "last_synced": c.last_synced.isoformat() if c.last_synced else None,
        "created_at": c.created_at.isoformat() if c.created_at else None,
    }
