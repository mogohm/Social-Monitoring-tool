# -*- coding: utf-8 -*-
"""Comprehensive N8 Thailand / poker seed data — 50 mentions over 30 days."""
import asyncio, sys, os, random  # noqa
from datetime import datetime, timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

random.seed(42)

from backend.models.database import AsyncSessionLocal, engine, Base  # noqa
from backend.models.models import Mention  # noqa
from backend.services.ai_service import analyze_text  # noqa
from backend.routers.mentions import _match_keywords  # noqa
from sqlalchemy import select, or_, and_, not_  # noqa

# ---------------------------------------------------------------------------
# 50 N8 / poker-themed mention samples
# ---------------------------------------------------------------------------
SAMPLES = [
    # --- POSITIVE (30) ---
    {  # 1
        "channel": "facebook", "author": "PokerPro_TH",
        "url": "https://www.facebook.com/n8thailand/posts/1001",
        "content": "เล่น N8 Thailand มาเกือบปีแล้ว ระบบดีมาก ถอนเร็ว ไม่มีปัญหาเลย แนะนำเลยครับ #N8TH #poker",  # noqa
        "likes": 892, "comments": 134, "shares": 67, "views": 0,
    },
    {  # 2
        "channel": "instagram", "author": "pokergirl.thailand",
        "url": "https://www.instagram.com/p/n8th_win_001",
        "content": "ชนะ tournament N8TH วันนี้ได้ 85,000 บาท! natural8 จ่ายเร็วมาก ประทับใจมากๆ 🏆",  # noqa
        "likes": 3200, "comments": 445, "shares": 0, "views": 0,
    },
    {  # 3
        "channel": "youtube", "author": "PokerCoach_TH",
        "url": "https://www.youtube.com/watch?v=n8review2026",
        "content": "รีวิว N8 Thailand 2026 หลังเล่นมา 1 ปี - ระบบดีขึ้นมาก โต๊ะ poker card ใหม่มาเยอะ",  # noqa
        "likes": 1890, "comments": 567, "shares": 0, "views": 98000,
    },
    {  # 4
        "channel": "tiktok", "author": "@n8fan_th",
        "url": "https://www.tiktok.com/@n8fan_th/video/4001",
        "content": "N8TH โบนัสใหม่มาแล้ว! สมัครวันนี้รับฟรี poker chip 500 บาท natural8 ไม่ผิดหวัง",  # noqa
        "likes": 12500, "comments": 890, "shares": 2300, "views": 250000,
    },
    {  # 5
        "channel": "facebook", "author": "GoldPoker_TH",
        "url": "https://www.facebook.com/goldpokert/posts/1002",
        "content": "tournament N8 Thailand รอบนี้ grand prize 2 ล้านบาท! สมัครได้แล้ววันนี้ poker card game สุดมัน",  # noqa
        "likes": 445, "comments": 89, "shares": 156, "views": 0,
    },
    {  # 6
        "channel": "pantip", "author": "PantipPokerFan",
        "url": "https://pantip.com/topic/N8review2026_001",
        "content": "รีวิว Natural8 หลังใช้งาน 6 เดือน: ระบบ N8 ดีมาก ฝาก-ถอนไว customer support ตอบ 24/7",  # noqa
        "likes": 234, "comments": 189, "shares": 45, "views": 0,
    },
    {  # 7
        "channel": "twitter", "author": "@N8TH_Review",
        "url": "https://twitter.com/N8TH_Review/status/7001",
        "content": "Just won big on #N8Thailand poker tournament! Best platform for Thai players. Natural8 rocks! 🎰",  # noqa
        "likes": 567, "comments": 78, "shares": 234, "views": 0,
    },
    {  # 8
        "channel": "tiktok", "author": "@pokerking.th",
        "url": "https://www.tiktok.com/@pokerking.th/video/4002",
        "content": "สอน bluffing technique บนโต๊ะ N8 ตอนที่ 5 วันนี้ทำ profit ได้ 30k ภายใน 3 ชั่วโมง natural8",  # noqa
        "likes": 8900, "comments": 1200, "shares": 3400, "views": 180000,
    },
    {  # 9
        "channel": "instagram", "author": "n8thailand_official_fan",
        "url": "https://www.instagram.com/p/n8th_promo_002",
        "content": "โปรโมชั่น N8TH เดือนนี้สุดปัง cashback 10% ทุกวันศุกร์ poker card ราคาถูกสุดๆ #natural8",  # noqa
        "likes": 2100, "comments": 320, "shares": 0, "views": 0,
    },
    {  # 10
        "channel": "facebook", "author": "WinnerN8_2026",
        "url": "https://www.facebook.com/n8thailand/posts/1003",
        "content": "ขอบคุณ N8 Thailand มากครับ ถอนเงิน 500,000 บาทผ่านภายใน 2 ชั่วโมง ระบบดีจริงๆ",  # noqa
        "likes": 1234, "comments": 456, "shares": 234, "views": 0,
    },
    {  # 11
        "channel": "youtube", "author": "ThaiPokerPro",
        "url": "https://www.youtube.com/watch?v=n8vsgg2026",
        "content": "N8 Thailand vs GGPoker - เปรียบเทียบ 2026 สรุป natural8 ชนะขาด โต๊ะเยอะกว่า rake ถูกกว่า",  # noqa
        "likes": 2340, "comments": 789, "shares": 0, "views": 145000,
    },
    {  # 12
        "channel": "tiktok", "author": "@natural8_th",
        "url": "https://www.tiktok.com/@natural8_th/video/4003",
        "content": "แจกโค้ดโบนัส N8TH มูลค่า 1,000 บาทฟรี! กด link ใน bio เลย #poker #N8Thailand",  # noqa
        "likes": 15600, "comments": 2300, "shares": 4500, "views": 320000,
    },
    {  # 13
        "channel": "pantip", "author": "PokerMaster2026",
        "url": "https://pantip.com/topic/N8review2026_002",
        "content": "ถามประสบการณ์ N8 Thailand: ผมเล่นมา 2 ปี ระบบ natural8 ดีขึ้นทุกปี anti-cheat แน่นมาก",  # noqa
        "likes": 345, "comments": 234, "shares": 78, "views": 0,
    },
    {  # 14
        "channel": "instagram", "author": "pokermoney.th",
        "url": "https://www.instagram.com/p/n8th_cashout_003",
        "content": "cashout N8 วันนี้ 120,000 บาท ใช้เวลา 45 นาที natural8 fastest withdrawal ever! 💰",  # noqa
        "likes": 4500, "comments": 678, "shares": 0, "views": 0,
    },
    {  # 15
        "channel": "facebook", "author": "ThaiPokerClub",
        "url": "https://www.facebook.com/thaipokerclu/posts/1004",
        "content": "N8 Thailand เปิด tournament ใหม่ buy-in 500 บาท prize pool รวม 500,000 บาท สนใจ DM มา",  # noqa
        "likes": 678, "comments": 234, "shares": 345, "views": 0,
    },
    # --- NEUTRAL (10) ---
    {  # 16
        "channel": "news", "author": "iGaming Asia News",
        "url": "https://igamingnews.th/natural8-apac-2026",
        "content": "Natural8 (N8) ประกาศแผนขยายตลาด APAC ปี 2026 โดยเน้น N8 Thailand เป็น hub หลัก",  # noqa
        "likes": 89, "comments": 23, "shares": 67, "views": 0,
    },
    {  # 17
        "channel": "twitter", "author": "@PokerNews_TH",
        "url": "https://twitter.com/PokerNews_TH/status/7002",
        "content": "N8 Thailand updates poker card rules for 2026 season. New blind structure announced. #Natural8",  # noqa
        "likes": 234, "comments": 45, "shares": 89, "views": 0,
    },
    {  # 18
        "channel": "pantip", "author": "CardGameInfo",
        "url": "https://pantip.com/topic/N8rules2026",
        "content": "สอบถามข้อมูล N8TH กติกา poker card แบบ short deck ต่างจาก regular ยังไง ช่วยอธิบายหน่อย",  # noqa
        "likes": 45, "comments": 123, "shares": 12, "views": 0,
    },
    {  # 19
        "channel": "youtube", "author": "GamingThailand",
        "url": "https://www.youtube.com/watch?v=n8overview2026",
        "content": "N8 Thailand platform overview 2026 - features, games, payment methods, natural8 full review",  # noqa
        "likes": 890, "comments": 234, "shares": 0, "views": 45000,
    },
    {  # 20
        "channel": "line_oa", "author": "CustomerN8_1",
        "url": None,
        "content": "สอบถามครับ N8TH bonus welcome ได้เมื่อไหร่ สมัครแล้ว 2 วันยังไม่ได้รับ natural8",  # noqa
        "likes": 0, "comments": 0, "shares": 0, "views": 0,
    },
    {  # 21
        "channel": "facebook", "author": "PokerInfoTH",
        "url": "https://www.facebook.com/pokerinfot/posts/1005",
        "content": "N8 Thailand จะจัด live event poker card ที่กรุงเทพ เดือนหน้า ใครสนใจเข้าร่วมบ้าง",  # noqa
        "likes": 234, "comments": 189, "shares": 123, "views": 0,
    },
    {  # 22
        "channel": "tiktok", "author": "@pokertips.th",
        "url": "https://www.tiktok.com/@pokertips.th/video/4004",
        "content": "อธิบาย rake structure ของ N8 Thailand เปรียบเทียบกับ platform อื่น #natural8 #poker",  # noqa
        "likes": 3400, "comments": 456, "shares": 890, "views": 78000,
    },
    {  # 23
        "channel": "instagram", "author": "pokerstrategy.th",
        "url": "https://www.instagram.com/p/n8th_strategy_004",
        "content": "Hand history review บน N8TH - วิเคราะห์ mistake ที่ทำให้เสียเงิน poker card game",  # noqa
        "likes": 890, "comments": 234, "shares": 0, "views": 0,
    },
    {  # 24
        "channel": "pantip", "author": "NewPlayerN8",
        "url": "https://pantip.com/topic/N8newbie2026",
        "content": "มือใหม่ขอถามครับ N8 Thailand มี freeroll tournament ให้เล่นฟรีไหม อยากฝึก poker ก่อน",  # noqa
        "likes": 23, "comments": 89, "shares": 5, "views": 0,
    },
    {  # 25
        "channel": "news", "author": "ThaiGamingMedia",
        "url": "https://thaigamingmedia.th/n8-award-2025",
        "content": "N8 Thailand รับรางวัล Best Asian Poker Operator 2025 จาก iGaming Asia awards ในฐานะ natural8 representative",  # noqa
        "likes": 156, "comments": 34, "shares": 89, "views": 0,
    },
    # --- NEGATIVE (10) ---
    {  # 26
        "channel": "facebook", "author": "AngryPlayer_TH",
        "url": "https://www.facebook.com/groups/n8complaint/posts/2001",
        "content": "N8 แย่มาก! ถอนเงินรอ 5 วันแล้วยังไม่ได้ ติดต่อ support ไม่ได้เรื่อง natural8 ทำอะไรอยู่",  # noqa
        "likes": 890, "comments": 567, "shares": 345, "views": 0,
    },
    {  # 27
        "channel": "pantip", "author": "FrustratedUser99",
        "url": "https://pantip.com/topic/N8complaint2026_001",
        "content": "ระบบ N8TH ล่มบ่อยมาก กำลังเล่น poker card อยู่ดีๆ หลุดออกมา เสียเงินไปเยอะมาก",  # noqa
        "likes": 678, "comments": 456, "shares": 234, "views": 0,
    },
    {  # 28
        "channel": "twitter", "author": "@N8_Complaint_TH",
        "url": "https://twitter.com/N8_Complaint_TH/status/7003",
        "content": "WARNING: N8 Thailand ระบบ KYC ช้ามาก รอ verify นาน 7 วัน ทำให้ถอนไม่ได้ natural8 ควรแก้ไขด่วน",  # noqa
        "likes": 1234, "comments": 567, "shares": 890, "views": 0,
    },
    {  # 29
        "channel": "tiktok", "author": "@honest.poker.review",
        "url": "https://www.tiktok.com/@honest.poker.review/video/4005",
        "content": "ความจริงเกี่ยวกับ N8 Thailand ที่ไม่มีใครบอก: rake สูงกว่าที่โฆษณา natural8 ต้องโปร่งใสกว่านี้",  # noqa
        "likes": 6700, "comments": 1890, "shares": 2300, "views": 145000,
    },
    {  # 30
        "channel": "instagram", "author": "poker_truth_th",
        "url": "https://www.instagram.com/p/n8th_warning_005",
        "content": "ระวัง N8TH promotion - เงื่อนไข bonus ซับซ้อนมาก ถอนยากมาก natural8 ควรทำให้ชัดกว่านี้",  # noqa
        "likes": 2340, "comments": 890, "shares": 0, "views": 0,
    },
    {  # 31
        "channel": "line_oa", "author": "AngryCustomer",
        "url": None,
        "content": "โกรธมากเลย N8 ปิดบัญชีโดยไม่แจ้งเหตุผล เงินยังค้างอยู่ในระบบ natural8 ต้องรับผิดชอบ",  # noqa
        "likes": 0, "comments": 0, "shares": 0, "views": 0,
    },
    {  # 32
        "channel": "facebook", "author": "BadExperience_N8",
        "url": "https://www.facebook.com/groups/n8complaint/posts/2002",
        "content": "N8 Thailand ระบบ poker card มีบั๊ก กดแล้วไม่ขึ้น เสียเงินเพราะระบบพัง support ไม่ช่วย",  # noqa
        "likes": 456, "comments": 345, "shares": 178, "views": 0,
    },
    {  # 33
        "channel": "pantip", "author": "DisappointedPlayer",
        "url": "https://pantip.com/topic/N8complaint2026_002",
        "content": "ผิดหวัง N8TH มาก bonus โฆษณาไว้ดีมาก แต่พอถอนเงินจริงมีเงื่อนไขเต็มไปหมด natural8 หลอกผู้ใช้",  # noqa
        "likes": 567, "comments": 345, "shares": 123, "views": 0,
    },
    {  # 34
        "channel": "tiktok", "author": "@poker_warning_th",
        "url": "https://www.tiktok.com/@poker_warning_th/video/4006",
        "content": "อย่าเล่น N8 Thailand ถ้าไม่อ่านเงื่อนไขให้ดีก่อน เจอปัญหาถอนเงินไม่ได้มา 2 สัปดาห์แล้ว",  # noqa
        "likes": 9800, "comments": 2340, "shares": 3400, "views": 210000,
    },
    {  # 35
        "channel": "youtube", "author": "HonestReview_TH",
        "url": "https://www.youtube.com/watch?v=n8cons2026",
        "content": "N8 Thailand - ข้อเสียที่ต้องรู้ก่อนเล่น: withdrawal ช้า customer service ไม่ professional",  # noqa
        "likes": 1230, "comments": 678, "shares": 0, "views": 67000,
    },
    # --- ADDITIONAL POSITIVE (15) ---
    {  # 36
        "channel": "instagram", "author": "jackpot.th.poker",
        "url": "https://www.instagram.com/p/n8th_freeroll_006",
        "content": "N8 Thailand มี freeroll tournament ทุกวัน! ไม่ต้องเสียเงินก็เล่น poker card ได้ แจ่มมาก natural8",  # noqa
        "likes": 1890, "comments": 234, "shares": 0, "views": 0,
    },
    {  # 37
        "channel": "tiktok", "author": "@n8winner2026",
        "url": "https://www.tiktok.com/@n8winner2026/video/4007",
        "content": "ชนะ N8TH monthly tournament grand prize! 500,000 บาท ขอบคุณ natural8 มากๆ เลย 🎉",  # noqa
        "likes": 23400, "comments": 4500, "shares": 8900, "views": 450000,
    },
    {  # 38
        "channel": "facebook", "author": "PokerDad_TH",
        "url": "https://www.facebook.com/pokerdad.th/posts/1006",
        "content": "natural8 เพิ่งออก mobile app ใหม่ N8 Thailand ลื่นมาก เล่น poker card บนมือถือสะดวกมาก",  # noqa
        "likes": 567, "comments": 123, "shares": 89, "views": 0,
    },
    {  # 39
        "channel": "line_oa", "author": "HappyCustomer2",
        "url": None,
        "content": "ขอบคุณ N8TH admin มากครับ resolve ปัญหา deposit ให้ได้ภายใน 30 นาที บริการดีมาก natural8",  # noqa
        "likes": 0, "comments": 0, "shares": 0, "views": 0,
    },
    {  # 40
        "channel": "pantip", "author": "N8Recommend",
        "url": "https://pantip.com/topic/N8recommend2026",
        "content": "แนะนำ N8 Thailand สำหรับมือใหม่: ระบบ tutorial ดีมาก poker card สอนตั้งแต่พื้นฐาน natural8 pro",  # noqa
        "likes": 234, "comments": 167, "shares": 67, "views": 0,
    },
    {  # 41
        "channel": "twitter", "author": "@ThaiPokerWinner",
        "url": "https://twitter.com/ThaiPokerWinner/status/7004",
        "content": "#N8Thailand just had the smoothest withdrawal experience. 300k THB in 1 hour! Natural8 is legit 🏆",  # noqa
        "likes": 890, "comments": 234, "shares": 456, "views": 0,
    },
    {  # 42
        "channel": "instagram", "author": "pokerpro.th.2026",
        "url": "https://www.instagram.com/p/n8th_hiro_007",
        "content": "N8TH new high roller table ดีมาก! blind สูงกว่าเดิม ท้าทายขึ้น natural8 poker card สุดยอด",  # noqa
        "likes": 1560, "comments": 289, "shares": 0, "views": 0,
    },
    {  # 43
        "channel": "tiktok", "author": "@pokermillionaire.th",
        "url": "https://www.tiktok.com/@pokermillionaire.th/video/4008",
        "content": "ทำ 1 ล้านบาทจาก N8 Thailand ใน 1 เดือน! แชร์ strategy ที่ใช้ natural8 poker",  # noqa
        "likes": 45600, "comments": 6700, "shares": 12300, "views": 890000,
    },
    {  # 44
        "channel": "facebook", "author": "ProfessionalPoker_TH",
        "url": "https://www.facebook.com/profpoker.th/posts/1007",
        "content": "N8 Thailand เปิด VIP program ใหม่ rakeback สูงถึง 35% สำหรับ high volume player natural8 ดีมาก",  # noqa
        "likes": 345, "comments": 178, "shares": 123, "views": 0,
    },
    {  # 45
        "channel": "youtube", "author": "PokerAnalyst_TH",
        "url": "https://www.youtube.com/watch?v=n8pool2026",
        "content": "วิเคราะห์ N8 Thailand player pool 2026 - fish/reg ratio ดีมาก ทำกำไรง่ายกว่า GGPoker มาก natural8",  # noqa
        "likes": 1678, "comments": 456, "shares": 0, "views": 89000,
    },
    {  # 46
        "channel": "pantip", "author": "N8Success_Story",
        "url": "https://pantip.com/topic/N8success2026",
        "content": "เล่น N8TH มา 3 ปี สร้าง passive income จาก poker card ได้จริง ขอบคุณ natural8 ที่ platform ดี",  # noqa
        "likes": 456, "comments": 234, "shares": 89, "views": 0,
    },
    {  # 47
        "channel": "instagram", "author": "thai.poker.life",
        "url": "https://www.instagram.com/p/n8th_anniv_008",
        "content": "N8 Thailand anniversary promotion - 5 ปีของ natural8 ในไทย โบนัสพิเศษ 200% สำหรับสมาชิกเก่า N8TH",  # noqa
        "likes": 2890, "comments": 456, "shares": 0, "views": 0,
    },
    {  # 48
        "channel": "facebook", "author": "CardMaster_TH",
        "url": "https://www.facebook.com/cardmaster.th/posts/1008",
        "content": "natural8 update ใหม่ มี AI coach บน N8 Thailand ช่วย analyze hand ได้แล้ว poker card เทคโนโลยีล้ำมาก",  # noqa
        "likes": 789, "comments": 234, "shares": 167, "views": 0,
    },
    {  # 49
        "channel": "tiktok", "author": "@n8thailand_news",
        "url": "https://www.tiktok.com/@n8thailand_news/video/4009",
        "content": "ข่าวด่วน! N8 Thailand ประกาศ Super Satellite tournament prize pool 5 ล้านบาท! natural8 ปีนี้โตมาก",  # noqa
        "likes": 18900, "comments": 2340, "shares": 5600, "views": 380000,
    },
    {  # 50
        "channel": "twitter", "author": "@N8TH_Official_Fan",
        "url": "https://twitter.com/N8TH_Official_Fan/status/7005",
        "content": "N8Thailand now has 500,000+ registered Thai players! Biggest poker platform in Thailand. Natural8 #poker",  # noqa
        "likes": 1234, "comments": 345, "shares": 678, "views": 0,
    },
]

