# -*- coding: utf-8 -*-
"""
Facebook Closed Group Scraper — SocialEye Monitor
วนเก็บข้อมูลทุก 5 นาที — เก็บครบ: ข้อความ, รูป, engagement, timestamp
"""

import asyncio
import aiohttp
import os
import sys
import json
import re
import time
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

FB_EMAIL      = os.getenv("FB_EMAIL", "")
FB_PASSWORD   = os.getenv("FB_PASSWORD", "")
FB_GROUP_URL  = os.getenv("FB_GROUP_URL", "")
WEBHOOK_URL   = os.getenv("SOCIALEYE_WEBHOOK_URL", "http://localhost:8000/api/webhook/mention")
SCROLL_ROUNDS = int(os.getenv("SCROLL_ROUNDS", "6"))
INTERVAL_MIN  = int(os.getenv("SCRAPE_INTERVAL_MIN", "5"))
SESSION_FILE  = Path(__file__).parent / ".fb_session.json"
SEEN_FILE     = Path(__file__).parent / ".fb_seen.json"


def load_seen() -> set:
    if SEEN_FILE.exists():
        try:
            return set(json.loads(SEEN_FILE.read_text(encoding="utf-8")))
        except Exception:
            pass
    return set()


def save_seen(seen: set):
    lst = list(seen)[-3000:]
    SEEN_FILE.write_text(json.dumps(lst), encoding="utf-8")


def extract_post_id(url: str) -> str | None:
    """ดึง post ID จาก URL"""
    patterns = [
        r"/posts/(\d+)",
        r"/permalink/(\d+)",
        r"story_fbid=(\d+)",
        r"[?&]id=(\d+)",
        r"/(\d{10,})",
    ]
    for p in patterns:
        m = re.search(p, url)
        if m:
            return m.group(1)
    return None


# ---------------------------------------------------------------------------
async def is_logged_in(page) -> bool:
    try:
        if "login" in page.url or "checkpoint" in page.url:
            return False
        el = await page.query_selector(
            '[aria-label="Home"], [data-pagelet="LeftRail"], '
            'div[data-pagelet="Stories"], [aria-label="Facebook"]'
        )
        return el is not None
    except Exception:
        return False


async def wait_for_login(page, timeout_sec=180) -> bool:
    print(f"   รอ login ใน browser... (สูงสุด {timeout_sec} วินาที)")
    for _ in range(timeout_sec):
        await asyncio.sleep(1)
        if await is_logged_in(page):
            return True
    return False


async def do_login(page) -> bool:
    print("🔑 กำลัง Login Facebook...")
    await page.goto("https://www.facebook.com/login", wait_until="domcontentloaded")
    await asyncio.sleep(3)

    for sel in ['[data-cookiebanner="accept_button"]', 'button[title*="Allow" i]',
                '#accept-cookie-banner-label']:
        try:
            btn = await page.query_selector(sel)
            if btn:
                await btn.click()
                await asyncio.sleep(1)
                break
        except Exception:
            pass

    email_sel = None
    for sel in ['#email', 'input[name="email"]', 'input[type="email"]',
                'input[autocomplete="username"]']:
        try:
            await page.wait_for_selector(sel, timeout=8000)
            email_sel = sel
            break
        except Exception:
            pass

    if email_sel:
        await page.fill(email_sel, FB_EMAIL)
        await asyncio.sleep(0.7)

    pass_sel = None
    for sel in ['#pass', 'input[name="pass"]', 'input[type="password"]',
                'input[autocomplete="current-password"]']:
        try:
            el = await page.query_selector(sel)
            if el:
                pass_sel = sel
                break
        except Exception:
            pass

    if pass_sel:
        await page.fill(pass_sel, FB_PASSWORD)
        await asyncio.sleep(0.7)

    clicked = False
    for btn_sel in ['button[name="login"]', 'button[type="submit"]',
                    '#loginbutton', '[data-testid="royal_login_button"]']:
        try:
            el = await page.query_selector(btn_sel)
            if el:
                await el.click()
                clicked = True
                break
        except Exception:
            pass

    if not clicked and pass_sel:
        await page.press(pass_sel, "Enter")

    try:
        await page.wait_for_url(
            lambda u: "facebook.com" in u and "/login" not in u,
            timeout=30000
        )
        await asyncio.sleep(3)
    except Exception:
        pass

    if await is_logged_in(page):
        print("✅ Login สำเร็จ")
        return True

    print("⚠️  มี checkpoint หรือ bot-check — ทำใน browser แล้วรอสักครู่")
    return await wait_for_login(page, 180)


