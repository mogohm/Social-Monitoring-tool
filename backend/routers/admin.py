from fastapi import APIRouter, Header, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
import os

from backend.models.database import AsyncSessionLocal
from backend.models.models import ScraperConfig
from sqlalchemy import select

router = APIRouter(prefix="/api/admin", tags=["admin"])

ADMIN_TOKEN = os.getenv("ADMIN_TOKEN", "")


def require_admin(x_admin_token: str = Header(default="")):
    """Dependency: validates X-Admin-Token header."""
    if not ADMIN_TOKEN or x_admin_token != ADMIN_TOKEN:
        raise HTTPException(status_code=401, detail="Unauthorized — invalid or missing X-Admin-Token")


async def _get_or_create_default(db) -> ScraperConfig:
    """Return the default ScraperConfig row, creating it if not present."""
    row = (await db.execute(
        select(ScraperConfig).where(ScraperConfig.name == "default")
    )).scalar_one_or_none()
    if not row:
        row = ScraperConfig(name="default", enabled=True, interval_minutes=60)
        db.add(row)
        await db.commit()
        await db.refresh(row)
    return row


def _serialize(row: ScraperConfig) -> dict:
    return {
        "id": row.id,
        "name": row.name,
        "enabled": row.enabled,
        "interval_minutes": row.interval_minutes,
        "last_run_at": row.last_run_at.isoformat() if row.last_run_at else None,
        "last_posts_count": row.last_posts_count,
        "last_duration_seconds": row.last_duration_seconds,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }


@router.get("/scraper", dependencies=[Depends(require_admin)])
async def get_scraper_config():
    """Return current scraper config (auto-creates default row if absent)."""
    async with AsyncSessionLocal() as db:
        row = await _get_or_create_default(db)
        return _serialize(row)


class ScraperPatch(BaseModel):
    enabled: Optional[bool] = None
    interval_minutes: Optional[int] = Field(default=None, ge=1, le=120)


@router.patch("/scraper", dependencies=[Depends(require_admin)])
async def patch_scraper_config(body: ScraperPatch):
    """Update enabled flag and/or interval_minutes."""
    async with AsyncSessionLocal() as db:
        row = await _get_or_create_default(db)
        if body.enabled is not None:
            row.enabled = body.enabled
        if body.interval_minutes is not None:
            row.interval_minutes = body.interval_minutes
        row.updated_at = datetime.utcnow()
        await db.commit()
        await db.refresh(row)
        return _serialize(row)


class HeartbeatPayload(BaseModel):
    last_posts_count: int = 0
    last_duration_seconds: float = 0.0


@router.post("/scraper/heartbeat", dependencies=[Depends(require_admin)])
async def scraper_heartbeat(body: HeartbeatPayload):
    """Called by the local scraper after each cycle to report stats."""
    async with AsyncSessionLocal() as db:
        row = await _get_or_create_default(db)
        row.last_posts_count = body.last_posts_count
        row.last_duration_seconds = body.last_duration_seconds
        row.last_run_at = datetime.utcnow()
        row.updated_at = datetime.utcnow()
        await db.commit()
        return {"status": "ok", "last_run_at": row.last_run_at.isoformat()}
