from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from backend.models.database import engine, Base
from backend.routers import mentions, qc, webhook


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
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


@app.get("/")
async def root():
    return {"status": "ok", "service": "SocialEye Monitor API"}


@app.get("/health")
async def health():
    return {"status": "healthy"}
