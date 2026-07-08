# -*- coding: utf-8 -*-
"""
Facebook Closed Group Scraper for SocialEye Monitor
ดึง posts ทั้งกลุ่มอัตโนมัติ → ส่ง SocialEye webhook → วิเคราะห์ sentiment + keywords

ติดตั้ง:
    pip install playwright aiohttp python-dotenv
    playwright install chromium

ตั้งค่าใน backend/.env:
    FB_EMAIL=your@email.com
    FB_PASSWORD=yourpassword
    FB_GROUP_URL=https://facebook.com/groups/your-group-id
    SOCIALEYE_WEBHOOK_URL=https://socialeye-api.vercel.app/api/webhook/mention
    SCROLL_ROUNDS=8   (จำนวนครั้งที่ scroll — ยิ่งมากยิ่งเห็นโพสต์เก่า)

รัน:
    python -m backend.fb_group_scraper
"""

import asyncio
import aiohttp
import os
import sys
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

FB_EMAIL     = os.getenv("FB_EMAIL", "")
FB_PASSWORD  = os.getenv("FB_PASSWORD", "")
FB_GROUP_URL = os.getenv("FB_GROUP_URL", "")
WEBHOOK_URL  = os.getenv("SOCIALEYE_WEBHOOK_URL", "http://localhost:8000/api/webhook/mention")
SCROLL_ROUNDS = int(os.getenv("SCROLL_ROUNDS", "6"))
SESSION_FILE  = Path(__file__).parent / ".fb_session.json"


# ---------------------------------------------------------------------------
# Login
# ---------------------------------------------------------------------------
async def do_login(page):
    print("🔑 กำลัง Login Facebook...")
    await page.goto("https://www.facebook.com/login", wait_until="domcontentloaded")
    await page.fill("#email", FB_EMAIL)
    await page.fill("#pass", FB_PASSWORD)
    await page.click('button[name="login"]')
    try:
        await page.wait_for_url(
            lambda url: "facebook.com" in url and "/login" not in url, timeout=20000
        )
        print("✅ Login สำเร็จ")
        return True
    except Exception:
        print("❌ Login ไม่สำเร็จ — ตรวจสอบ FB_EMAIL / FB_PASSWORD")
        return False


# ---------------------------------------------------------------------------
# Extract posts from current DOM state
# ---------------------------------------------------------------------------
async def extract_posts(page, seen: set) -> list[dict]:
    """ดึง posts ที่มองเห็นใน DOM ขณะนี้ — ใช้ fallback selectors หลายชั้น"""
    results = []

    # Strategy A: role="article" containers (most reliable across FB versions)
    try:
        articles = await page.query_selector_all('div[role="article"]')
        for article in articles:
            # Get author from strong or h2
            author = "Group Member"
            try:
                a_el = await article.query_selector("h2 strong, h2 a, strong > span")
                if a_el:
                    author = (await a_el.inner_text()).strip() or author
            except Exception:
                pass

            # Get post link
            post_url = FB_GROUP_URL
            try:
                link_el = await article.query_selector(
                    'a[href*="/groups/"][href*="/posts/"], a[href*="/permalink/"]'
                )
                if link_el:
                    post_url = await link_el.get_attribute("href") or post_url
                    post_url = post_url.split("?")[0]  # strip tracking params
            except Exception:
                pass

            # Get text content — try specific message containers first
            content = ""
            for sel in [
                '[data-ad-preview="message"]',
                'div[dir="auto"] > span[dir="auto"]',
                'div[data-testid="post_message"]',
                'div[dir="auto"]',
            ]:
                try:
                    el = await article.query_selector(sel)
                    if el:
                        t = (await el.inner_text()).strip()
                        if t and len(t) > 15:
                            content = t
                            break
                except Exception:
                    continue

            if not content or len(content) < 15:
                continue

            key = content[:120]
            if key in seen:
                continue
            seen.add(key)

            # Get engagement counts
            likes = 0
            comments = 0
            try:
                like_el = await article.query_selector('[aria-label*="reaction"], [aria-label*="like"]')
                if like_el:
                    label = await like_el.get_attribute("aria-label") or ""
                    nums = [int(x) for x in label.split() if x.isdigit()]
                    if nums:
                        likes = nums[0]
            except Exception:
                pass
            try:
                cmt_el = await article.query_selector('span:-soup-contains("comment"), [aria-label*="comment"]')
                if cmt_el:
                    label = (await cmt_el.inner_text()).strip()
                    nums = [int(x) for x in label.split() if x.isdigit()]
                    if nums:
                        comments = nums[0]
            except Exception:
                pass

            results.append({
                "author": author,
                "content": content[:3000],
                "url": post_url,
                "likes": likes,
                "comments": comments,
            })

    except Exception as e:
        print(f"  ⚠️  Strategy A error: {e}")

    return results


