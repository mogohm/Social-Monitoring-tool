from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
from typing import Optional
from backend.services.ai_service import analyze_text
from backend.services.risk_service import load_weights, apply_user_keywords, priority_for
from backend.models.database import AsyncSessionLocal
from backend.models.models import Mention, Keyword, AdminChat
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from datetime import datetime
import re
import unicodedata

router = APIRouter(prefix="/api/webhook", tags=["webhook"])

# Facebook hides its injected tokens by inserting an invisible character between
# every letter (U+034F COMBINING GRAPHEME JOINER, ~300 per handful of posts), so
# a token that looks like "pndeots" is really p·n·d·e·o·t·s and no contiguous
# [A-Za-z0-9]{12,} run ever matches. Strip these first, then filter.
#
# Only zero-width joiners/spaces are listed — NOT every combining mark, because
# Thai vowels and tone marks (U+0E31, U+0E34-0E3A, U+0E47-0E4E) are combining
# marks too and removing them would destroy the Thai text.
_INVISIBLE = re.compile(
    "["
    "͏"            # COMBINING GRAPHEME JOINER  ← what Facebook uses
    "​-‏"     # zero-width space/joiners, LTR/RTL marks
    "‪-‮"     # bidi embedding/override
    "⁠-⁤"     # word joiner, invisible operators
    "﻿"            # zero-width no-break space (BOM)
    "­"            # soft hyphen
    "]"
)

# A run of characters each followed by CGJ is, by construction, one of
# Facebook's injected tokens — real user text never contains CGJ. Matching the
# whole run (not just the CGJ) removes the token outright.
_CGJ_RUN = re.compile(r'(?:[^\n]͏)+[^\n]?')

# Facebook only CGJ-separates part of a token; the tail arrives contiguous
# (e.g. "fm8a135h6rte95"), so a second pass catches those.
_ALNUM_RUN = re.compile(r'[A-Za-z0-9]{8,}')

# The scraper sometimes emits a token one character per line. Trailing spaces
# break the run, so lines are rstripped before this is applied, and it is
# applied repeatedly because removing one run can join two others.
_CHAR_LINES = re.compile(r'(?:^.{1,2}$\n?){3,}', re.MULTILINE)


def _looks_like_token(s: str) -> bool:
    """True for random alphanumeric noise, false for real words and numbers."""
    if s.isalpha() or s.isdigit():
        return False                       # "announcement", "12345" — keep
    digits = sum(1 for c in s if c.isdigit())
    # Heavily digit-interleaved mixed strings are generated tokens.
    # "N8Thailand" (1/10) and "natural8" (1/8) stay; "fm8a135h6rte95" (7/14) goes.
    return digits / len(s) >= 0.3


def _clean_content(text: str) -> str:
    """Strip Facebook tracking/obfuscation tokens from post content."""
    text = unicodedata.normalize("NFC", text)
    text = _CGJ_RUN.sub("", text)                  # CGJ-obfuscated tokens
    text = _INVISIBLE.sub("", text)                # any stray invisibles left
    text = text.replace("\xa0", " ")               # nbsp → normal space
    text = _ALNUM_RUN.sub(lambda m: "" if _looks_like_token(m.group(0)) else m.group(0), text)

    # Normalise whitespace before the line-shaped pass so trailing spaces
    # don't break up a run of single-character lines.
    text = re.sub(r'[ \t]{2,}', ' ', text)
    text = "\n".join(ln.strip() for ln in text.split("\n"))

    for _ in range(5):                             # removing one run can join two
        stripped = _CHAR_LINES.sub("", text)
        if stripped == text:
            break
        text = stripped

    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()


class MentionPayload(BaseModel):
    channel: str
    author: str
    content: str
    url: Optional[str] = None
    image_url: Optional[str] = None
    image_urls: Optional[list] = None   # รูปทั้งหมดในโพสต์
    author_id: Optional[str] = None
    external_id: Optional[str] = None
    published_at: Optional[str] = None  # ISO string หรือ unix timestamp str
    likes: int = 0
    comments: int = 0
    shares: int = 0
    views: int = 0


