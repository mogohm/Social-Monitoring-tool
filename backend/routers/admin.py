from fastapi import APIRouter, Header, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
import os

from backend.models.database import AsyncSessionLocal
from backend.models.models import ScraperConfig
from backend.utils.timefmt import utc_iso
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


# How many missed cycles before the scraper counts as down. Two and a bit:
# one cycle can overrun without meaning anything is wrong, but two in a row
# with nothing heard is not a slow cycle, it is silence.
STALE_CYCLE_FACTOR = 2.5
# A cycle can be short, so never call it down sooner than this.
STALE_FLOOR_SECONDS = 300


def _liveness(row: ScraperConfig) -> dict:
    """Decide whether the scraper is actually running.

    `enabled` records what an operator asked for, not what the process is
    doing — a scraper that died still has enabled=True, which is exactly the
    case the status page exists to catch. Liveness comes from the heartbeat
    instead, and is computed here so the UI and any other client cannot drift
    into disagreeing about it.
    """
    if row.last_run_at is None:
        return {"state": "never_reported", "seconds_since_last_run": None, "stale": True}

    age = (datetime.utcnow() - row.last_run_at).total_seconds()
    limit = max(row.interval_minutes * 60 * STALE_CYCLE_FACTOR, STALE_FLOOR_SECONDS)
    stale = age > limit

    if stale:
        state = "down"
    elif row.last_status in ("session_expired", "login_failed"):
        # Reporting in, but not collecting: needs a human at a browser.
        state = "needs_login"
    elif not row.enabled:
        state = "paused"
    else:
        state = "running"

    return {
        "state": state,
        "seconds_since_last_run": int(age),
        "stale": stale,
    }


def _serialize(row: ScraperConfig) -> dict:
    out = {
        "id": row.id,
        "name": row.name,
        "enabled": row.enabled,
        "interval_minutes": row.interval_minutes,
        "last_run_at": utc_iso(row.last_run_at) if row.last_run_at else None,
        "last_posts_count": row.last_posts_count,
        "last_duration_seconds": row.last_duration_seconds,
        "last_status": row.last_status,
        "last_error": row.last_error,
        "run_requested_at": utc_iso(row.run_requested_at) if row.run_requested_at else None,
        "stale_after_seconds": int(max(row.interval_minutes * 60 * STALE_CYCLE_FACTOR,
                                       STALE_FLOOR_SECONDS)),
        "updated_at": utc_iso(row.updated_at) if row.updated_at else None,
    }
    out.update(_liveness(row))
    return out


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
    # What the cycle did: ok | no_new | session_expired | login_failed | error.
    # Without this a heartbeat only proves the process is alive, not that it is
    # collecting — the scraper can report in happily while Facebook has signed
    # it out, which is the failure that went unnoticed for 38 hours once.
    status: Optional[str] = None
    error: Optional[str] = None
    # Echoed back from the config so the server can clear a run request only
    # when the scraper has actually acted on that specific one.
    acked_run_requested_at: Optional[str] = None


@router.post("/scraper/heartbeat", dependencies=[Depends(require_admin)])
async def scraper_heartbeat(body: HeartbeatPayload):
    """Called by the local scraper after each cycle to report stats."""
    async with AsyncSessionLocal() as db:
        row = await _get_or_create_default(db)
        row.last_posts_count = body.last_posts_count
        row.last_duration_seconds = body.last_duration_seconds
        row.last_status = (body.status or "ok")[:30]
        row.last_error = (body.error or None) and body.error[:300]
        row.last_run_at = datetime.utcnow()
        row.updated_at = datetime.utcnow()

        # Clear the run request only if the scraper acknowledged the one that is
        # currently pending. A request made while the cycle was already running
        # must survive, or pressing "run now" mid-cycle would be silently eaten.
        if row.run_requested_at and body.acked_run_requested_at:
            if utc_iso(row.run_requested_at) == body.acked_run_requested_at:
                row.run_requested_at = None

        await db.commit()
        return {"status": "ok", "last_run_at": utc_iso(row.last_run_at)}


@router.post("/scraper/run-now", dependencies=[Depends(require_admin)])
async def scraper_run_now():
    """Ask the scraper to start a cycle without waiting out its interval.

    The scraper polls during its wait, so this lands within about a minute —
    it cannot be instant, because nothing here can reach into the machine the
    scraper runs on. It only works while that process is alive; if the status
    is "down", this will sit unclaimed until the process comes back.
    """
    async with AsyncSessionLocal() as db:
        row = await _get_or_create_default(db)
        row.run_requested_at = datetime.utcnow()
        row.updated_at = datetime.utcnow()
        await db.commit()
        await db.refresh(row)
        return _serialize(row)
