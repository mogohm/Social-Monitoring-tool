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
# Kept at 8: observed cycles surface new posts as late as scroll round 7, so
# trimming rounds loses posts. The cycle is kept short via ELEMENT_SETTLE_SEC
# instead, which costs coverage nothing.
# Set FB_HEADLESS=0 to run with a visible browser. Needed when Facebook shows a
# checkpoint or bot-check: those must be cleared by hand, and a headless run
# just waits and fails. Clear it once visibly and the saved session carries on.
FB_HEADLESS = os.getenv("FB_HEADLESS", "1").strip().lower() not in ("0", "false", "no")
SCROLL_ROUNDS = int(os.getenv("SCROLL_ROUNDS", "8"))
# Seconds to wait after scrolling an element into view, for lazy images.
ELEMENT_SETTLE_SEC = float(os.getenv("ELEMENT_SETTLE_SEC", "1.2"))
INTERVAL_MIN  = int(os.getenv("SCRAPE_INTERVAL_MIN", "60"))
ADMIN_TOKEN   = os.getenv("ADMIN_TOKEN", "")
SESSION_FILE  = Path(__file__).parent / ".fb_session.json"
SEEN_FILE     = Path(__file__).parent / ".fb_seen.json"

# Derive admin API base URL from WEBHOOK_URL
# e.g. https://socialeye-api.vercel.app/api/webhook/mention → https://socialeye-api.vercel.app
_ADMIN_BASE = WEBHOOK_URL.replace("/api/webhook/mention", "").rstrip("/")


# How many post/comment elements the last extract pass saw. A cycle that never
# sees a single element is structurally different from one where dedup filtered
# everything, and must not be reported as "no new data".
_last_element_count = [0]


class SessionLost(Exception):
    """Raised when the group page renders nothing scrapeable — almost always a
    signed-out session. Propagates so the run loop re-authenticates instead of
    quietly reporting an empty cycle."""


class BrowserDead(Exception):
    """Raised when the Playwright/Chromium connection is gone.

    Propagates out of run() so the __main__ loop tears everything down and
    launches a fresh browser — otherwise the scraper keeps cycling forever
    against a dead driver, collecting nothing.
    """


_DEAD_MARKERS = (
    "connection closed",
    "target closed",
    "target page, context or browser has been closed",
    "browser has been closed",
    "browser closed",
)