def _is_unique_violation(exc: IntegrityError) -> bool:
    """True for a duplicate-key collision, false for every other constraint.

    The Postgres code is 23505, but where it can be read from depends on the
    driver stack. SQLAlchemy's asyncpg adapter wraps the asyncpg exception in
    its own DBAPI-shaped error, and that wrapper does not always carry the code
    forward on .orig — reading only exc.orig.sqlstate returned None here and
    sent every duplicate back out as a 500. So try the places the code can
    appear, then fall back to the message Postgres itself emits.
    """
    seen = []
    err = getattr(exc, "orig", None) or exc
    while err is not None and err not in seen and len(seen) < 5:
        seen.append(err)
        for attr in ("sqlstate", "pgcode"):
            code = getattr(err, attr, None)
            if code:
                return str(code) == "23505"
        err = getattr(err, "__cause__", None)
    return "duplicate key value violates unique constraint" in str(
        getattr(exc, "orig", None) or exc
    )


async def _match_keywords(content: str, db) -> list[dict]:
    kws = (await db.execute(select(Keyword).where(Keyword.is_active == True))).scalars().all()
    matched, lower = [], content.lower()
    for kw in kws:
        if kw.word.lower() in lower:
            matched.append({
                "word": kw.word,
                "category": kw.category or "general",
                "is_negative": kw.is_negative,
                "risk_weight": kw.risk_weight,
            })
            kw.match_count = (kw.match_count or 0) + 1
    return matched


@router.post("/mention")
async def generic_webhook(payload: MentionPayload):
    """Universal endpoint — receives data from any external collector (Python scripts, n8n, Make.com)."""
    # Clean obfuscation tokens before analysis and storage
    clean = _clean_content(payload.content)
    if not clean or len(clean) < 5:
        clean = payload.content  # fallback to original if over-stripped
    payload = payload.model_copy(update={"content": clean})

    async with AsyncSessionLocal() as db:
        weights = await load_weights(db)
        analysis = await analyze_text(payload.content, weights)
        tags = await _match_keywords(payload.content, db)

        # Operator-flagged keywords weigh in on top of whatever produced the
        # base score (rules or the model), so a word marked dangerous always
        # raises the score even when the model called the post harmless.
        boosted, neg_hits = apply_user_keywords(
            analysis.get("risk_score") or 0, tags, weights
        )
        if neg_hits:
            analysis["sentiment"] = "negative"
            analysis["emotion"] = "anger"
            analysis["intent"] = "complaint"
        analysis["risk_score"] = boosted
        analysis["priority"] = priority_for(boosted, weights)
        # parse published_at
        pub_at = datetime.utcnow()
        if payload.published_at:
            try:
                ts = payload.published_at.strip()
                if ts.isdigit():
                    pub_at = datetime.utcfromtimestamp(int(ts))
                else:
                    from dateutil import parser as dp
                    pub_at = dp.parse(ts)
            except Exception:
                pass

        # รูปหลัก — ใช้รูปแรกใน image_urls ถ้ามี (filter rsrc.php / static icons)
        def _is_content_image(url: str) -> bool:
            return bool(url and "scontent" in url and "rsrc.php" not in url)

        img_url = payload.image_url if _is_content_image(payload.image_url or "") else None
        if not img_url and payload.image_urls:
            for u in payload.image_urls:
                if _is_content_image(u):
                    img_url = u
                    break

        extra_tags = tags if tags else []

        mention = Mention(
            channel=payload.channel,
            author=payload.author,
            author_id=payload.author_id,
            external_id=payload.external_id,
            content=payload.content,
            url=payload.url,
            image_url=img_url,
            likes=payload.likes,
            comments=payload.comments,
            shares=payload.shares,
            views=payload.views,
            engagement=payload.likes + payload.comments + payload.shares,
            sentiment=analysis.get("sentiment"),
            emotion=analysis.get("emotion"),
            intent=analysis.get("intent"),
            topic=analysis.get("topic"),
            risk_score=analysis.get("risk_score"),
            priority=analysis.get("priority"),
            ai_summary=analysis.get("summary"),
            suggested_action=analysis.get("suggested_action"),
            tags=extra_tags if extra_tags else None,
            published_at=pub_at,
        )
        db.add(mention)
        try:
            await db.commit()
        except IntegrityError as exc:
            # external_id is unique, so re-sending a post already stored raised
            # here and became a 500 — which the collector reads as "delivery
            # failed". A collector that lost its dedup file (new machine, wiped
            # state) then re-sends its whole backlog and every already-known
            # post looks like an outage. Already stored is a success, not an
            # error: report it plainly and let the caller move on.
            #
            # Only a unique violation means that. Any other constraint failure
            # is a genuine defect and must keep surfacing as a 500 instead of
            # being reported back as a stored post.
            if not _is_unique_violation(exc):
                raise
            await db.rollback()
            return {
                "status": "duplicate",
                "channel": payload.channel,
                "external_id": payload.external_id,
                "keywords_matched": 0,
                "alerts_sent": 0,
            }
        await db.refresh(mention)

    # Must await — Vercel freezes the serverless function the moment the HTTP
    # response is returned, so a fire-and-forget task would never run.
    matched_names = [t["word"] for t in tags]
    alerts_sent = await _fire_alerts(mention, matched_names)

    return {
        "status": "ok",
        "channel": payload.channel,
        "keywords_matched": len(tags),
        "alerts_sent": alerts_sent,
    }