# Keywords that identify N8/poker content — any match keeps the mention
N8_KEYWORDS = ["N8", "natural8", "poker", "N8TH", "N8 Thailand", "โป๊กเกอร์"]


async def seed():
    # Ensure tables exist
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as db:
        # ---------------------------------------------------------------
        # DELETE mentions that are NOT about N8/poker
        # ---------------------------------------------------------------
        all_mentions = (await db.execute(select(Mention))).scalars().all()
        deleted = 0
        for m in all_mentions:
            content = m.content or ""
            if not any(kw.lower() in content.lower() for kw in N8_KEYWORDS):
                await db.delete(m)
                deleted += 1
        await db.flush()
        print(f"Deleted {deleted} non-N8/poker mentions.")

        # ---------------------------------------------------------------
        # INSERT 50 new N8/poker mentions
        # ---------------------------------------------------------------
        for i, s in enumerate(SAMPLES):
            analysis = await analyze_text(s["content"])
            matched = await _match_keywords(s["content"], db)
            engagement = s.get("likes", 0) + s.get("comments", 0) + s.get("shares", 0)
            offset_days = random.randint(0, 29)
            published_at = datetime.utcnow() - timedelta(days=offset_days)

            m = Mention(
                channel=s["channel"],
                author=s.get("author"),
                content=s["content"],
                url=s.get("url"),
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
                tags=matched if matched else None,
                published_at=published_at,
            )
            db.add(m)
            kw_names = [t["word"] for t in matched]
            print(
                f"  [{i + 1:02d}/{len(SAMPLES)}] {s['channel']:12s} | "
                f"{analysis.get('sentiment', '?'):8s} | "
                f"days_ago={offset_days:2d} | keywords={kw_names}"
            )

        await db.commit()
    print(f"\nPro seed complete — {len(SAMPLES)} mentions inserted.")


asyncio.run(seed())
