# -*- coding: utf-8 -*-
"""
Facebook Closed Group Scraper — SocialEye Monitor
เก็บทั้งโพสต์และ comment — รูป, ข้อความ, engagement, ชื่อผู้โพสต์
"""

import asyncio
import aiohttp
import hashlib
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
    lst = list(seen)[-5000:]
    SEEN_FILE.write_text(json.dumps(lst), encoding="utf-8")


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
# JS_EXTRACT: สกัดข้อมูลจาก article element เดียว
# ส่งคืน null ถ้า article นี้เป็น nested comment ที่ไม่ต้องการ
JS_EXTRACT = r"""
(article) => {
    const result = {
        author: '', author_url: '', author_id: '',
        content: '', post_url: '', external_id: '',
        timestamp: '', post_type: 'text', is_comment: false,
        likes: 0, comments: 0, shares: 0,
        images: []
    };

    // === ตรวจว่าเป็น top-level post หรือ nested comment ===
    // Posts: มีปุ่ม Share / แชร์
    // Comments: ไม่มี Share, มีแค่ Reply / ตอบกลับ
    // ตรวจ ancestor article ด้วย
    let parentEl = article.parentElement;
    let isNested = false;
    while (parentEl && parentEl !== document.body) {
        if (parentEl.getAttribute && parentEl.getAttribute('role') === 'article') {
            isNested = true; break;
        }
        parentEl = parentEl.parentElement;
    }

    const allBtns = Array.from(article.querySelectorAll('[role="button"], a[role="button"]'));
    const btnTexts = allBtns.map(b => (b.innerText || '').trim().toLowerCase());
    const hasShare = btnTexts.some(t => t === 'share' || t === 'แชร์');

    result.is_comment = isNested || !hasShare;

    // === AUTHOR ===
    // ลองจาก a[href*="/user/"] ก่อน
    const userLinks = Array.from(article.querySelectorAll('a[href*="/user/"]'));
    for (const a of userLinks) {
        const text = (a.innerText || a.getAttribute('aria-label') || '').trim();
        if (text.length > 1 && text.length < 100) {
            result.author = text;
            const href = a.getAttribute('href') || '';
            result.author_url = href.startsWith('/') ? 'https://www.facebook.com' + href.split('?')[0] : href.split('?')[0];
            const idM = href.match(/\/user\/([^/?#]+)/);
            if (idM) result.author_id = idM[1];
            break;
        }
    }
    // fallback: profile.php?id=
    if (!result.author) {
        const profLinks = Array.from(article.querySelectorAll('a[href*="profile.php"]'));
        for (const a of profLinks) {
            const text = (a.innerText || a.getAttribute('aria-label') || '').trim();
            if (text.length > 1 && text.length < 100) {
                result.author = text;
                result.author_url = a.getAttribute('href') || '';
                const idM = (a.getAttribute('href') || '').match(/id=([0-9]+)/);
                if (idM) result.author_id = idM[1];
                break;
            }
        }
    }
    // fallback: strong a ใน header area
    if (!result.author) {
        const strongA = article.querySelector('h2 a, h3 a, strong a');
        if (strongA) {
            result.author = (strongA.innerText || '').trim();
            result.author_url = strongA.getAttribute('href') || '';
        }
    }

    // === POST URL + EXTERNAL ID ===
    // หา link ที่ชี้ไป /posts/ หรือ /permalink/ (ไม่ใช่ ?comment_id=)
    const postLinks = Array.from(article.querySelectorAll(
        'a[href*="/posts/"], a[href*="/permalink/"]'
    ));
    for (const lnk of postLinks) {
        const href = lnk.getAttribute('href') || '';
        if (href.includes('comment_id')) continue;
        result.post_url = href.startsWith('/') ? 'https://www.facebook.com' + href : href;
        const m = href.match(/\/posts\/([0-9]+)|\/permalink\/([0-9]+)/);
        if (m) result.external_id = m[1] || m[2];
        break;
    }
    // For comments: grab comment_id for dedup
    if (!result.external_id) {
        const cmt = article.querySelector('a[href*="comment_id"]');
        if (cmt) {
            const href = cmt.getAttribute('href') || '';
            const m = href.match(/comment_id=([0-9]+)/);
            if (m) result.external_id = 'cmt_' + m[1];
            result.post_url = href.startsWith('/') ? 'https://www.facebook.com' + href : href;
        }
    }

    // === TIMESTAMP ===
    // abbr[data-utime] หรือ abbr[title] หรือ span บน post link
    const abbrEl = article.querySelector('abbr[data-utime], abbr[title]');
    if (abbrEl) {
        result.timestamp = abbrEl.getAttribute('data-utime') || abbrEl.getAttribute('title') || (abbrEl.innerText || '').trim();
    } else {
        const timeSpan = article.querySelector('a[href*="/posts/"] span, a[href*="/permalink/"] span, a[href*="?story_fbid"] span');
        if (timeSpan) result.timestamp = (timeSpan.getAttribute('title') || timeSpan.innerText || '').trim();
    }

    // === CONTENT ===
    const dirEls = Array.from(article.querySelectorAll('div[dir="auto"], span[dir="auto"]'));
    const dirTexts = [...new Set(dirEls.map(el => (el.innerText || '').trim()).filter(t => t.length > 0))];
    const badges = new Set([
        'Rising contributor','All-star contributor','Top contributor',
        'New member','Group Expert','Admin','Moderator',
        'สมาชิกที่กำลังมาแรง','ผู้ร่วมกลุ่มระดับดาว','ผู้เชี่ยวชาญกลุ่ม'
    ]);
    const contentLines = dirTexts.filter(t =>
        t !== result.author &&
        !badges.has(t) &&
        t.length > 5 &&
        !/^[0-9]+\s*(h|m|d|w|y|hr|min|วัน|ชม|นาที|สัปดาห์)/.test(t) &&
        !/^[0-9]+[hmdwy]$/.test(t)
    );
    result.content = [...new Set(contentLines)].slice(0, 12).join('\n').slice(0, 6000);

    // === IMAGES ===
    const imgs = Array.from(article.querySelectorAll('img'));
    for (const img of imgs) {
        const src = img.src || img.getAttribute('data-src') || img.getAttribute('data-lazy-src') || '';
        if (!src || src.startsWith('data:')) continue;
        if (!src.includes('scontent') && !src.includes('fbcdn.net')) continue;
        if (src.includes('emoji') || src.includes('rsrc.php') || src.includes('safe_image')) continue;
        // กรองรูปเล็ก (avatar, icon)
        const w = img.naturalWidth || parseInt(img.getAttribute('width') || '0') || 999;
        const h = img.naturalHeight || parseInt(img.getAttribute('height') || '0') || 999;
        if (w > 0 && w <= 80 && h > 0 && h <= 80) continue;
        if (!result.images.includes(src)) result.images.push(src);
    }
    // background-image fallback
    const bgEls = Array.from(article.querySelectorAll('[style*="background-image"]'));
    for (const el of bgEls) {
        const style = el.getAttribute('style') || '';
        const m = style.match(/url\("(https:[^"]+(?:scontent|fbcdn)[^"]+)"\)/);
        if (m && !result.images.includes(m[1])) result.images.push(m[1]);
    }

    if (article.querySelector('video')) result.post_type = 'video';
    else if (result.images.length > 0) result.post_type = 'photo';

    // === ENGAGEMENT ===
    const parseNum = (t) => {
        t = (t || '').replace(/,/g, '').trim().toLowerCase();
        const m = t.match(/([0-9.]+)([km]?)/);
        if (!m) return 0;
        let n = parseFloat(m[1]);
        if (m[2] === 'k') n *= 1000;
        if (m[2] === 'm') n *= 1000000;
        return Math.round(n);
    };
    const rxnEl = article.querySelector(
        '[aria-label*="reaction" i],[aria-label*="ปฏิกิริยา" i],' +
        '[aria-label*="people reacted" i],[aria-label*="คนแสดงความรู้สึก" i]'
    );
    if (rxnEl) result.likes = parseNum(rxnEl.getAttribute('aria-label') || rxnEl.innerText);
    const cmtEl = article.querySelector('[aria-label*="comment" i],[aria-label*="ความคิดเห็น" i]');
    if (cmtEl) result.comments = parseNum(cmtEl.getAttribute('aria-label') || cmtEl.innerText);
    const shrEl = article.querySelector('[aria-label*="share" i],[aria-label*="การแชร์" i]');
    if (shrEl) result.shares = parseNum(shrEl.getAttribute('aria-label') || shrEl.innerText);

    return result;
}
"""


