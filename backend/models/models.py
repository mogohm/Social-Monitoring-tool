from datetime import datetime
from sqlalchemy import (
    String, Text, Integer, Float, Boolean, DateTime,
    ForeignKey, Enum, JSON
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from backend.models.database import Base
import enum


class SentimentEnum(str, enum.Enum):
    positive = "positive"
    neutral = "neutral"
    negative = "negative"


class PriorityEnum(str, enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


class ChannelEnum(str, enum.Enum):
    facebook = "facebook"
    twitter = "twitter"
    tiktok = "tiktok"
    youtube = "youtube"
    instagram = "instagram"
    pantip = "pantip"
    line_oa = "line_oa"
    news = "news"
    webboard = "webboard"
    other = "other"


class Mention(Base):
    __tablename__ = "mentions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    external_id: Mapped[str | None] = mapped_column(String(255), unique=True)
    channel: Mapped[str] = mapped_column(String(50))
    author: Mapped[str | None] = mapped_column(String(255))
    author_id: Mapped[str | None] = mapped_column(String(255))
    content: Mapped[str] = mapped_column(Text)
    url: Mapped[str | None] = mapped_column(Text)
    image_url: Mapped[str | None] = mapped_column(Text)
    sentiment: Mapped[str | None] = mapped_column(String(20))
    emotion: Mapped[str | None] = mapped_column(String(50))
    intent: Mapped[str | None] = mapped_column(String(50))
    topic: Mapped[str | None] = mapped_column(String(100))
    risk_score: Mapped[float | None] = mapped_column(Float)
    priority: Mapped[str | None] = mapped_column(String(20))
    engagement: Mapped[int] = mapped_column(Integer, default=0)
    reach: Mapped[int] = mapped_column(Integer, default=0)
    likes: Mapped[int] = mapped_column(Integer, default=0)
    comments: Mapped[int] = mapped_column(Integer, default=0)
    shares: Mapped[int] = mapped_column(Integer, default=0)
    views: Mapped[int] = mapped_column(Integer, default=0)
    virality_score: Mapped[float | None] = mapped_column(Float)
    ai_summary: Mapped[str | None] = mapped_column(Text)
    suggested_action: Mapped[str | None] = mapped_column(String(100))
    tags: Mapped[list | None] = mapped_column(JSON)
    language: Mapped[str | None] = mapped_column(String(10))
    location: Mapped[str | None] = mapped_column(String(255))
    is_reviewed: Mapped[bool] = mapped_column(Boolean, default=False)
    is_spam: Mapped[bool] = mapped_column(Boolean, default=False)
    assigned_to: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"))
    project_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("projects.id"))
    published_at: Mapped[datetime | None] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text)
    keywords: Mapped[list | None] = mapped_column(JSON)
    channels: Mapped[list | None] = mapped_column(JSON)
    competitors: Mapped[list | None] = mapped_column(JSON)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True)
    full_name: Mapped[str] = mapped_column(String(255))
    hashed_password: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(50), default="analyst")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Alert(Base):
    __tablename__ = "alerts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(255))
    # condition_type: "all" | "keyword_match" | "risk_score" | "category"
    condition_type: Mapped[str] = mapped_column(String(50), default="keyword_match")
    threshold: Mapped[float | None] = mapped_column(Float)          # risk_score min
    keywords: Mapped[list | None] = mapped_column(JSON)             # specific keywords to watch ([] = any)
    category_filter: Mapped[list | None] = mapped_column(JSON)      # categories to watch
    channels: Mapped[list | None] = mapped_column(JSON)             # facebook, etc. ([] = all)
    email_recipients: Mapped[list | None] = mapped_column(JSON)     # ["a@b.com", "c@d.com"]
    notify_email: Mapped[bool] = mapped_column(Boolean, default=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Case(Base):
    __tablename__ = "cases"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    mention_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("mentions.id"))
    project_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("projects.id"))
    title: Mapped[str] = mapped_column(String(500))
    description: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(50), default="open")
    priority: Mapped[str] = mapped_column(String(20), default="medium")
    assigned_to: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"))
    created_by: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"))
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Keyword(Base):
    __tablename__ = "keywords"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    word: Mapped[str] = mapped_column(String(255), unique=True)
    category: Mapped[str | None] = mapped_column(String(100))
    is_negative: Mapped[bool] = mapped_column(Boolean, default=False)
    # Tracked as a competitor term — orthogonal to is_negative, so a word can
    # be both (e.g. a rival brand mentioned in complaints).
    is_competitor: Mapped[bool] = mapped_column(Boolean, default=False)
    # Per-word override for the "user flagged negative" points. NULL falls back
    # to RiskConfig.user_negative_pts, so "โกงเงิน" can outweigh "ช้า".
    risk_weight: Mapped[float | None] = mapped_column(Float)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    match_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class MonitoredChannel(Base):
    __tablename__ = "monitored_channels"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True)
    display_name: Mapped[str] = mapped_column(String(100))
    webhook_url: Mapped[str | None] = mapped_column(Text)
    api_key: Mapped[str | None] = mapped_column(String(500))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_synced: Mapped[datetime | None] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class AdminChat(Base):
    __tablename__ = "admin_chats"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    admin_id: Mapped[str] = mapped_column(String(255))
    admin_name: Mapped[str | None] = mapped_column(String(255))
    customer_id: Mapped[str] = mapped_column(String(255))
    channel: Mapped[str] = mapped_column(String(50), default="line_oa")
    message: Mapped[str] = mapped_column(Text)
    direction: Mapped[str] = mapped_column(String(10))  # in / out
    response_time_sec: Mapped[int | None] = mapped_column(Integer)
    politeness_score: Mapped[float | None] = mapped_column(Float)
    accuracy_score: Mapped[float | None] = mapped_column(Float)
    script_compliant: Mapped[bool | None] = mapped_column(Boolean)
    has_forbidden_words: Mapped[bool] = mapped_column(Boolean, default=False)
    tags: Mapped[list | None] = mapped_column(JSON)
    qc_reviewed: Mapped[bool] = mapped_column(Boolean, default=False)
    qc_notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class AlertLog(Base):
    __tablename__ = "alert_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    alert_id: Mapped[int] = mapped_column(Integer, ForeignKey("alerts.id", ondelete="CASCADE"))
    mention_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("mentions.id", ondelete="SET NULL"))
    sent_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    recipients: Mapped[list | None] = mapped_column(JSON)
    channel: Mapped[str | None] = mapped_column(String(50))
    author: Mapped[str | None] = mapped_column(String(255))
    content_preview: Mapped[str | None] = mapped_column(String(300))
    risk_score: Mapped[float | None] = mapped_column(Float)
    topic: Mapped[str | None] = mapped_column(String(100))
    matched_keywords: Mapped[list | None] = mapped_column(JSON)
    mention_url: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), default="sent")   # sent | failed
    error: Mapped[str | None] = mapped_column(Text)