async def _fire_alerts(mention: Mention, matched_names: list) -> int:
    """Evaluate and send alerts. Never raises — a failure here must not
    cause the collector to think the mention wasn't stored."""
    try:
        from backend.routers.alerts import check_and_send_alerts
        return await check_and_send_alerts(mention, matched_names)
    except Exception as exc:
        print(f"[alerts] fire error: {exc}")
        return 0


@router.post("/line")
async def line_webhook(request: Request):
    body = await request.json()
    events = body.get("events", [])
    async with AsyncSessionLocal() as db:
        for event in events:
            if event.get("type") == "message" and event["message"]["type"] == "text":
                text = event["message"]["text"]
                source = event.get("source", {})
                user_id = source.get("userId", "unknown")
                is_from_admin = source.get("type") == "group"

                if not is_from_admin:
                    analysis = await analyze_text(text)
                    mention = Mention(
                        channel="line_oa",
                        author=user_id,
                        content=text,
                        sentiment=analysis.get("sentiment"),
                        risk_score=analysis.get("risk_score"),
                        priority=analysis.get("priority"),
                        ai_summary=analysis.get("summary"),
                        published_at=datetime.utcnow(),
                    )
                    db.add(mention)

                chat = AdminChat(
                    admin_id="line_system",
                    customer_id=user_id,
                    channel="line_oa",
                    message=text,
                    direction="in" if not is_from_admin else "out",
                    created_at=datetime.utcnow(),
                )
                db.add(chat)
        await db.commit()
    return {"status": "ok"}


@router.post("/facebook")
async def facebook_webhook(request: Request):
    body = await request.json()
    entries = body.get("entry", [])
    async with AsyncSessionLocal() as db:
        for entry in entries:
            for change in entry.get("changes", []):
                value = change.get("value", {})
                message = value.get("message", {})
                if message:
                    text = message.get("message", "")
                    if text:
                        analysis = await analyze_text(text)
                        mention = Mention(
                            channel="facebook",
                            author=value.get("from", {}).get("name"),
                            content=text,
                            sentiment=analysis.get("sentiment"),
                            risk_score=analysis.get("risk_score"),
                            priority=analysis.get("priority"),
                            ai_summary=analysis.get("summary"),
                            published_at=datetime.utcnow(),
                        )
                        db.add(mention)
        await db.commit()
    return {"status": "ok"}


@router.get("/facebook")
async def facebook_verify(request: Request):
    params = dict(request.query_params)
    if params.get("hub.verify_token") == "socialeye_verify_token":
        return int(params.get("hub.challenge", 0))
    raise HTTPException(status_code=403, detail="Invalid verify token")