# ---------------------------------------------------------------------------
# Send to SocialEye
# ---------------------------------------------------------------------------
async def send_post(session: aiohttp.ClientSession, post: dict) -> dict | None:
    payload = {
        "channel": "facebook",
        "author":   post["author"],
        "content":  post["content"],
        "url":      post["url"],
        "likes":    post["likes"],
        "comments": post["comments"],
        "shares":   0,
    }
    try:
        async with session.post(
            WEBHOOK_URL, json=payload,
            timeout=aiohttp.ClientTimeout(total=12)
        ) as resp:
            if resp.status == 200:
                return await resp.json()
            print(f"  ⚠️  Webhook {resp.status}")
    except Exception as e:
        print(f"  ❌ {e}")
    return None


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
async def run():
    if not FB_EMAIL or not FB_PASSWORD or not FB_GROUP_URL:
        print("❌ กรุณาตั้งค่า FB_EMAIL, FB_PASSWORD, FB_GROUP_URL ใน backend/.env")
        sys.exit(1)

    try:
        from playwright.async_api import async_playwright
    except ImportError:
        print("❌ Playwright ยังไม่ได้ติดตั้ง\nรัน: pip install playwright && playwright install chromium")
        sys.exit(1)

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(
            headless=False,  # ใช้ False เพื่อหลีกเลี่ยง bot detection
            args=["--disable-blink-features=AutomationControlled", "--no-sandbox"],
        )

        # Load saved session (ไม่ต้อง login ซ้ำทุกครั้ง)
        if SESSION_FILE.exists():
            print(f"📂 โหลด session จาก {SESSION_FILE.name}")
            ctx = await browser.new_context(storage_state=str(SESSION_FILE))
        else:
            ctx = await browser.new_context(
                user_agent=(
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/124.0.0.0 Safari/537.36"
                )
            )

        page = await ctx.new_page()

        # ตรวจว่า login อยู่หรือเปล่า
        await page.goto("https://www.facebook.com", wait_until="domcontentloaded")
        await asyncio.sleep(2)

        if "login" in page.url or await page.query_selector("#email"):
            ok = await do_login(page)
            if not ok:
                await browser.close()
                return
        else:
            print("✅ ใช้ session ที่บันทึกไว้ (ไม่ต้อง login)")

        # บันทึก session สำหรับครั้งต่อไป
        await ctx.storage_state(path=str(SESSION_FILE))

        # เปิดกลุ่ม
        print(f"\n📁 กำลังเปิดกลุ่ม: {FB_GROUP_URL}")
        await page.goto(FB_GROUP_URL, wait_until="domcontentloaded")
        await asyncio.sleep(3)

        # Close any popups (login prompts for non-members, etc.)
        for popup_sel in ['[aria-label="Close"], [role="dialog"] button']:
            try:
                close_btn = await page.query_selector(popup_sel)
                if close_btn:
                    await close_btn.click()
                    await asyncio.sleep(0.5)
            except Exception:
                pass

        # Scroll และเก็บโพสต์
        print(f"\n📜 Scroll {SCROLL_ROUNDS} รอบเพื่อโหลดโพสต์...")
        all_posts: list[dict] = []
        seen_keys: set = set()

        for i in range(SCROLL_ROUNDS):
            new = await extract_posts(page, seen_keys)
            all_posts.extend(new)
            print(f"  รอบ {i+1}/{SCROLL_ROUNDS}: +{len(new)} โพสต์ใหม่ (รวม {len(all_posts)})")
            await page.evaluate("window.scrollBy(0, window.innerHeight * 2.5)")
            await asyncio.sleep(2.5)

        print(f"\n✅ รวบรวมได้ {len(all_posts)} โพสต์")

        # ส่ง SocialEye
        print(f"\n📡 ส่งไป SocialEye ({WEBHOOK_URL})...")
        sent = matched = 0

        async with aiohttp.ClientSession() as http:
            for post in all_posts:
                res = await send_post(http, post)
                if res:
                    sent += 1
                    kw = res.get("keywords_matched", 0)
                    if kw > 0:
                        matched += 1
                        print(f"  ⭐ [{kw} keywords] {post['content'][:70]}…")
                await asyncio.sleep(0.2)

        print(f"\n{'='*55}")
        print(f"✅ ส่งสำเร็จ {sent}/{len(all_posts)} โพสต์")
        print(f"⭐ ตรง keywords: {matched} โพสต์")
        print(f"🔗 ดูผลใน SocialEye → Live Mentions")
        print(f"{'='*55}")

        await browser.close()


if __name__ == "__main__":
    asyncio.run(run())