async def extract_articles(page, seen: set) -> list[dict]:
    found = []

    try:
        articles = await page.query_selector_all('div[role="article"]')
        if not articles:
            print(f"    ⚠️ ไม่พบ article elements")
            return found
        print(f"    พบ {len(articles)} articles")

        for art in articles:
            # Scroll into view เพื่อให้รูป lazy-load โหลด
            try:
                await art.scroll_into_view_if_needed()
                await asyncio.sleep(0.25)
            except Exception:
                pass

            # คลิก "See more" / "ดูเพิ่มเติม"
            for see_sel in ['div[role="button"]', 'span[role="button"]']:
                try:
                    btns = await art.query_selector_all(see_sel)
                    for btn in btns:
                        t = (await btn.inner_text()).strip()
                        if t in ("See more", "ดูเพิ่มเติม"):
                            await btn.click()
                            await asyncio.sleep(0.4)
                except Exception:
                    pass

            try:
                data = await art.evaluate(JS_EXTRACT)
            except Exception as e:
                print(f"  ⚠️ JS eval error: {e}")
                continue

            if not data:
                continue

            content = (data.get("content") or "").strip()
            if not content or len(content) < 8:
                continue

            is_comment = data.get("is_comment", False)
            ext_id     = data.get("external_id", "")

            # Dedup key
            if ext_id:
                dedup = ext_id
            else:
                dedup = "h_" + hashlib.md5(content[:120].encode("utf-8", errors="ignore")).hexdigest()[:14]

            if dedup in seen:
                continue
            seen.add(dedup)

            found.append({
                "channel":     "facebook_comment" if is_comment else "facebook",
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
                "is_comment":  is_comment,
            })

    except Exception as e:
        print(f"  ⚠️  Extract error: {e}")

    return found