# ---------------------------------------------------------------------------
async def expand_see_more(article):
    """คลิก 'See more' / 'ดูเพิ่มเติม' ให้เนื้อหาครบ"""
    for sel in [
        'div[role="button"]:has-text("See more")',
        'div[role="button"]:has-text("ดูเพิ่มเติม")',
        'span[role="button"]:has-text("See more")',
        'span[role="button"]:has-text("ดูเพิ่มเติม")',
    ]:
        try:
            btn = await article.query_selector(sel)
            if btn:
                await btn.click()
                await asyncio.sleep(0.6)
        except Exception:
            pass


async def parse_number(text: str) -> int:
    """แปลง '1.2K' '3.4M' '500' → int"""
    t = text.strip().replace(",", "").lower()
    if not t:
        return 0
    m = re.search(r"([\d.]+)\s*([km]?)", t)
    if not m:
        return 0
    num = float(m.group(1))
    unit = m.group(2)
    if unit == "k":
        return int(num * 1_000)
    if unit == "m":
        return int(num * 1_000_000)
    return int(num)


async def get_engagement(article) -> tuple[int, int, int]:
    """ดึง likes, comments, shares"""
    likes = comments = shares = 0

    # Likes / Reactions — Facebook แสดงเป็น span ข้างๆ reaction emoji
    for sel in [
        'span[aria-label*="reaction" i]',
        'span[aria-label*="ปฏิกิริยา" i]',
        'div[aria-label*="reaction" i]',
        # ตัวเลขปฏิกิริยาอยู่ใน span ที่ไม่มี role เฉพาะ แต่ติดกับ Like button
        'div[class*="like" i] span',
        'span[data-testid*="UFI2ReactionsCount" i]',
    ]:
        try:
            el = await article.query_selector(sel)
            if el:
                t = (await el.inner_text()).strip()
                n = await parse_number(t)
                if n > 0:
                    likes = n
                    break
        except Exception:
            pass

    # ดึงตัวเลขหลังปุ่ม Like โดยตรง
    if likes == 0:
        try:
            # หา span ที่มีแค่ตัวเลขใกล้ section reaction
            spans = await article.query_selector_all('span[role="toolbar"] ~ * span, '
                                                      'div[role="toolbar"] ~ * span')
            for sp in spans[:10]:
                t = (await sp.inner_text()).strip()
                if re.match(r"^[\d.,]+[KkMm]?$", t):
                    n = await parse_number(t)
                    if n > 0 and likes == 0:
                        likes = n
                        break
        except Exception:
            pass

    # Comments
    for sel in [
        'span[aria-label*="comment" i]',
        'span[aria-label*="ความคิดเห็น" i]',
        'a[href*="comments"] span',
        'div[aria-label*="comment" i]',
    ]:
        try:
            el = await article.query_selector(sel)
            if el:
                t = (await el.inner_text()).strip()
                n = await parse_number(t)
                if n > 0:
                    comments = n
                    break
        except Exception:
            pass

    # Shares
    for sel in [
        'span[aria-label*="share" i]',
        'span[aria-label*="การแชร์" i]',
        'div[aria-label*="share" i]',
    ]:
        try:
            el = await article.query_selector(sel)
            if el:
                t = (await el.inner_text()).strip()
                n = await parse_number(t)
                if n > 0:
                    shares = n
                    break
        except Exception:
            pass

    return likes, comments, shares


async def get_images(article) -> list[str]:
    """ดึง URL รูปภาพทั้งหมดในโพสต์ (ไม่รวมรูปโปรไฟล์)"""
    images = []
    try:
        imgs = await article.query_selector_all('img[src*="scontent"], img[src*="fbcdn.net"]')
        for img in imgs:
            src = await img.get_attribute("src")
            if not src:
                continue
            # กรองรูปโปรไฟล์ออก (มักเป็น 40x40 หรือ 50x50 px)
            width  = await img.get_attribute("width")
            height = await img.get_attribute("height")
            w = int(width)  if width  and width.isdigit()  else 999
            h = int(height) if height and height.isdigit() else 999
            if w <= 60 and h <= 60:
                continue
            # กรอง emoji / sticker (มักเล็กมาก ใน URL จะมี emoji หรือ sticker)
            if "emoji" in src or "sticker" in src.lower():
                continue
            if src not in images:
                images.append(src)
    except Exception:
        pass
    return images