class RiskConfig(Base):
    """Tunable weights for the risk score.

    These were hardcoded, so changing how risk is judged meant a code deploy.
    Held in a single row (name="default") the dashboard can edit.
    """
    __tablename__ = "risk_configs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(50), unique=True, default="default")

    # Rule-based components
    negative_sentiment_pts: Mapped[float] = mapped_column(Float, default=40)
    keyword_hit_pts: Mapped[float] = mapped_column(Float, default=10)
    keyword_hit_cap: Mapped[float] = mapped_column(Float, default=40)
    long_text_pts: Mapped[float] = mapped_column(Float, default=10)
    long_text_chars: Mapped[int] = mapped_column(Integer, default=200)
    # Applied when a keyword the user flagged Negative is matched
    user_negative_pts: Mapped[float] = mapped_column(Float, default=35)
    user_negative_cap: Mapped[float] = mapped_column(Float, default=70)

    # Score -> priority thresholds
    critical_at: Mapped[float] = mapped_column(Float, default=80)
    high_at: Mapped[float] = mapped_column(Float, default=60)
    medium_at: Mapped[float] = mapped_column(Float, default=40)

    # Let the model score first when an OpenAI key is configured; the weights
    # above still apply on top, so operator judgement is never overridden.
    use_ai: Mapped[bool] = mapped_column(Boolean, default=True)

    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ScraperConfig(Base):
    __tablename__ = "scraper_configs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(50), unique=True)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    interval_minutes: Mapped[int] = mapped_column(Integer, default=60)
    last_run_at: Mapped[datetime | None] = mapped_column(DateTime)
    last_posts_count: Mapped[int] = mapped_column(Integer, default=0)
    last_duration_seconds: Mapped[float] = mapped_column(Float, default=0.0)
    # What the last cycle actually did. "enabled" only records what an operator
    # asked for, so it cannot answer "is it working" — a dead scraper still has
    # enabled=True. These two, with last_run_at, are what the status page reads.
    last_status: Mapped[str | None] = mapped_column(String(30))
    last_error: Mapped[str | None] = mapped_column(String(300))
    # Set by the admin UI to ask for an immediate cycle; the scraper clears it
    # once it has acted, so a stale request cannot retrigger forever.
    run_requested_at: Mapped[datetime | None] = mapped_column(DateTime)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
