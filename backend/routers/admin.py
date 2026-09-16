from fastapi import APIRouter, Header, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
import os

from backend.models.database import AsyncSessionLocal
from backend.models.models import ScraperConfig
from backend.utils.timefmt import utc_iso
from backend.services.email_service import send_scraper_status_email
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
        "down_alert_sent_at": utc_iso(row.down_alert_sent_at) if row.down_alert_sent_at else None,
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


# ─── Health watchdog (called by Vercel Cron) ────────────────────────────────

def _alert_recipients() -> list:
    """Who hears about an outage.

    Defaults to the mailbox the alerts already send from, so this works with no
    extra configuration; SCRAPER_ALERT_EMAILS overrides when it should go
    somewhere else.
    """
    raw = os.getenv("SCRAPER_ALERT_EMAILS", "") or os.getenv("SMTP_USER", "")
    return [a.strip() for a in raw.split(",") if a.strip()]


def _authorised_watchdog(x_admin_token: str, authorization: str) -> bool:
    """Accept the admin header, or the bearer token Vercel Cron sends."""
    if ADMIN_TOKEN and x_admin_token == ADMIN_TOKEN:
        return True
    expected = os.getenv("CRON_SECRET", "") or ADMIN_TOKEN
    if expected and authorization == f"Bearer {expected}":
        return True
    return False


def _human_gap(seconds) -> str:
    if seconds is None:
        return "ไม่เคยรายงาน"
    d, rem = divmod(int(seconds), 86400)
    h, rem = divmod(rem, 3600)
    m = rem // 60
    if d:
        return f"{d} วัน {h} ชม."
    if h:
        return f"{h} ชม. {m} นาที"
    return f"{m} นาที"


# Vercel Cron invokes with GET; POST is kept so it can be triggered by hand.
@router.get("/scraper/health-check")
@router.post("/scraper/health-check")
async def scraper_health_check(
    test: int = 0,
    x_admin_token: str = Header(default=""),
    authorization: str = Header(default=""),
):
    """Notice that the collector has gone quiet, and say so by email.

    The status page can already show this, but only to someone who opens it.
    The scraper was down for four days after a Windows Update reboot left the
    machine at a lock screen, and nothing said a word — which is the whole
    reason this runs in the cloud instead of next to the scraper.

    One email per outage: sending on the way in, and a second on recovery, is
    enough to act on. Repeating it hourly trains the recipient to filter it,
    and then the next outage is invisible again.
    """
    if not _authorised_watchdog(x_admin_token, authorization):
        raise HTTPException(status_code=401, detail="Unauthorized")

    recipients_now = _alert_recipients()
    if test:
        # Proves the whole path — template, SMTP, inbox — without waiting for a
        # real outage. An alert nobody has ever seen arrive is not an alert.
        # Deliberately does not touch down_alert_sent_at, so a test cannot
        # suppress the next genuine warning.
        ok = await send_scraper_status_email(
            recipients_now,
            subject="🧪 [SocialEye] ทดสอบระบบแจ้งเตือนสถานะ Scraper",
            title="🧪 ทดสอบระบบแจ้งเตือน",
            colour="#2563eb",
            lines=[
                ("ข้อความนี้คือ", "การทดสอบ ไม่ใช่เหตุขัดข้องจริง"),
                ("ถ้าได้รับอีเมลนี้", "ระบบจะแจ้งได้จริงเมื่อ scraper หยุดทำงาน"),
                ("ตรวจทุกวัน", "09:00 น. (เวลาไทย) จาก Vercel Cron"),
            ],
        )
        return {"action": "test_sent" if ok else "test_failed",
                "recipients": recipients_now}

    async with AsyncSessionLocal() as db:
        row = await _get_or_create_default(db)
        live = _liveness(row)
        state = live["state"]
        bad = state in ("down", "never_reported", "needs_login")
        recipients = _alert_recipients()
        action = "none"

        if bad and row.down_alert_sent_at is None:
            titles = {
                "down": ("🔴 Scraper หยุดทำงาน", "#dc2626"),
                "needs_login": ("🟠 Scraper ต้อง login Facebook ใหม่", "#d97706"),
                "never_reported": ("⚪ Scraper ไม่เคยรายงานตัว", "#6b7280"),
            }
            title, colour = titles[state]
            hints = {
                "down": "process ไม่ได้รันอยู่ — เปิดด้วย run_scraper_hidden.vbs บนเครื่องที่ติดตั้งไว้",
                "needs_login": "ยังรายงานอยู่แต่ Facebook เตะออก — ต้อง login ด้วยมือผ่าน browser ที่เห็นหน้าต่าง",
                "never_reported": "ตรวจว่า ADMIN_TOKEN ฝั่ง API กับใน backend/.env ตรงกันหรือไม่",
            }
            sent = await send_scraper_status_email(
                recipients,
                subject=f"⚠️ [SocialEye] {title}",
                title=title,
                colour=colour,
                lines=[
                    ("สถานะ", state),
                    ("เงียบมาแล้ว", _human_gap(live["seconds_since_last_run"])),
                    ("heartbeat ล่าสุด", utc_iso(row.last_run_at) if row.last_run_at else "ไม่เคย"),
                    ("รอบที่ตั้งไว้", f"{row.interval_minutes} นาที"),
                    ("สาเหตุที่รายงานล่าสุด", row.last_status or "—"),
                    ("ต้องทำอะไร", hints[state]),
                ],
            )
            if sent:
                row.down_alert_sent_at = datetime.utcnow()
                await db.commit()
                action = "alert_sent"
            else:
                # Leave the marker unset so the next run retries rather than
                # recording an alert that never reached anyone.
                action = "alert_failed"

        elif not bad and row.down_alert_sent_at is not None:
            await send_scraper_status_email(
                recipients,
                subject="✅ [SocialEye] Scraper กลับมาทำงานแล้ว",
                title="✅ Scraper กลับมาทำงานแล้ว",
                colour="#16a34a",
                lines=[
                    ("สถานะ", state),
                    ("เงียบไปทั้งหมด", _human_gap(
                        (datetime.utcnow() - row.down_alert_sent_at).total_seconds())),
                    ("เก็บได้รอบล่าสุด", f"{row.last_posts_count} โพสต์"),
                ],
            )
            row.down_alert_sent_at = None
            await db.commit()
            action = "recovery_sent"

        return {"state": state, "action": action, "recipients": recipients}