async def get_timestamp(article) -> str:
    """ดึง timestamp ของโพสต์"""
    # ลอง abbr[data-utime] ก่อน (Unix timestamp)
    for sel in ['abbr[data-utime]']:
        try:
            el = await article.query_selector(sel)
            if el:
                t = await el.get_attribute("data-utime")
                if t:
                    return t
        except Exception:
            pass

    # abbr[title] — full date string
    for sel in ['abbr[title]', 'a[href*="/posts/"] span[title]', 'span[title*="202"]']:
        try:
            el = await article.query_selector(sel)
            if el:
                t = await el.get_attribute("title")
                if t and any(c.isdigit() for c in t):
                    return t
        except Exception:
            pass

    return ""


async def get_full_content(article) -> str:
    """ดึงข้อความครบที่สุด"""
    content = ""

    # 1. specific post message selectors
    for sel in [
        '[data-ad-preview="message"]',
        'div[data-testid="post_message"]',
        'div[dir="auto"] > span[dir="auto"]',
    ]:
        try:
            # ดึงทุก element ที่ match แล้วรวมกัน
            els = await article.query_selector_all(sel)
            parts = []
            for el in els:
                t = (await el.inner_text()).strip()
                if t and t not in parts:
                    parts.append(t)
            if parts:
                content = "\n".join(parts)
                break
        except Exception:
            pass

    # 2. div[dir="auto"] ทั้งหมด (ครอบคลุมกว่า)
    if not content or len(content) < 20:
        try:
            els = await article.query_selector_all('div[dir="auto"]')
            parts = []
            for el in els:
                t = (await el.inner_text()).strip()
                if t and len(t) > 15 and t not in parts:
                    parts.append(t)
            if parts:
                # เอาส่วนที่ยาวที่สุด (มักเป็น content จริง)
                content = max(parts, key=len)
        except Exception:
            pass

    # 3. fallback: innerText ทั้ง article แต่กรอง UI
    if not content or len(content) < 20:
        try:
            skip = {
                "Like", "Comment", "Share", "Send", "See more", "See less",
                "ถูกใจ", "แสดงความคิดเห็น", "แชร์", "ดูเพิ่มเติม", "ดูน้อยลง",
                "View more comments", "Write a comment", "เขียนความคิดเห็น...",
                "Most relevant", "All comments", "ความคิดเห็นส่วนใหญ่",
            }
            full = (await article.inner_text()).strip()
            lines = []
            for line in full.split("\n"):
                line = line.strip()
                if (line and len(line) > 20
                        and line not in skip
                        and not re.match(r"^[\d.,]+[KkMm]?\s*(Like|Comment|Share|ถูกใจ)?$", line)):
                    lines.append(line)
            if lines:
                content = "\n".join(lines[:20])
        except Exception:
            pass

    return content[:6000]


