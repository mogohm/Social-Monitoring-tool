# -*- coding: utf-8 -*-
import asyncio
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from backend.models.database import AsyncSessionLocal, engine, Base
from backend.models.models import Mention
from backend.services.ai_service import analyze_text
from datetime import datetime, timedelta
import random

SAMPLES = [
    {"channel": "facebook", "author": "สมชาย ใจดี", "content": "บริการแย่มากเลย รอนานมาก 3 วันแล้วของยังไม่มาเลย ไม่ประทับใจเลย", "likes": 450, "comments": 230, "shares": 89},
    {"channel": "tiktok", "author": "มินตรา สวย", "content": "ชอบมากเลยค่ะ สินค้าดีมาก ส่งเร็ว บริการประทับใจ แนะนำเลย", "likes": 1200, "comments": 89, "shares": 45},
    {"channel": "pantip", "author": "PantipUser123", "content": "โกงหรือเปล่าไม่รู้ สั่งไปแล้วยังไม่ได้รับของ ติดต่อไม่ได้เลย แย่มาก อยากร้องเรียน", "likes": 890, "comments": 456, "shares": 234},
    {"channel": "line_oa", "author": "ลูกค้า VIP", "content": "ขอบคุณมากเลยค่ะ Admin ตอบไวดีมาก ประทับใจบริการมากๆ", "likes": 0, "comments": 0, "shares": 0},
    {"channel": "youtube", "author": "ReviewChannel", "content": "ทดสอบสินค้าแล้ว คุณภาพพอใช้ได้ แต่ราคาแพงไปนิด ลองดูก็ได้", "likes": 320, "comments": 56, "shares": 12, "views": 15000},
    {"channel": "twitter", "author": "AngryCust99", "content": "เสียเงินไปเปล่า สินค้าหลอกลวง ไม่ตรงกับรูป ผิดหวังมาก จะไม่ซื้ออีก", "likes": 670, "comments": 180, "shares": 300},
    {"channel": "facebook", "author": "HappyBuyer", "content": "สั่งครั้งที่ 5 แล้ว ดีทุกครั้ง ราคาคุ้มค่ามาก ขอบคุณทีมงานนะคะ", "likes": 230, "comments": 45, "shares": 23},
    {"channel": "instagram", "author": "blogger_th", "content": "unbox สินค้าใหม่ น่ารักมากเลย แพ็คเกจดีมาก ถ่ายรูปสวย", "likes": 2100, "comments": 340, "shares": 89},
    {"channel": "news", "author": "ThaiNewsOnline", "content": "แบรนด์ดังถูกร้องเรียนเรื่องส่งสินค้าช้า ลูกค้าหลายร้อยรายยังรอของ", "likes": 50, "comments": 200, "shares": 400},
    {"channel": "pantip", "author": "ReviewExpert", "content": "เปรียบเทียบราคากับคู่แข่ง ถูกกว่าเยอะเลย แต่บริการหลังการขายยังต้องปรับปรุง", "likes": 180, "comments": 90, "shares": 30},
]


async def seed():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as db:
        for i, s in enumerate(SAMPLES):
            analysis = await analyze_text(s["content"])
            engagement = s.get("likes", 0) + s.get("comments", 0) + s.get("shares", 0)
            offset_days = random.randint(0, 6)
            m = Mention(
                channel=s["channel"],
                author=s["author"],
                content=s["content"],
                likes=s.get("likes", 0),
                comments=s.get("comments", 0),
                shares=s.get("shares", 0),
                views=s.get("views", 0),
                engagement=engagement,
                sentiment=analysis.get("sentiment"),
                emotion=analysis.get("emotion"),
                intent=analysis.get("intent"),
                topic=analysis.get("topic"),
                risk_score=analysis.get("risk_score"),
                priority=analysis.get("priority"),
                ai_summary=analysis.get("summary"),
                suggested_action=analysis.get("suggested_action"),
                published_at=datetime.utcnow() - timedelta(days=offset_days),
            )
            db.add(m)
            print(f"  [{i+1}/{len(SAMPLES)}] {s['channel']} | {analysis.get('sentiment')} | risk={analysis.get('risk_score')}")
        await db.commit()
        print("Seed complete!")


asyncio.run(seed())
