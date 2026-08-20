from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from backend.models.database import engine, Base, AsyncSessionLocal
from backend.models.models import Keyword, MonitoredChannel, ScraperConfig
from backend.routers import mentions, qc, webhook, keywords, channels, admin, alerts, risk
from sqlalchemy import select, text

DEFAULT_KEYWORDS = [
    {"word": "N8", "category": "brand", "is_negative": False},
    {"word": "Poker", "category": "product", "is_negative": False},
    {"word": "natural8", "category": "brand", "is_negative": False},
    {"word": "N8TH", "category": "brand", "is_negative": False},
    {"word": "N8 Thailand", "category": "brand", "is_negative": False},
    {"word": "poker card", "category": "product", "is_negative": False},
]

DEFAULT_CHANNELS = [
    "facebook", "twitter", "tiktok", "youtube",
    "instagram", "pantip", "line_oa", "news", "webboard",
]

CHANNEL_DISPLAY = {
    "facebook": "Facebook", "twitter": "X (Twitter)", "tiktok": "TikTok",
    "youtube": "YouTube", "instagram": "Instagram", "pantip": "Pantip",
    "line_oa": "LINE OA", "news": "Online News", "webboard": "Webboard",
}


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # Add new columns to alerts table if they don't exist (idempotent)
        for col_sql in [
            "ALTER TABLE alerts ADD COLUMN IF NOT EXISTS email_recipients JSONB DEFAULT '[]'",
            "ALTER TABLE alerts ADD COLUMN IF NOT EXISTS category_filter  JSONB DEFAULT '[]'",
            "ALTER TABLE alerts ADD COLUMN IF NOT EXISTS keywords         JSONB DEFAULT '[]'",
            "ALTER TABLE alerts ADD COLUMN IF NOT EXISTS channels         JSONB DEFAULT '[]'",
            "ALTER TABLE alerts ADD COLUMN IF NOT EXISTS condition_type   VARCHAR(50) DEFAULT 'keyword_match'",
            "ALTER TABLE alerts ADD COLUMN IF NOT EXISTS threshold        FLOAT",
            "ALTER TABLE alerts ADD COLUMN IF NOT EXISTS notify_email     BOOLEAN DEFAULT TRUE",
            "ALTER TABLE alerts ALTER COLUMN notify_line     SET DEFAULT FALSE",
            "ALTER TABLE alerts ALTER COLUMN notify_telegram SET DEFAULT FALSE",
            "ALTER TABLE alert_logs ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'sent'",
            "ALTER TABLE alert_logs ADD COLUMN IF NOT EXISTS error  TEXT",
            "ALTER TABLE keywords ADD COLUMN IF NOT EXISTS is_competitor BOOLEAN DEFAULT FALSE",
            "ALTER TABLE keywords ADD COLUMN IF NOT EXISTS risk_weight   FLOAT",
            "ALTER TABLE scraper_configs ADD COLUMN IF NOT EXISTS last_status      VARCHAR(30)",
            "ALTER TABLE scraper_configs ADD COLUMN IF NOT EXISTS last_error       VARCHAR(300)",
            "ALTER TABLE scraper_configs ADD COLUMN IF NOT EXISTS run_requested_at TIMESTAMP",
        ]:
            try:
                await conn.execute(text(col_sql))
            except Exception:
                pass
    async with AsyncSessionLocal() as db:
        for kw_data in DEFAULT_KEYWORDS:
            exists = (await db.execute(
                select(Keyword).where(Keyword.word == kw_data["word"])
            )).scalar_one_or_none()
            if not exists:
                db.add(Keyword(**kw_data))
        for ch_name in DEFAULT_CHANNELS:
            exists = (await db.execute(
                select(MonitoredChannel).where(MonitoredChannel.name == ch_name)
            )).scalar_one_or_none()
            if not exists:
                db.add(MonitoredChannel(
                    name=ch_name,
                    display_name=CHANNEL_DISPLAY.get(ch_name, ch_name),
                ))
        # Seed default ScraperConfig row
        sc_exists = (await db.execute(
            select(ScraperConfig).where(ScraperConfig.name == "default")
        )).scalar_one_or_none()
        if not sc_exists:
            db.add(ScraperConfig(name="default", enabled=True, interval_minutes=60))
        await db.commit()
    yield


app = FastAPI(title="SocialEye Monitor API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(mentions.router)
app.include_router(qc.router)
app.include_router(webhook.router)
app.include_router(keywords.router)
app.include_router(channels.router)
app.include_router(admin.router)
app.include_router(alerts.router)
app.include_router(risk.router)


@app.get("/")
async def root():
    return {"status": "ok", "service": "SocialEye Monitor API"}


@app.get("/health")
async def health():
    return {"status": "healthy"}


@app.get("/deploy-info")
async def deploy_info():
    """Report which Vercel environment served this request.

    VERCEL_ENV is set by Vercel itself to 'production' or 'preview', so this
    answers "did this push deploy to production?" directly instead of by
    inference. Requires 'System Environment Variables' enabled on the project.
    """
    import os as _os
    return {
        "vercel_env":  _os.getenv("VERCEL_ENV", "(unset — not on Vercel?)"),
        "git_branch":  _os.getenv("VERCEL_GIT_COMMIT_REF", "(unset)"),
        "commit_sha":  (_os.getenv("VERCEL_GIT_COMMIT_SHA", "") or "(unset)")[:7],
        "commit_msg":  _os.getenv("VERCEL_GIT_COMMIT_MESSAGE", "(unset)")[:80],
    }