async def extract_posts(page, seen: set) -> list[dict]:
    found = []
    await asyncio.sleep(1)

    try:
        articles = await page.query_selector_all('div[role="article"]')
        print(f"    พบ {len(articles)} article elements")

        for art in articles:
            # ขยาย "See more" ก่อนดึงข้อความ
            await expand_see_more(art)

            author     = "Group Member"
            author_url = ""
            author_id  = ""
            post_url   = FB_GROUP_URL
            external_id = ""

            # Author
            for sel in ["h2 strong a", "h2 a", "h2 strong", "strong span", "h3 a"]:
                try:
                    el = await art.query_selector(sel)
                    if el:
                        t = (await el.inner_text()).strip()
                        if t:
                            author = t
                            href = await el.get_attribute("href")
                            if href:
                                author_url = href.split("?")[0]
                                if not author_url.startswith("http"):
                                    author_url = "https://facebook.com" + author_url
                                # ดึง user ID จาก URL
                                uid_m = re.search(r"/user/(\d+)|id=(\d+)|/([^/?]+)$", author_url)
                                if uid_m:
                                    author_id = uid_m.group(1) or uid_m.group(2) or uid_m.group(3)
                            break
                except Exception:
                    pass

            # Post URL
            for sel in ['a[href*="/posts/"]', 'a[href*="/permalink/"]',
                        'a[href*="story_fbid"]', 'a[href*="?id="]']:
                try:
                    el = await art.query_selector(sel)
                    if el:
                        href = await el.get_attribute("href")
                        if href:
                            if "story_fbid" in href:
                                post_url = "https://facebook.com" + href if not href.startswith("http") else href
                            else:
                                post_url = href.split("?")[0]
                                if not post_url.startswith("http"):
                                    post_url = "https://facebook.com" + post_url
                            external_id = extract_post_id(href) or ""
                            break
                except Exception:
                    pass

            # ดึงข้อมูลทั้งหมดพร้อมกัน
            content   = await get_full_content(art)
            images    = await get_images(art)
            timestamp = await get_timestamp(art)
            likes, comments, shares = await get_engagement(art)

            # Post type
            post_type = "text"
            try:
                if await art.query_selector('video, [data-testid="fbVideoBlock"]'):
                    post_type = "video"
                elif images:
                    post_type = "photo"
            except Exception:
                pass

            if not content or len(content) < 10:
                continue

            # Dedup — ใช้ external_id ถ้ามี ไม่งั้นใช้ content
            dedup_key = external_id if external_id else content[:120]
            if dedup_key in seen:
                continue
            seen.add(dedup_key)

            found.append({
                "author":      author,
                "author_id":   author_id,
                "author_url":  author_url,
                "content":     content,
                "url":         post_url,
                "external_id": external_id,
                "timestamp":   timestamp,
                "image_url":   images[0] if images else "",
                "image_urls":  images,
                "likes":       likes,
                "comments":    comments,
                "shares":      shares,
                "post_type":   post_type,
            })

    except Exception as e:
        print(f"  ⚠️  Extract error: {e}")

    return found


async def send_post(session: aiohttp.ClientSession, post: dict):
    payload = {
        "channel":     "facebook",
        "author":      post["author"],
        "author_id":   post["author_id"],
        "external_id": post["external_id"] or None,
        "content":     post["content"],
        "url":         post["url"],
        "image_url":   post["image_url"] or None,
        "image_urls":  post["image_urls"] or [],
        "published_at": post["timestamp"] or None,
        "likes":       post["likes"],
        "comments":    post["comments"],
        "shares":      post["shares"],
    }
    try:
        async with session.post(WEBHOOK_URL, json=payload,
                                timeout=aiohttp.ClientTimeout(total=15)) as resp:
            if resp.status == 200:
                return await resp.json()
            body = await resp.text()
            print(f"  ⚠️  Webhook {resp.status}: {body[:120]}")
    except Exception as e:
        print(f"  ❌ {e}")
    return None


async def scrape_once(page, seen: set) -> int:
    print(f"\n📜 Scroll {SCROLL_ROUNDS} รอบ...")
    all_posts: list[dict] = []

    for i in range(SCROLL_ROUNDS):
        new = await extract_posts(page, seen)
        all_posts.extend(new)
        print(f"  รอบ {i+1}/{SCROLL_ROUNDS}: +{len(new)} โพสต์ (รวม {len(all_posts)})")
        await page.evaluate("window.scrollBy(0, window.innerHeight * 2.5)")
        await asyncio.sleep(3.5)

    await page.evaluate("window.scrollTo(0, 0)")
    await asyncio.sleep(1)

    if not all_posts:
        print("  ⚠️  ไม่พบโพสต์ใหม่")
        return 0

    print(f"\n📡 ส่ง {len(all_posts)} โพสต์ไป SocialEye...")
    sent = matched = 0

    async with aiohttp.ClientSession() as http:
        for post in all_posts:
            res = await send_post(http, post)
            if res:
                sent += 1
                kw  = res.get("keywords_matched", 0)
                matched += 1 if kw > 0 else 0
                img_icon = "🖼 " if post["image_urls"] else ""
                flag = "⭐" if kw > 0 else " ✓"
                print(f"  {flag}{img_icon}[{post['post_type']}|❤{post['likes']}💬{post['comments']}] "
                      f"{post['author'][:16]}: {post['content'][:50]}…")
            await asyncio.sleep(0.2)

    save_seen(seen)
    print(f"  → ส่ง {sent}/{len(all_posts)} | keyword hit: {matched}")
    return sent


