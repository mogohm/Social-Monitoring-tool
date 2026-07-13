# -*- coding: utf-8 -*-
"""
Facebook Closed Group Scraper — SocialEye Monitor
วนเก็บข้อมูลทุก 1 ชั่วโมง — เก็บครบ: ข้อความ, รูป, engagement, ชื่อผู้โพสต์
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
SCROLL_ROUNDS = int(os.getenv("SCROLL_ROUNDS", "8"))
INTERVAL_MIN  = int(os.getenv("SCRAPE_INTERVAL_MIN", "60"))
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


def extract_post_id(url: str) -> str:
    for p in [r"/posts/(\d+)", r"/permalink/(\d+)", r"story_fbid=(\d+)",
               r"[?&]id=(\d+)", r"/(\d{10,})"]:
        m = re.search(p, url)
        if m:
            return m.group(1)
    return ""


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
JS_EXTRACT = """
(article) => {
    const result = {
        author: '', author_url: '', author_id: '',
        content: '', post_url: '', external_id: '',
        timestamp: '', post_type: 'text',
        likes: 0, comments: 0, shares: 0,
        images: []
    };

    // === AUTHOR ===
    // Facebook Groups: ชื่อผู้โพสต์อยู่ใน a[href*="/user/"] ที่มี text ไม่ว่าง
    const userLinks = Array.from(article.querySelectorAll('a[href*="/user/"]'));
    for (const a of userLinks) {
        const text = (a.innerText || '').trim();
        if (text.length > 1 && text.length < 100) {
            result.author = text;
            const href = a.getAttribute('href') || '';
            result.author_url = href.startsWith('/') ? 'https://www.facebook.com' + href.split('?')[0] : href.split('?')[0];
            const idM = href.match(/[/]user[/]([^/?]+)/);
            if (idM) result.author_id = idM[1];
            break;
        }
    }
    // fallback: profile.php?id=
    if (!result.author) {
        const profLinks = Array.from(article.querySelectorAll('a[href*="profile.php"]'));
        for (const a of profLinks) {
            const text = (a.innerText || '').trim();
            if (text.length > 1 && text.length < 100) {
                result.author = text;
                result.author_url = a.getAttribute('href') || '';
                const idM = (a.getAttribute('href')||'').match(/id=([0-9]+)/);
                if (idM) result.author_id = idM[1];
                break;
            }
        }
    }

    // === POST URL + EXTERNAL ID ===
    const postLink = article.querySelector('a[href*="/posts/"], a[href*="/permalink/"]');
    if (postLink) {
        const href = postLink.getAttribute('href') || '';
        result.post_url = href.startsWith('/') ? 'https://www.facebook.com' + href : href;
        const m = href.match(/[/]posts[/]([0-9]+)|[/]permalink[/]([0-9]+)/);
        if (m) result.external_id = m[1] || m[2];
    }

    // === TIMESTAMP ===
    const timeLink = article.querySelector('a[href*="/posts/"] span, a[href*="/permalink/"] span');
    if (timeLink) result.timestamp = (timeLink.getAttribute('title') || timeLink.innerText || '').trim();

    // === CONTENT ===
    // dir[auto] ทั้งหมด — อันแรกมักเป็นชื่อ ที่เหลือเป็น content
    const dirEls = Array.from(article.querySelectorAll('div[dir="auto"], span[dir="auto"]'));
    const dirTexts = [...new Set(dirEls.map(el => (el.innerText||'').trim()).filter(t => t.length > 0))];
    // กรองชื่อออก + กรอง badge เช่น "Rising contributor" "All-star contributor"
    const badges = new Set(['Rising contributor','All-star contributor','Top contributor','New member','Group Expert']);
    const contentLines = dirTexts.filter(t =>
        t !== result.author &&
        !badges.has(t) &&
        t.length > 5 &&
        !/^[0-9]+[hmdwy]$/.test(t)
    );
    // dedup nested (เอา unique)
    result.content = [...new Set(contentLines)].slice(0, 8).join('\\n').slice(0, 6000);

    // === IMAGES ===
    // รอ lazy load: ดู img.src ที่มี scontent หรือ fbcdn
    const imgs = Array.from(article.querySelectorAll('img'));
    for (const img of imgs) {
        const src = img.src || img.getAttribute('data-src') || '';
        if (!src || src.startsWith('data:')) continue;
        if (!src.includes('scontent') && !src.includes('fbcdn.net')) continue;
        if (src.includes('emoji') || src.includes('rsrc.php')) continue;
        const w = img.naturalWidth || parseInt(img.getAttribute('width')||'999');
        const h = img.naturalHeight || parseInt(img.getAttribute('height')||'999');
        if (w > 0 && w <= 60 && h <= 60) continue;
        if (!result.images.includes(src)) result.images.push(src);
    }
    // background-image
    const bgEls = Array.from(article.querySelectorAll('[style*="background-image"]'));
    for (const el of bgEls) {
        const style = el.getAttribute('style') || '';
        const m = style.match(/url\\("(https:[^"]+scontent[^"]+)"\\)/);
        if (m && !result.images.includes(m[1])) result.images.push(m[1]);
    }

    if (article.querySelector('video')) result.post_type = 'video';
    else if (result.images.length > 0) result.post_type = 'photo';

    // === ENGAGEMENT ===
    const parseNum = (t) => {
        t = (t||'').replace(/,/g,'').trim().toLowerCase();
        const m = t.match(/([0-9.]+)([km]?)/);
        if (!m) return 0;
        let n = parseFloat(m[1]);
        if (m[2]==='k') n*=1000; if (m[2]==='m') n*=1000000;
        return Math.round(n);
    };
    const rxnEl = article.querySelector('[aria-label*="reaction" i],[aria-label*="ปฏิกิริยา" i]');
    if (rxnEl) result.likes = parseNum(rxnEl.innerText);
    const cmtEl = article.querySelector('[aria-label*="comment" i],[aria-label*="ความคิดเห็น" i]');
    if (cmtEl) result.comments = parseNum(cmtEl.innerText);
    const shrEl = article.querySelector('[aria-label*="share" i],[aria-label*="การแชร์" i]');
    if (shrEl) result.shares = parseNum(shrEl.innerText);

    return result;
}
"""


async def extract_posts(page, seen: set) -> list[dict]:
    found = []
    # รอให้รูป lazy load
    await asyncio.sleep(2)

    try:
        articles = await page.query_selector_all('div[role="article"]')
        print(f"    พบ {len(articles)} article elements")

        for art in articles:
            # คลิก "See more" / "ดูเพิ่มเติม"
            for see_sel in ['div[role="button"]', 'span[role="button"]']:
                try:
                    btns = await art.query_selector_all(see_sel)
                    for btn in btns:
                        t = (await btn.inner_text()).strip()
                        if t in ("See more", "ดูเพิ่มเติม", "See translation", "ดูการแปล"):
                            await btn.click()
                            await asyncio.sleep(0.5)
                except Exception:
                    pass

            try:
                data = await art.evaluate(JS_EXTRACT)
            except Exception as e:
                print(f"  ⚠️ JS eval error: {e}")
                continue

            content = (data.get("content") or "").strip()
            if not content or len(content) < 10:
                continue

            # dedup
            ext_id  = data.get("external_id", "")
            dedup   = ext_id if ext_id else content[:120]
            if dedup in seen:
                continue
            seen.add(dedup)
            if ext_id:
                seen.add(ext_id)

            found.append({
                "author":      data.get("author") or "Unknown",
                "author_id":   data.get("author_id") or "",
                "author_url":  data.get("author_url") or "",
                "content":     content,
                "url":         data.get("post_url") or FB_GROUP_URL,
                "external_id": ext_id,
                "timestamp":   data.get("timestamp") or "",
                "images":      data.get("images") or [],
                "likes":       data.get("likes") or 0,
                "comments":    data.get("comments") or 0,
                "shares":      data.get("shares") or 0,
                "post_type":   data.get("post_type") or "text",
            })

    except Exception as e:
        print(f"  ⚠️  Extract error: {e}")

    return found


async def send_post(session: aiohttp.ClientSession, post: dict):
    images = post.get("images") or []
    payload = {
        "channel":     "facebook",
        "author":      post["author"],
        "author_id":   post["author_id"] or None,
        "external_id": post["external_id"] or None,
        "content":     post["content"],
        "url":         post["url"],
        "image_url":   images[0] if images else None,
        "image_urls":  images,
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
            print(f"  ⚠️  Webhook {resp.status}: {body[:200]}")
    except Exception as e:
        print(f"  ❌ {e}")
    return None


async def scrape_once(page, seen: set) -> int:
    print(f"\n📜 Scroll {SCROLL_ROUNDS} รอบ...")
    all_posts: list[dict] = []

    for i in range(SCROLL_ROUNDS):
        new = await extract_posts(page, seen)
        all_posts.extend(new)
        print(f"  รอบ {i+1}/{SCROLL_ROUNDS}: +{len(new)} โพสต์ใหม่ (รวม {len(all_posts)})")
        await page.evaluate("window.scrollBy(0, window.innerHeight * 2.5)")
        await asyncio.sleep(3.5)

    await page.evaluate("window.scrollTo(0, 0)")
    await asyncio.sleep(1)

    if not all_posts:
        print("  ⚠️  ไม่พบโพสต์ใหม่รอบนี้")
        return 0

    print(f"\n📡 ส่ง {len(all_posts)} โพสต์ → SocialEye...")
    sent = matched = 0

    async with aiohttp.ClientSession() as http:
        for post in all_posts:
            res = await send_post(http, post)
            if res:
                sent += 1
                kw      = res.get("keywords_matched", 0)
                matched += 1 if kw > 0 else 0
                img_tag  = f"🖼x{len(post['images'])}" if post["images"] else ""
                flag     = "⭐" if kw > 0 else " ✓"
                print(f"  {flag}{img_tag}[❤{post['likes']}💬{post['comments']}] "
                      f"{post['author'][:18]}: {post['content'][:55]}…")
            await asyncio.sleep(0.3)

    save_seen(seen)
    print(f"  → ส่งสำเร็จ {sent}/{len(all_posts)} | keyword hits: {matched}")
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

        ctx_args = {"viewport": {"width": 1280, "height": 900}}
        if SESSION_FILE.exists():
            print(f"📂 โหลด session จาก {SESSION_FILE.name}")
            ctx_args["storage_state"] = str(SESSION_FILE)
        else:
            ctx_args["user_agent"] = (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36"
            )

        ctx  = await browser.new_context(**ctx_args)
        page = await ctx.new_page()

        print("🌐 กำลังเปิด Facebook...")
        await page.goto("https://www.facebook.com", wait_until="domcontentloaded")
        await asyncio.sleep(4)

        if not await is_logged_in(page):
            print("🔑 ยังไม่ได้ Login")
            if not await do_login(page):
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
        if any(k in body for k in ["join group", "request to join", "ขอเข้าร่วม"]):
            print("❌ ยังไม่ได้เป็น member ของกลุ่มนี้")
            await browser.close()
            return

        print(f"✅ เข้ากลุ่มได้แล้ว — เริ่ม loop ทุก {INTERVAL_MIN} นาที\n")

        round_no = 0
        while True:
            round_no += 1
            print(f"\n{'='*60}")
            print(f"🔄 รอบที่ {round_no} — {time.strftime('%Y-%m-%d %H:%M:%S')}")
            print(f"{'='*60}")

            await page.goto(FB_GROUP_URL, wait_until="domcontentloaded")
            await asyncio.sleep(4)

            if not await is_logged_in(page):
                print("⚠️  Session หมดอายุ — login ใหม่")
                if await do_login(page):
                    await ctx.storage_state(path=str(SESSION_FILE))
                    await page.goto(FB_GROUP_URL, wait_until="domcontentloaded")
                    await asyncio.sleep(4)

            await scrape_once(page, seen)

            next_t = time.strftime("%H:%M:%S", time.localtime(time.time() + INTERVAL_MIN * 60))
            print(f"\n⏰ รอบต่อไป: {next_t}  (ทุก {INTERVAL_MIN} นาที) — กด Ctrl+C เพื่อหยุด")
            await asyncio.sleep(INTERVAL_MIN * 60)


if __name__ == "__main__":
    try:
        asyncio.run(run())
    except KeyboardInterrupt:
        print("\n\n🛑 หยุดแล้ว")
