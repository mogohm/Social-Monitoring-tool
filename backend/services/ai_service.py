import re
from typing import Optional
from backend.config import settings

try:
    from openai import AsyncOpenAI
    _openai_client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY) if settings.OPENAI_API_KEY else None
except Exception:
    _openai_client = None

NEGATIVE_KEYWORDS = ["แย่", "หลอก", "โกง", "เลว", "เสีย", "ไม่ดี", "รอนาน", "ช้า", "ผิดหวัง"]
FORBIDDEN_WORDS = ["ไอ้", "อีสัตว์", "มึง", "กู", "บ้า"]


def _rule_based_sentiment(text: str) -> str:
    neg_count = sum(1 for w in NEGATIVE_KEYWORDS if w in text)
    positive_keywords = ["ดี", "ชอบ", "ขอบคุณ", "ประทับใจ", "เยี่ยม", "สวย", "คุ้ม"]
    pos_count = sum(1 for w in positive_keywords if w in text)
    if neg_count > pos_count:
        return "negative"
    elif pos_count > neg_count:
        return "positive"
    return "neutral"


def _risk_score(text: str, sentiment: str) -> float:
    score = 0.0
    if sentiment == "negative":
        score += 40
    neg_hits = sum(1 for w in NEGATIVE_KEYWORDS if w in text)
    score += min(neg_hits * 10, 40)
    if len(text) > 200:
        score += 10
    return min(score, 100.0)


async def analyze_text(text: str) -> dict:
    if _openai_client and settings.OPENAI_API_KEY:
        return await _analyze_with_openai(text)
    return _analyze_rule_based(text)


def _analyze_rule_based(text: str) -> dict:
    sentiment = _rule_based_sentiment(text)
    risk = _risk_score(text, sentiment)
    priority = "low"
    if risk >= 80:
        priority = "critical"
    elif risk >= 60:
        priority = "high"
    elif risk >= 40:
        priority = "medium"

    has_forbidden = any(w in text for w in FORBIDDEN_WORDS)
    return {
        "sentiment": sentiment,
        "emotion": "anger" if sentiment == "negative" else "neutral",
        "intent": "complaint" if sentiment == "negative" else "general",
        "topic": "general",
        "risk_score": risk,
        "priority": priority,
        "suggested_action": "escalate_to_service_team" if priority in ("high", "critical") else "monitor",
        "summary": text[:100] + "..." if len(text) > 100 else text,
        "has_forbidden_words": has_forbidden,
    }


async def _analyze_with_openai(text: str) -> dict:
    try:
        response = await _openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a Thai social media analyst. Analyze the given text and respond "
                        "in JSON with these fields: sentiment (positive/neutral/negative), "
                        "emotion (anger/joy/sadness/fear/neutral), intent (complaint/inquiry/praise/general), "
                        "topic (string), risk_score (0-100 float), priority (low/medium/high/critical), "
                        "suggested_action (string), summary (Thai, max 50 chars)."
                    ),
                },
                {"role": "user", "content": text},
            ],
            response_format={"type": "json_object"},
            temperature=0,
        )
        import json
        result = json.loads(response.choices[0].message.content)
        result["has_forbidden_words"] = any(w in text for w in FORBIDDEN_WORDS)
        return result
    except Exception:
        return _analyze_rule_based(text)