# ---------------------------------------------------------------------------
async def run():
    if not FB_EMAIL or not FB_PASSWORD or not FB_GROUP_URL:
        print("❌ กรุณาตั้งค่า FB_EMAIL, FB_PASSWORD, FB_GROUP_URL ใน backend/.env")
        sys.exit(1)

    try:
        from playwright.async_api import async_playwright
    except ImportError:
        print("❌ ยังไม่ได้ติดตั้ง playwright — รัน: python -m playwright install chromium")
        sys.exit(1)

    seen = load_seen()
    print(f"📋 โพสต์ที่เคยเห็นแล้ว: {len(seen)} รายการ")

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(
            headless=False,
            args=["--disable-blink-features=AutomationControlled", "--no-sandbox",
                  "--start-maximized"],
        )

        if SESSION_FILE.exists():
            print(f"📂 โหลด session จาก {SESSION_FILE.name}")
            ctx = await browser.new_context(
                storage_state=str(SESSION_FILE),
                viewport={"width": 1280, "height": 900},
            )
        else:
            ctx = await browser.new_context(
                user_agent=("Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                            "AppleWebKit/537.36 (KHTML, like Gecko) "
                            "Chrome/124.0.0.0 Safari/537.36"),
                viewport={"width": 1280, "height": 900},
            )

        page = await ctx.new_page()
        print("🌐 กำลังเปิด Facebook...")
        await page.goto("https://www.facebook.com", wait_until="domcontentloaded")
        await asyncio.sleep(4)

        if not await is_logged_in(page):
            print("🔑 ยังไม่ได้ Login")
            ok = await do_login(page)
            if not ok:
                print("❌ Login ไม่สำเร็จ")
                await browser.close()
                return
        else:
            print("✅ Login อยู่แล้ว")

        if await is_logged_in(page):
            await ctx.storage_state(path=str(SESSION_FILE))
            print("💾 บันทึก session แล้ว")

        print(f"\n📁 กำลังเปิดกลุ่ม...")
        await page.goto(FB_GROUP_URL, wait_until="domcontentloaded")
        await asyncio.sleep(5)

        if "login" in page.url.lower():
            print("❌ Redirect ไป login — ลบ session แล้วรันใหม่")
            SESSION_FILE.unlink(missing_ok=True)
            await browser.close()
            return

        body = (await page.inner_text("body"))[:800].lower()
        if any(k in body for k in ["join group", "request to join", "ขอเข้าร่วม", "เข้าร่วมกลุ่ม"]):
            print("❌ ยังไม่ได้เป็น member ของกลุ่มนี้")
            await browser.close()
            return

        print(f"✅ เข้ากลุ่มได้แล้ว\n")

        round_no = 0
        while True:
            round_no += 1
            print(f"\n{'='*60}")
            print(f"🔄 รอบที่ {round_no} — {time.strftime('%H:%M:%S')}")
            print(f"{'='*60}")

            await page.goto(FB_GROUP_URL, wait_until="domcontentloaded")
            await asyncio.sleep(4)

            if not await is_logged_in(page):
                print("⚠️  Session หมดอายุ — กำลัง login ใหม่")
                ok = await do_login(page)
                if ok:
                    await ctx.storage_state(path=str(SESSION_FILE))
                    await page.goto(FB_GROUP_URL, wait_until="domcontentloaded")
                    await asyncio.sleep(4)

            await scrape_once(page, seen)

            next_t = time.strftime("%H:%M:%S", time.localtime(time.time() + INTERVAL_MIN * 60))
            print(f"\n⏰ รอบต่อไป: {next_t}  |  กด Ctrl+C เพื่อหยุด")
            await asyncio.sleep(INTERVAL_MIN * 60)


if __name__ == "__main__":
    try:
        asyncio.run(run())
    except KeyboardInterrupt:
        print("\n\n🛑 หยุดแล้ว")
