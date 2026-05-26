from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import Optional
from backend.models.database import get_db
from backend.models.models import Keyword, Mention
from pydantic import BaseModel

router = APIRouter(prefix="/api/keywords", tags=["keywords"])


class KeywordCreate(BaseModel):
    word: str
    category: Optional[str] = None
    is_negative: bool = False


class KeywordUpdate(BaseModel):
    word: Optional[str] = None
    category: Optional[str] = None
    is_negative: Optional[bool] = None
    is_active: Optional[bool] = None


@router.get("")
async def list_keywords(
    active_only: bool = False,
    db: AsyncSession = Depends(get_db),
):
    q = select(Keyword).order_by(Keyword.match_count.desc(), Keyword.created_at.desc())
    if active_only:
        q = q.where(Keyword.is_active == True)
    rows = (await db.execute(q)).scalars().all()
    return [_ser(k) for k in rows]


@router.post("", status_code=201)
async def create_keyword(data: KeywordCreate, db: AsyncSession = Depends(get_db)):
    word_clean = data.word.strip()
    if not word_clean:
        raise HTTPException(400, "keyword cannot be empty")
    existing = await db.execute(select(Keyword).where(Keyword.word == word_clean))
    if existing.scalar_one_or_none():
        raise HTTPException(409, f"keyword '{word_clean}' already exists")
    kw = Keyword(word=word_clean, category=data.category, is_negative=data.is_negative)
    db.add(kw)
    await db.commit()
    await db.refresh(kw)
    return _ser(kw)


@router.patch("/{kw_id}")
async def update_keyword(kw_id: int, data: KeywordUpdate, db: AsyncSession = Depends(get_db)):
    kw = await db.get(Keyword, kw_id)
    if not kw:
        raise HTTPException(404, "not found")
    if data.word is not None:
        kw.word = data.word.strip()
    if data.category is not None:
        kw.category = data.category
    if data.is_negative is not None:
        kw.is_negative = data.is_negative
    if data.is_active is not None:
        kw.is_active = data.is_active
    await db.commit()
    await db.refresh(kw)
    return _ser(kw)


@router.delete("/{kw_id}", status_code=204)
async def delete_keyword(kw_id: int, db: AsyncSession = Depends(get_db)):
    kw = await db.get(Keyword, kw_id)
    if not kw:
        raise HTTPException(404, "not found")
    await db.delete(kw)
    await db.commit()


@router.get("/stats")
async def keyword_stats(db: AsyncSession = Depends(get_db)):
    """For each keyword, count how many mentions contain it."""
    keywords = (await db.execute(select(Keyword).where(Keyword.is_active == True))).scalars().all()
    results = []
    for kw in keywords:
        count_q = select(func.count()).where(
            Mention.content.ilike(f"%{kw.word}%")
        )
        count = (await db.execute(count_q)).scalar() or 0
        # update match_count in DB
        kw.match_count = count
        results.append({**_ser(kw), "mention_count": count})
    await db.commit()
    return results


def _ser(k: Keyword) -> dict:
    return {
        "id": k.id,
        "word": k.word,
        "category": k.category,
        "is_negative": k.is_negative,
        "is_active": k.is_active,
        "match_count": k.match_count,
        "created_at": k.created_at.isoformat() if k.created_at else None,
    }
