import re
from typing import Optional
from backend.config import settings
from backend.services.risk_service import RiskWeights, DEFAULTS, rule_score, priority_for

try:
    from openai import AsyncOpenAI
    _openai_client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY) if settings.OPENAI_API_KEY else None
except Exception:
    _openai_client = None

NEGATIVE_KEYWORDS = [
    "แย่", "หลอก", "โกง", "เลว", "เสีย", "ไม่ดี", "รอนาน", "ช้า", "ผิดหวัง",
    "ถอนไม่ได้", "ฝากไม่ได้", "ไม่ได้เงิน", "เงินหาย", "ไม่จ่าย", "โกงเงิน",
    "ระบบล่ม", "เข้าไม่ได้", "ล็อกไม่ได้", "ใช้ไม่ได้", "ไม่ตอบ", "หายไป",
]
FORBIDDEN_WORDS = ["ไอ้", "อีสัตว์", "มึง", "กู", "บ้า"]

_CATEGORY_RULES = [
    ("scam",               ["โกง", "หลอก", "ไม่ได้เงิน", "เงินหาย", "ฉ้อโกง", "โกงเงิน", "ไม่จ่าย", "หนีเงิน"]),
    ("deposit_withdrawal", ["ฝาก", "ถอน", "โอนเงิน", "เติมเงิน", "ถอนเงิน", "ฝากเงิน", "withdraw", "deposit"]),
    ("promotion",          ["โปร", "โบนัส", "bonus", "cashback", "แจก", "ฟรี", "rebate", "คืนยอด"]),
    ("system",             ["ระบบ", "แอป", "เว็บล่ม", "error", "bug", "ล็อก", "login", "เข้าไม่ได้"]),
    ("game",               ["poker", "สล็อต", "บาคาร่า", "ไพ่", "เกม", "slot", "บอล", "แทง"]),
    ("brand",              ["n8", "natural8", "n8th", "naturals8", "socialeye"]),
]


def _classify_category(text: str) -> str:
    lower = text.lower()
    for category, kws in _CATEGORY_RULES:
        if any(k in lower for k in kws):
            return category
    return "general"


def _rule_based_sentiment(text: str) -> str:
    neg_count = sum(1 for w in NEGATIVE_KEYWORDS if w in text)
    positive_keywords = ["ดี", "ชอบ", "ขอบคุณ", "ประทับใจ", "เยี่ยม", "สวย", "คุ้ม"]
    pos_count = sum(1 for w in positive_keywords if w in text)
    if neg_count > pos_count:
        return "negative"
    elif pos_count > neg_count:
        return "positive"
    return "neutral"


def count_negative_hits(text: str) -> int:
    return sum(1 for w in NEGATIVE_KEYWORDS if w in text)


async def analyze_text(text: str, weights: RiskWeights = DEFAULTS) -> dict:
    """Analyse a post. Uses the model when a key is configured and `use_ai` is
    on; otherwise falls back to the configurable rule score."""
    if _openai_client and settings.OPENAI_API_KEY and weights.use_ai:
        return await _analyze_with_openai(text, weights)
    return _analyze_rule_based(text, weights)


def _analyze_rule_based(text: str, weights: RiskWeights = DEFAULTS) -> dict:
    sentiment = _rule_based_sentiment(text)
    risk = rule_score(text, sentiment, count_negative_hits(text), weights)
    priority = priority_for(risk, weights)

    has_forbidden = any(w in text for w in FORBIDDEN_WORDS)
    return {
        "sentiment": sentiment,
        "emotion": "anger" if sentiment == "negative" else "neutral",
        "intent": "complaint" if sentiment == "negative" else "general",
        "topic": _classify_category(text),
        "risk_score": risk,
        "priority": priority,
        "suggested_action": "escalate_to_service_team" if priority in ("high", "critical") else "monitor",
        "summary": text[:100] + "..." if len(text) > 100 else text,
        "has_forbidden_words": has_forbidden,
    }


async def _analyze_with_openai(text: str, weights: RiskWeights = DEFAULTS) -> dict:
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
                        "topic (one of: brand/deposit_withdrawal/promotion/system/game/scam/general), "
                        "risk_score (0-100 float), priority (low/medium/high/critical), "
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

        # Priority comes from the operator's thresholds, not the model's own
        # judgement, so "critical" means the same thing however it was scored.
        try:
            result["risk_score"] = min(float(result.get("risk_score") or 0), 100.0)
        except (TypeError, ValueError):
            result["risk_score"] = 0.0
        result["priority"] = priority_for(result["risk_score"], weights)
        result["scored_by"] = "ai"
        return result
    except Exception as exc:
        print(f"[ai] falling back to rules: {exc}")
        return _analyze_rule_based(text, weights)
