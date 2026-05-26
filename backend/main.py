from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from backend.models.database import engine, Base, AsyncSessionLocal
from backend.models.models import Keyword, MonitoredChannel
from backend.routers import mentions, qc, webhook, keywords, channels
from sqlalchemy import select

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


@app.get("/")
async def root():
    return {"status": "ok", "service": "SocialEye Monitor API"}


@app.get("/health")
async def health():
    return {"status": "healthy"}
