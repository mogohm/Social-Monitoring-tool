# -*- coding: utf-8 -*-
"""Seed N8 / Poker-themed mentions to demonstrate keyword matching."""
import asyncio, sys, os, random
from datetime import datetime, timedelta
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from backend.models.database import AsyncSessionLocal, engine, Base
from backend.models.models import Mention
from backend.services.ai_service import analyze_text
from backend.routers.mentions import _match_keywords

SAMPLES = [
    {"channel": "facebook",  "author": "PokerFan_TH",     "url": "https://www.facebook.com/n8thailand/posts/123456",
     "content": "เล่น Poker บน Natural8 สนุกมากเลยครับ โต๊ะ N8 Thailand มีให้เลือกเยอะ รางวัลก็เยอะ แนะนำเลย",
     "likes": 234, "comments": 45, "shares": 12},
    {"channel": "twitter",   "author": "@N8_Review",       "url": "https://twitter.com/N8_Review/status/987654321",
     "content": "N8TH poker card tournament รอบนี้สุดยอดมากครับ รางวัลรวมล้านกว่าบาท ใครสนใจลองดูที่ natural8",
     "likes": 890, "comments": 120, "shares": 230},
    {"channel": "pantip",    "author": "PantipUser_Poker",  "url": "https://pantip.com/topic/N8poker2024",
     "content": "รีวิว Natural8 หลังเล่นมา 6 เดือน ระบบ N8 ดีมาก ถอนเงินไวดี แต่ poker card บางทีโหลดช้า",
     "likes": 156, "comments": 89, "shares": 23},
    {"channel": "youtube",   "author": "PokerCoach_TH",    "url": "https://youtube.com/watch?v=N8pokerreview",
     "content": "สอนเล่น poker card สไตล์ N8 Thailand ตอนที่ 3 วันนี้มาดูเรื่อง bluffing technique กัน",
     "likes": 1200, "comments": 340, "shares": 67, "views": 45000},
    {"channel": "facebook",  "author": "AngryPlayer_99",   "url": "https://www.facebook.com/groups/n8players/posts/555",
     "content": "N8 แย่มากเลย ถอนเงินรอนาน 3 วันแล้ว ระบบ natural8 มีปัญหา poker card โหลดไม่ขึ้น ไม่ประทับใจ",
     "likes": 445, "comments": 210, "shares": 189},
    {"channel": "instagram", "author": "pokergirl.th",     "url": "https://instagram.com/p/N8TH2024abc",
     "content": "วันนี้ชนะ poker ที่ N8TH ได้เงินมา 50k บาทเลยนะ natural8 จ่ายเร็วมาก ประทับใจสุดๆ",
     "likes": 2100, "comments": 567, "shares": 89},
    {"channel": "tiktok",    "author": "@n8thailand_fan",  "url": "https://tiktok.com/@n8thailand/video/789",
     "content": "N8 Thailand poker challenge ลองดูสิ ชวนเพื่อนมาเล่น natural8 ด้วยกัน สนุกมาก",
     "likes": 5600, "comments": 890, "shares": 1200, "views": 120000},
    {"channel": "news",      "author": "iGaming News TH",  "url": "https://igamingnews.th/natural8-n8-expansion",
     "content": "Natural8 (N8) ประกาศขยายตลาด N8 Thailand เพิ่มโต๊ะ poker card ใหม่รองรับผู้เล่นไทย",
     "likes": 78, "comments": 34, "shares": 156},
    {"channel": "line_oa",   "author": "CustomerN8",       "url": None,
     "content": "สอบถามเรื่อง N8TH bonus ครับ สมัครสมาชิก Natural8 แล้วยังไม่ได้รับ poker card welcome bonus",
     "likes": 0, "comments": 0, "shares": 0},
    {"channel": "webboard",  "author": "Forum_Poker2024",  "url": "https://forum.pokerthai.net/n8-review-2024",
     "content": "กระทู้รีวิว N8 Thailand ปี 2024: ระบบ natural8 ดีขึ้นมาก poker card tournament ชิงรางวัลใหญ่ทุกสัปดาห์",
     "likes": 67, "comments": 145, "shares": 34},
]


async def seed():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as db:
        for i, s in enumerate(SAMPLES):
            analysis = await analyze_text(s["content"])
            matched  = await _match_keywords(s["content"], db)
            engagement = s.get("likes", 0) + s.get("comments", 0) + s.get("shares", 0)
            offset_days = random.randint(0, 6)
            m = Mention(
                channel=s["channel"], author=s["author"],
                content=s["content"], url=s.get("url"),
                likes=s.get("likes", 0), comments=s.get("comments", 0),
                shares=s.get("shares", 0), views=s.get("views", 0),
                engagement=engagement,
                sentiment=analysis.get("sentiment"), emotion=analysis.get("emotion"),
                intent=analysis.get("intent"), topic=analysis.get("topic"),
                risk_score=analysis.get("risk_score"), priority=analysis.get("priority"),
                ai_summary=analysis.get("summary"),
                suggested_action=analysis.get("suggested_action"),
                tags=matched if matched else None,
                published_at=datetime.utcnow() - timedelta(days=offset_days),
            )
            db.add(m)
            kw_names = [t["word"] for t in matched]
            print(f"  [{i+1}/{len(SAMPLES)}] {s['channel']} | {analysis.get('sentiment')} | keywords={kw_names}")
        await db.commit()
    print("N8/Poker seed complete!")


asyncio.run(seed())