async def send_post(session: aiohttp.ClientSession, post: dict):
    images = post.get("images") or []
    payload = {
        "channel":      post["channel"],
        "author":       post["author"],
        "author_id":    post["author_id"] or None,
        "external_id":  post["external_id"] or None,
        "content":      post["content"],
        "url":          post["url"],
        "image_url":    images[0] if images else None,
        "image_urls":   images,
        "published_at": post["timestamp"] or None,
        "likes":        post["likes"],
        "comments":     post["comments"],
        "shares":       post["shares"],
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
    print(f"\n📜 เริ่ม scrape...")
    all_items: list[dict] = []

    # Pre-scroll: ข้ามส่วน header / featured / admin panel ให้โพสต์โหลด
    print("  ⬇️  scroll ผ่าน header เพื่อโหลดโพสต์...")
    for _ in range(4):
        await page.evaluate("window.scrollBy(0, window.innerHeight * 1.5)")
        await asyncio.sleep(2.5)

    # Main loop: extract แล้วค่อย scroll ต่อ
    for i in range(SCROLL_ROUNDS):
        new = await extract_articles(page, seen)
        posts_cnt   = sum(1 for p in new if not p["is_comment"])
        comment_cnt = sum(1 for p in new if p["is_comment"])
        all_items.extend(new)
        print(f"  รอบ {i+1}/{SCROLL_ROUNDS}: +{posts_cnt} โพสต์ +{comment_cnt} comment "
              f"(รวม {len(all_items)})")
        await page.evaluate("window.scrollBy(0, window.innerHeight * 2.5)")
        await asyncio.sleep(3.5)

    await page.evaluate("window.scrollTo(0, 0)")
    await asyncio.sleep(1)

    if not all_items:
        print("  ⚠️  ไม่พบข้อมูลใหม่รอบนี้")
        return 0

    posts_total   = sum(1 for p in all_items if not p["is_comment"])
    comment_total = sum(1 for p in all_items if p["is_comment"])
    print(f"\n📡 ส่ง {posts_total} โพสต์ + {comment_total} comment → SocialEye...")
    sent = matched = 0

    async with aiohttp.ClientSession() as http:
        for item in all_items:
            res = await send_post(http, item)
            if res:
                sent += 1
                kw      = res.get("keywords_matched", 0)
                matched += 1 if kw > 0 else 0
                img_tag  = f"🖼x{len(item['images'])}" if item["images"] else ""
                tag      = "💬" if item["is_comment"] else "📝"
                flag     = "⭐" if kw > 0 else " ✓"
                print(f"  {flag}{tag}{img_tag}[❤{item['likes']}] "
                      f"{item['author'][:18]}: {item['content'][:55]}…")
            await asyncio.sleep(0.3)

    save_seen(seen)
    print(f"  → ส่งสำเร็จ {sent}/{len(all_items)} | keyword hits: {matched}")
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

    # URL แบบ recent activity — ข้ามหน้า admin overview
    group_url = FB_GROUP_URL.rstrip("/") + "?sorting_setting=RECENT_ACTIVITY"

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

        print(f"\n📁 กำลังเปิดกลุ่ม (recent activity feed)...")
        await page.goto(group_url, wait_until="domcontentloaded")
        await asyncio.sleep(6)

        if "login" in page.url.lower():
            print("❌ Redirect ไป login — ลบ session แล้วรันใหม่")
            SESSION_FILE.unlink(missing_ok=True)
            await browser.close()
            return

        body = (await page.inner_text("body"))[:600].lower()
        if any(k in body for k in ["join group", "request to join", "ขอเข้าร่วม"]):
            print("❌ ยังไม่ได้เป็น member ของกลุ่มนี้")
            await browser.close()
            return

        # Debug: แสดง body สั้น ๆ เพื่อยืนยันว่าโหลดถูกหน้า
        print(f"📄 Page body (200 chars): {(await page.inner_text('body'))[:200]}")
        print(f"✅ เข้ากลุ่มได้แล้ว — เริ่ม loop ทุก {INTERVAL_MIN} นาที\n")

        round_no = 0
        while True:
            round_no += 1
            print(f"\n{'='*60}")
            print(f"🔄 รอบที่ {round_no} — {time.strftime('%Y-%m-%d %H:%M:%S')}")
            print(f"{'='*60}")

            await page.goto(group_url, wait_until="domcontentloaded")
            await asyncio.sleep(5)

            if not await is_logged_in(page):
                print("⚠️  Session หมดอายุ — login ใหม่")
                if await do_login(page):
                    await ctx.storage_state(path=str(SESSION_FILE))
                    await page.goto(group_url, wait_until="domcontentloaded")
                    await asyncio.sleep(5)

            await scrape_once(page, seen)

            next_t = time.strftime("%H:%M:%S", time.localtime(time.time() + INTERVAL_MIN * 60))
            print(f"\n⏰ รอบต่อไป: {next_t}  (ทุก {INTERVAL_MIN} นาที) — กด Ctrl+C เพื่อหยุด")
            await asyncio.sleep(INTERVAL_MIN * 60)


if __name__ == "__main__":
    try:
        asyncio.run(run())
    except KeyboardInterrupt:
        print("\n\n🛑 หยุดแล้ว")