def _is_browser_dead(exc: Exception) -> bool:
    msg = str(exc).lower()
    return any(m in msg for m in _DEAD_MARKERS)


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
    """True only when actually signed in.

    Previously this accepted `[aria-label="Facebook"]` as proof, but that is the
    Facebook logo, which is also on the signed-out page. When the session
    expired Facebook kept the group URL and drew a login modal over it, so the
    URL check passed too — the scraper believed it was signed in, found zero
    posts, and reported "no new data" for 38 hours.

    A login form is therefore treated as decisive: if one is on the page, we
    are signed out no matter what else matches.
    """
    try:
        if "login" in page.url or "checkpoint" in page.url:
            return False
        logged_out = await page.query_selector(
            '#login_form, input[name="pass"], form[action*="login"]'
        )
        if logged_out:
            return False
        el = await page.query_selector(
            '[aria-label="Home"], [data-pagelet="LeftRail"], '
            'div[data-pagelet="Stories"], div[role="feed"], '
            '[aria-label="Your profile"]'
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
    # Without credentials there is nothing to submit. Filling the form with
    # empty strings just produces a failed login that then gets reported as a
    # checkpoint — two different problems with two different fixes.
    if not FB_EMAIL or not FB_PASSWORD:
        print("🔑 ต้อง login ใหม่ แต่ไม่มี FB_EMAIL/FB_PASSWORD ใน .env")
        if FB_HEADLESS:
            print("   → หยุด scraper แล้ว login ด้วยมือครั้งเดียว:")
            print(f'   cd "{Path(__file__).parent}" && '
                  "set FB_HEADLESS=0 && .venv\\Scripts\\python.exe fb_group_scraper.py")
            return False
        print("   → login ในหน้าต่าง browser ที่เปิดอยู่ได้เลย")
        await page.goto("https://www.facebook.com/login", wait_until="domcontentloaded")
        return await wait_for_login(page, 300)

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

    if FB_HEADLESS:
        # Nobody can clear a checkpoint in a headless browser, so waiting the
        # full timeout only delays the inevitable and burns another attempt.
        print("⚠️  Facebook ขอ checkpoint / bot-check แต่รันแบบ headless อยู่")
        print("   → หยุด scraper แล้วรันคำสั่งนี้ครั้งเดียวเพื่อยืนยันตัวตนด้วยมือ:")
        print(f'   cd "{Path(__file__).parent}" && '
              'set FB_HEADLESS=0 && .venv\\Scripts\\python.exe fb_group_scraper.py')
        print("   ยืนยันเสร็จแล้ว session จะถูกบันทึก ปิดหน้าต่างแล้วเปิด scraper ปกติต่อได้")
        return False

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
        likes: 0, comments: 0, shares: 0, views: 0,
        images: []
    };

    // is_comment จะถูก override จาก Python ตาม element type ที่ส่งมา
    // ไม่ต้องตรวจ Share button ใน JS แล้ว

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
    // Facebook Group CHRONOLOGICAL view ใช้ /post_insights/POST_ID/ สำหรับ post card
    const groupM = window.location.href.match(/\/groups\/([0-9]+)/);
    const GROUP_ID = groupM ? groupM[1] : '';

    // 1. post_insights link (admin view — มีใน CHRONOLOGICAL feed)
    const insightsLnk = article.querySelector('a[href*="/post_insights/"]');
    if (insightsLnk) {
        const h = insightsLnk.getAttribute('href') || '';
        const m = h.match(/\/post_insights\/([0-9]+)/);
        if (m) {
            result.external_id = m[1];
            result.post_url = 'https://www.facebook.com/groups/' + GROUP_ID + '/posts/' + m[1] + '/';
        }
    }
    // 2. /posts/ หรือ /permalink/ ไม่มี comment_id
    if (!result.external_id) {
        for (const lnk of article.querySelectorAll('a[href*="/posts/"], a[href*="/permalink/"]')) {
            const href = lnk.getAttribute('href') || '';
            if (href.includes('comment_id')) continue;
            result.post_url = href.startsWith('/') ? 'https://www.facebook.com' + href : href;
            const m = href.match(/\/posts\/([0-9]+)|\/permalink\/([0-9]+)/);
            if (m) result.external_id = m[1] || m[2];
            break;
        }
    }
    // 3. photo link with set=gm.POST_ID
    if (!result.external_id) {
        const photoLnk = article.querySelector('a[href*="/photo/"]');
        if (photoLnk) {
            const h = photoLnk.getAttribute('href') || '';
            const m = h.match(/set=gm\.([0-9]+)/);
            if (m) {
                result.external_id = m[1];
                result.post_url = 'https://www.facebook.com/groups/' + GROUP_ID + '/posts/' + m[1] + '/';
            }
        }
    }
    // 4. comment_id link (สำหรับ comment article)
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
    // Facebook แสดงอายุโพสต์ ("4h") ไม่ใช่เวลานาฬิกา แต่เก็บเวลาจริงไว้ใน
    // aria-label ของ anchor ตัวเดียวกัน: "Wednesday 5 August 2026 at 09:35"
    // ค่านั้นเป็นเวลาท้องถิ่นของ browser จึงให้ browser แปลงเป็น epoch เอง —
    // ส่ง unix seconds ไปแทน server จะได้ไม่ต้องเดา timezone (ส่ง "09:35" ดิบ ๆ
    // ไปเคยกลายเป็นเวลาเพี้ยน 7 ชั่วโมง และส่ง "4h" ไปเคยถูกอ่านเป็น 04:00)
    const relRe = /^\s*\d+\s*(s|m|h|d|w|y|วิ|นาที|ชม\.?|ชั่วโมง|วัน|สัปดาห์|ปี)\s*$/i;
    const normLabel = (s) => s
        .replace(/^[A-Za-z]+day[,\s]+/i, '')     // "Wednesday "
        .replace(/^[A-Za-z]{3},\s*/i, '')         // "Wed, "
        .replace(/\s+at\s+/i, ' ')
        .replace(/\s+เวลา\s+/, ' ')
        .replace(/\s*น\.?\s*$/, '')
        .trim();

    const nowMs = Date.now();
    const FIVE_YEARS = 5 * 365 * 24 * 3600 * 1000;
    let relEpoch = null, minEpoch = null;
    for (const a of article.querySelectorAll('a[aria-label]')) {
        const label = a.getAttribute('aria-label') || '';
        // alt-text ของรูปก็อยู่ใน aria-label เหมือนกันและยาวมาก ตัดทิ้งด้วยความยาว
        if (label.length > 60 || !/\d/.test(label)) continue;
        const ms = Date.parse(normLabel(label));
        // ต้องเป็นเวลาที่สมเหตุสมผล ไม่ใช่อนาคตและไม่ใช่ 1970
        if (isNaN(ms) || ms > nowMs + 300000 || ms < nowMs - FIVE_YEARS) continue;
        // การ์ดหนึ่งใบมีได้ทั้งเวลาโพสต์และเวลา comment — ตัวที่ innerText เป็น
        // อายุ ("4h") คือของโพสต์เอง ถ้าหาไม่เจอค่อยใช้ตัวที่เก่าที่สุด
        // เพราะ comment เกิดหลังโพสต์เสมอ
        if (relRe.test((a.innerText || '').trim()) && relEpoch === null) relEpoch = ms;
        if (minEpoch === null || ms < minEpoch) minEpoch = ms;
    }
    const bestEpoch = relEpoch !== null ? relEpoch : minEpoch;

    if (bestEpoch !== null) {
        result.timestamp = String(Math.floor(bestEpoch / 1000));
    } else {
        // ไม่มี aria-label ที่อ่านได้ (ภาษาอื่น / DOM เปลี่ยน) — ส่งค่าเดิมไป
        // ฝั่ง server แปลงเวลาสัมพัทธ์ได้อยู่แล้ว แค่หยาบกว่าระดับชั่วโมง
        const abbrEl = article.querySelector('abbr[data-utime], abbr[title]');
        if (abbrEl) {
            result.timestamp = abbrEl.getAttribute('data-utime') || abbrEl.getAttribute('title') || (abbrEl.innerText || '').trim();
        } else {
            const timeSpan = article.querySelector('a[href*="/posts/"] span, a[href*="/permalink/"] span, a[href*="?story_fbid"] span');
            if (timeSpan) result.timestamp = (timeSpan.getAttribute('title') || timeSpan.innerText || '').trim();
        }
    }

    // === CONTENT ===
    // cleanLine removes embedded Facebook UI noise while preserving actual post text
    const FB_UI = /View\s+insights?|View\s+more\s+(?:comments?|answers?|replies?)|View\s+(?:all\s+)?\d+\s+repl(?:y|ies)|Hide\s+translation|See\s+(?:more|less|translation|original)|was\s+live\.?|Photos?\s+from\s+.+?(?:'s)?\s+post|Original\s+audio/gi;
    const cleanLine = (line) => {
        return line
            .replace(/\bhttps?:\/\/\S+/gi, '')
            .replace(FB_UI, '')
            .replace(/\b[A-Za-z0-9]{2,15}\.[a-z]{2,6}(?:\/\S*)?\b/gi, '') // short spam links
            .replace(/\b[A-Za-z0-9]{12,}\b/g, '')                           // garbled tokens (lowered from 15→12)
            .replace(/(\b[A-Za-z0-9]\s){5,}/g, ' ')                         // spaced-out obfuscation
            .replace(/\d[\d.,]*\s*[KkMm]?\s+(?:post\s+reach|การเข้าถึงโพสต์)/gi, '')
            .replace(/\s{2,}/g, ' ').trim();
    };
    // Only extract direct children text elements (not deeply nested comment/reaction areas)
    // Use div[dir="auto"] at controlled depth to avoid comment section text leaking in
    const dirEls = Array.from(article.querySelectorAll(
        ':scope > div div[dir="auto"], :scope > div span[dir="auto"]'
    )).filter(el => {
        // Exclude elements inside reaction bars and comment sections
        const p = el.closest('[aria-label*="comment" i], [aria-label*="reaction" i], [data-visualcompletion]');
        return !p;
    });
    const dirTexts = [...new Set(dirEls.map(el => (el.innerText || '').trim()).filter(t => t.length > 0))];
    const UI_LINES = new Set([
        'Rising contributor','All-star contributor','Top contributor','New member','Group Expert','Admin','Moderator',
        'สมาชิกที่กำลังมาแรง','ผู้ร่วมกลุ่มระดับดาว','ผู้เชี่ยวชาญกลุ่ม',
        'Facebook','Like','Comment','Share','Follow','Send','React',
        'See more','See translation','See original','See less','Hide translation',
        'View insights','View more comments','View more answers',
        'ดูเพิ่มเติม','ถูกใจ','ความคิดเห็น','แชร์','ติดตาม','ดูการแปล','Reply',
        'Write a comment…','Write a public comment…','เขียนความคิดเห็น'
    ]);
    const contentLines = dirTexts
        .filter(t =>
            t !== result.author &&
            !UI_LINES.has(t) &&
            !t.startsWith('View insights') &&
            !t.startsWith('Hide translation') &&
            t.length > 5 &&
            !/^[0-9]+\s*(h|m|d|w|y|hr|min|วัน|ชม|นาที|สัปดาห์)/.test(t) &&
            !/^[0-9]+[hmdwy]$/.test(t) &&
            !/^[A-Za-z0-9]{12,}$/.test(t) &&
            !/^[A-Za-z0-9]{4,15}\.(com|net|org|io|co\.th)$/.test(t) &&
            !t.includes('spnrS') && !t.includes('Soeodta')
        )
        .map(cleanLine)
        .filter(t => t.length > 5 && !t.match(/^[·•\-\s]+$/));
    result.content = [...new Set(contentLines)].slice(0, 3).join('\n').slice(0, 2000);

    // === IMAGES ===
    const imgs = Array.from(article.querySelectorAll('img'));
    for (const img of imgs) {
        const attrSrc = img.getAttribute('src') || '';
        const src = img.currentSrc
            || (attrSrc.startsWith('http') ? attrSrc : '')
            || img.getAttribute('data-src')
            || img.getAttribute('data-lazy-src')
            || '';
        if (!src || src.startsWith('data:')) continue;
        if (!src.includes('scontent')) continue;  // only real content CDN
        if (src.includes('emoji') || src.includes('rsrc.php') || src.includes('safe_image')) continue;
        // Skip icons/profile pics: loaded images with naturalWidth <= 60 are tiny UI elements
        // Unloaded images (naturalWidth=0) pass through — size unknown, keep them
        if (img.naturalWidth > 0 && img.naturalWidth <= 60) continue;
        if (!result.images.includes(src)) result.images.push(src);
    }
    // background-image fallback — only scontent CDN, exclude rsrc.php icons
    const bgEls = Array.from(article.querySelectorAll('[style*="background-image"]'));
    for (const el of bgEls) {
        const style = el.getAttribute('style') || '';
        const m = style.match(/url\("(https:[^"]+scontent[^"]+)"\)/);
        if (m && !m[1].includes('rsrc.php') && !result.images.includes(m[1])) result.images.push(m[1]);
    }

    if (article.querySelector('video')) result.post_type = 'video';
    else if (result.images.length > 0) result.post_type = 'photo';

    // === ENGAGEMENT ===
    // Debug data shows Facebook uses:
    //   div[aria-label="Like"] with innerText = reaction count (e.g. "3", "31")
    //   div[aria-label="Leave a comment"] with innerText = comment count
    //   [aria-label="X people"] breakdown elements (e.g. "Like: 22 people", "Haha: 5 people")
    const parseNum = (t) => {
        t = (t || '').replace(/,/g, '').trim().toLowerCase();
        const m = t.match(/([0-9.]+)\s*([km]?)/);
        if (!m) return 0;
        let n = parseFloat(m[1]);
        if (m[2] === 'k') n *= 1000;
        if (m[2] === 'm') n *= 1000000;
        return Math.round(n);
    };

    // Likes: reaction count button (innerText = number), first match = post level
    const likeBtn = article.querySelector('div[aria-label="Like"], div[aria-label="ถูกใจ"]');
    if (likeBtn) {
        const t = (likeBtn.innerText || '').trim();
        if (/^[\d.,KkMm]+$/.test(t)) result.likes = parseNum(t);
    }
    // Also sum reaction breakdown elements ("Like: 22 people", "Haha: 5 people", etc.)
    // as a cross-check / fallback
    let rxnSum = 0;
    for (const el of article.querySelectorAll('[aria-label$=" people"]')) {
        const lbl = el.getAttribute('aria-label') || '';
        const m = lbl.match(/([0-9,]+)\s+people/);
        if (m) rxnSum += parseInt(m[1].replace(/,/g, ''), 10);
    }
    if (rxnSum > result.likes) result.likes = rxnSum;

    // Comments: comment count button
    const cmtBtn = article.querySelector('div[aria-label="Leave a comment"], div[aria-label="แสดงความคิดเห็น"]');
    if (cmtBtn) {
        const t = (cmtBtn.innerText || '').trim();
        if (/^[\d.,KkMm]+$/.test(t)) result.comments = parseNum(t);
    }

    // Shares: typically no visible counter in group feed; leave as 0
    // Views: post reach — only shown in post insights link text (not innerText accessible here)

    return result;
}
"""


async def _process_element(el, is_comment: bool, seen: set) -> dict | None:
    """สกัดข้อมูลจาก element เดียว (post card หรือ comment article)"""
    try:
        await el.scroll_into_view_if_needed()
        # Lazy-loaded images need a moment for naturalWidth to be set. This was
        # 3.0s, which pushed a cycle to ~7.4 min — longer than the ~5 min the
        # browser connection tends to survive, so no cycle ever finished.
        # Images that are still unloaded pass the naturalWidth filter anyway.
        await asyncio.sleep(ELEMENT_SETTLE_SEC)
    except Exception:
        pass

    # คลิก "See more"
    for see_sel in ['div[role="button"]', 'span[role="button"]']:
        try:
            btns = await el.query_selector_all(see_sel)
            for btn in btns:
                t = (await btn.inner_text()).strip()
                if t in ("See more", "ดูเพิ่มเติม"):
                    await btn.click()
                    await asyncio.sleep(0.4)
        except Exception:
            pass

    try:
        data = await el.evaluate(JS_EXTRACT)
    except Exception as e:
        if _is_browser_dead(e):
            raise BrowserDead(str(e))
        print(f"  ⚠️ JS eval: {e}")
        return None

    if not data:
        return None

    content = (data.get("content") or "").strip()
    if not content or len(content) < 8:
        return None

    ext_id = data.get("external_id", "")
    dedup  = ext_id if ext_id else "h_" + hashlib.md5(content[:120].encode("utf-8", errors="ignore")).hexdigest()[:14]

    if dedup in seen:
        return None
    seen.add(dedup)

    return {
        "dedup":       dedup,
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
        "views":       data.get("views") or 0,
        "post_type":   data.get("post_type") or "text",
        "is_comment":  is_comment,
    }


async def extract_articles(page, seen: set) -> list[dict]:
    found = []

    try:
        # === POSTS: หา div ลูกโดยตรงของ role="feed" ที่มี post_insights หรือ photo set=gm. ===
        # Facebook CHRONOLOGICAL view: post cards ใช้ /post_insights/POST_ID/ link
        # (ไม่ใช้ role="article" — role="article" = comment cards เท่านั้น)
        feed = await page.query_selector('[role="feed"]')
        post_cards = []
        if feed:
            children = await feed.query_selector_all(":scope > div")
            for child in children:
                is_post = False
                # ตรวจ post_insights link
                ins_links = await child.query_selector_all('a[href*="/post_insights/"]')
                if ins_links:
                    is_post = True
                # ตรวจ photo set=gm. link (photo post)
                if not is_post:
                    photo_links = await child.query_selector_all('a[href*="/photo/"]')
                    for lnk in photo_links:
                        href = (await lnk.get_attribute("href")) or ""
                        if "set=gm." in href:
                            is_post = True
                            break
                # ตรวจ /posts/ ไม่มี comment_id
                if not is_post:
                    post_links = await child.query_selector_all('a[href*="/posts/"], a[href*="/permalink/"]')
                    for lnk in post_links:
                        href = (await lnk.get_attribute("href")) or ""
                        if "comment_id" not in href and href.strip():
                            is_post = True
                            break
                if is_post:
                    post_cards.append(child)

        # === COMMENTS: div[role="article"] (ยังคงเก็บ comment) ===
        comment_arts = await page.query_selector_all('div[role="article"]')

        _last_element_count[0] = len(post_cards) + len(comment_arts)
        print(f"    พบ {len(post_cards)} post cards + {len(comment_arts)} comment articles")

        for pc in post_cards:
            item = await _process_element(pc, is_comment=False, seen=seen)
            if item:
                found.append(item)

        for art in comment_arts:
            item = await _process_element(art, is_comment=True, seen=seen)
            if item:
                found.append(item)

    except BrowserDead:
        raise
    except Exception as e:
        if _is_browser_dead(e):
            raise BrowserDead(str(e))
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
        "views":        post.get("views", 0),
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

    # `seen` gains every extracted item so the same post is not collected twice
    # within one cycle. What gets *persisted* must be narrower: an item that
    # never reached the API is not "seen", and writing it out anyway means it is
    # skipped forever — a silent hole no retry can find. Keep the pre-cycle
    # state and re-add only what the API confirmed.
    seen_before = set(seen)

    # Pre-scroll: ข้ามส่วน header / featured / admin panel ให้โพสต์โหลด
    print("  ⬇️  scroll ผ่าน header เพื่อโหลดโพสต์...")
    for _ in range(4):
        try:
            await page.evaluate("window.scrollBy(0, window.innerHeight * 1.5)")
        except Exception as e:
            if _is_browser_dead(e):
                raise BrowserDead(str(e))
            raise
        await asyncio.sleep(2.5)

    # Main loop: extract แล้วค่อย scroll ต่อ
    saw_any_element = False
    for i in range(SCROLL_ROUNDS):
        new = await extract_articles(page, seen)
        if _last_element_count[0] > 0:
            saw_any_element = True
        posts_cnt   = sum(1 for p in new if not p["is_comment"])
        comment_cnt = sum(1 for p in new if p["is_comment"])
        all_items.extend(new)
        print(f"  รอบ {i+1}/{SCROLL_ROUNDS}: +{posts_cnt} โพสต์ +{comment_cnt} comment "
              f"(รวม {len(all_items)})")
        try:
            await page.evaluate("window.scrollBy(0, window.innerHeight * 2.5)")
        except Exception as scroll_err:
            if _is_browser_dead(scroll_err):
                raise BrowserDead(str(scroll_err))
            print(f"  ⚠️ scroll error (ข้าม): {scroll_err}")
            break
        await asyncio.sleep(3.5)

    try:
        await page.evaluate("window.scrollTo(0, 0)")
    except Exception:
        pass
    await asyncio.sleep(1)

    if not saw_any_element:
        # Not "nothing new" — nothing at all was on the page.
        raise SessionLost(
            "ไม่พบ post card หรือ comment article เลยแม้แต่อันเดียวตลอดทั้งรอบ "
            "— น่าจะ session หลุดหรือ Facebook เปลี่ยนหน้า"
        )

    if not all_items:
        print("  ⚠️  ไม่พบข้อมูลใหม่รอบนี้ (เห็นโพสต์บนหน้า แต่เก็บไปแล้วทั้งหมด)")
        return 0

    posts_total   = sum(1 for p in all_items if not p["is_comment"])
    comment_total = sum(1 for p in all_items if p["is_comment"])
    print(f"\n📡 ส่ง {posts_total} โพสต์ + {comment_total} comment → SocialEye...")
    sent = matched = dup = failed = 0
    confirmed = set(seen_before)

    async with aiohttp.ClientSession() as http:
        for item in all_items:
            res = await send_post(http, item)
            if res:
                # Stored or already stored — either way the API holds it, so it
                # is safe never to send again.
                confirmed.add(item["dedup"])
                if res.get("status") == "duplicate":
                    dup += 1
                else:
                    sent += 1
                    kw      = res.get("keywords_matched", 0)
                    matched += 1 if kw > 0 else 0
                    img_tag  = f"🖼x{len(item['images'])}" if item["images"] else ""
                    tag      = "💬" if item["is_comment"] else "📝"
                    flag     = "⭐" if kw > 0 else " ✓"
                    print(f"  {flag}{tag}{img_tag}[❤{item['likes']}] "
                          f"{item['author'][:18]}: {item['content'][:55]}…")
            else:
                failed += 1
            await asyncio.sleep(0.3)

    # Failed items stay out of the persisted set so the next cycle retries them.
    seen.clear()
    seen.update(confirmed)
    save_seen(seen)

    summary = f"  → ส่งสำเร็จ {sent}/{len(all_items)} | keyword hits: {matched}"
    if dup:
        summary += f" | มีอยู่แล้ว {dup}"
    if failed:
        summary += f" | ส่งไม่สำเร็จ {failed} (จะลองใหม่รอบหน้า)"
    print(summary)
    return sent


# ---------------------------------------------------------------------------
async def report_cycle(duration_seconds: float, posts_sent: int):
    """POST heartbeat to admin API after each scrape cycle. Never crashes the scraper."""
    if not ADMIN_TOKEN:
        print("  ⏩ Heartbeat ข้าม — ADMIN_TOKEN ไม่ได้ตั้งค่าใน .env")
        return
    url = f"{_ADMIN_BASE}/api/admin/scraper/heartbeat"
    print(f"  💓 ส่ง Heartbeat → {url}")
    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(
                url,
                json={"last_posts_count": posts_sent, "last_duration_seconds": duration_seconds},
                headers={"X-Admin-Token": ADMIN_TOKEN},
                timeout=aiohttp.ClientTimeout(total=10),
            ) as resp:
                if resp.status != 200:
                    body = await resp.text()
                    print(f"  ⚠️  Heartbeat API {resp.status}: {body[:120]}")
                else:
                    print(f"  ✅ Heartbeat OK")
    except Exception as e:
        print(f"  ⚠️  report_cycle error: {e}")


async def fetch_interval() -> tuple[int, bool]:
    """GET scraper config from admin API. Returns (interval_minutes, enabled).
    Falls back to (INTERVAL_MIN, True) on any error."""
    if not ADMIN_TOKEN:
        return INTERVAL_MIN, True
    url = f"{_ADMIN_BASE}/api/admin/scraper"
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(
                url,
                headers={"X-Admin-Token": ADMIN_TOKEN},
                timeout=aiohttp.ClientTimeout(total=10),
            ) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    return int(data.get("interval_minutes", INTERVAL_MIN)), bool(data.get("enabled", True))
                print(f"  ⚠️  fetch_interval API {resp.status}")
    except Exception as e:
        print(f"  ⚠️  fetch_interval error: {e}")
    return INTERVAL_MIN, True


# ---------------------------------------------------------------------------
async def run():
    if not FB_GROUP_URL:
        print("❌ กรุณาตั้งค่า FB_GROUP_URL ใน backend/.env")
        sys.exit(1)

    # Credentials are only needed to log in. With a saved session there is
    # nothing to log into, so demanding them turned a working setup into a
    # startup failure — and pushed people into writing a password to disk that
    # the run would never read.
    if not SESSION_FILE.exists() and (not FB_EMAIL or not FB_PASSWORD):
        print("❌ ยังไม่มี session และไม่มี FB_EMAIL/FB_PASSWORD ใน backend/.env")
        print("   เลือกอย่างใดอย่างหนึ่ง: กรอกทั้งสองค่า หรือ login ด้วยมือครั้งเดียวด้วย")
        print(f'   cd "{Path(__file__).parent}" && '
              "set FB_HEADLESS=0 && .venv\\Scripts\\python.exe fb_group_scraper.py")
        sys.exit(1)

    try:
        from playwright.async_api import async_playwright
    except ImportError:
        print("❌ ยังไม่ได้ติดตั้ง playwright — รัน: python -m playwright install chromium")
        sys.exit(1)

    # CHRONOLOGICAL: เรียงโพสต์ตามเวลา — ไม่ใช่ comment activity feed
    group_url = FB_GROUP_URL.rstrip("/") + "?sorting_setting=CHRONOLOGICAL"

    seen = load_seen()
    print(f"📋 โพสต์ที่เคยเห็นแล้ว: {len(seen)} รายการ")

    async with async_playwright() as pw:
        if not FB_HEADLESS:
            print("🖥  โหมดเห็นหน้าต่าง (FB_HEADLESS=0) — ทำ checkpoint ใน browser ได้")
        browser = await pw.chromium.launch(
            headless=FB_HEADLESS,
            args=[
                "--disable-blink-features=AutomationControlled",
                "--no-sandbox",
                # Stability flags — the driver↔Chromium connection drops
                # intermittently on long Facebook sessions; these remove the
                # subsystems most often implicated and cut renderer overhead.
                "--disable-dev-shm-usage",
                "--disable-gpu",
                "--disable-extensions",
                "--disable-background-timer-throttling",
                "--disable-backgrounding-occluded-windows",
                "--disable-renderer-backgrounding",
                "--disable-features=TranslateUI,site-per-process",
                "--mute-audio",
                "--no-first-run",
            ],
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

        print(f"\n📁 กำลังเปิดกลุ่ม (chronological posts feed)...")
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
        login_failures = 0
        while True:
            round_no += 1
            print(f"\n{'='*60}")
            print(f"🔄 รอบที่ {round_no} — {time.strftime('%Y-%m-%d %H:%M:%S')}")
            print(f"{'='*60}")

            try:
                await page.goto(group_url, wait_until="domcontentloaded")
            except Exception as e:
                if _is_browser_dead(e):
                    raise BrowserDead(str(e))
                raise
            await asyncio.sleep(5)

            if not await is_logged_in(page):
                print("⚠️  Session หมดอายุ — login ใหม่")
                if await do_login(page):
                    await ctx.storage_state(path=str(SESSION_FILE))
                    await page.goto(group_url, wait_until="domcontentloaded")
                    await asyncio.sleep(5)

            cycle_start = time.time()
            try:
                posts_sent = await scrape_once(page, seen)
            except SessionLost as e:
                # The page had nothing scrapeable. Re-authenticate once and
                # retry rather than reporting a healthy-looking empty cycle.
                print(f"\n🚫 {e}")
                print("🔑 พยายาม login ใหม่แล้วลองอีกครั้ง...")
                SESSION_FILE.unlink(missing_ok=True)
                if await do_login(page):
                    await ctx.storage_state(path=str(SESSION_FILE))
                    await page.goto(group_url, wait_until="domcontentloaded")
                    await asyncio.sleep(6)
                    try:
                        posts_sent = await scrape_once(page, seen)
                    except SessionLost as e2:
                        print(f"❌ ยังเก็บไม่ได้หลัง login ใหม่: {e2}")
                        print("   ต้องเข้าไปตรวจสอบเอง — อาจติด checkpoint / 2FA "
                              "หรือ Facebook เปลี่ยนโครงสร้างหน้า")
                        posts_sent = 0
                else:
                    # Retrying a blocked login every interval risks Facebook
                    # locking the account harder, so back off instead.
                    login_failures += 1
                    backoff = min(30 * login_failures, 120)
                    print(f"❌ Login ไม่สำเร็จ (ครั้งที่ {login_failures}) — "
                          f"พักยาว {backoff} นาทีก่อนลองใหม่ เพื่อเลี่ยงการโดนล็อกบัญชี")
                    await asyncio.sleep(backoff * 60)
                    posts_sent = 0
            else:
                login_failures = 0
            duration = time.time() - cycle_start

            await report_cycle(duration, posts_sent)

            # Wait phase — honour admin pause/interval settings.
            # If paused, check again every 60s until re-enabled.
            while True:
                interval_min, enabled = await fetch_interval()
                if enabled:
                    next_t = time.strftime("%H:%M:%S", time.localtime(time.time() + interval_min * 60))
                    print(f"\n⏰ รอบต่อไป: {next_t}  (ทุก {interval_min} นาที) — กด Ctrl+C เพื่อหยุด")
                    await asyncio.sleep(interval_min * 60)
                    break
                else:
                    print("⏸ Scraper paused by admin — ตรวจสอบอีก 60 วินาที")
                    await asyncio.sleep(60)


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    while True:
        try:
            asyncio.run(run())
            break  # run() returned normally (e.g. session expired) — stop
        except KeyboardInterrupt:
            print("\n\n🛑 หยุดแล้ว")
            break
        except BrowserDead as e:
            print(f"\n💀 Browser ตาย: {e}")
            print("🔄 เปิด browser ใหม่ใน 15 วินาที...")
            time.sleep(15)
        except Exception as e:
            print(f"\n💥 Scraper crash: {e}")
            print("🔄 รีสตาร์ท browser ใน 15 วินาที...")
            time.sleep(15)
