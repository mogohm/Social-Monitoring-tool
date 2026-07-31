# -*- coding: utf-8 -*-
"""
Historical Facebook Group Scraper — เก็บย้อนหลัง N วัน
ใช้ครั้งเดียว เพื่อ backfill ข้อมูลเก่า
"""
import asyncio, aiohttp, hashlib, os, sys, json, time
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
sys.stderr.reconfigure(encoding="utf-8", errors="replace")

# load .env manually (no dotenv dep needed)
_env_file = Path(__file__).parent / ".env"
if _env_file.exists():
    for _line in _env_file.read_text(encoding="utf-8").splitlines():
        _line = _line.strip()
        if _line and not _line.startswith("#") and "=" in _line:
            _k, _, _v = _line.partition("=")
            os.environ.setdefault(_k.strip(), _v.strip())

FB_GROUP_URL = os.getenv("FB_GROUP_URL", "")
WEBHOOK_URL  = os.getenv("SOCIALEYE_WEBHOOK_URL", "https://socialeye-api.vercel.app/api/webhook/mention")
SESSION_FILE = Path(__file__).parent / ".fb_session.json"
SEEN_FILE    = Path(__file__).parent / ".fb_seen.json"

SCROLL_ROUNDS = int(os.getenv("HIST_SCROLL_ROUNDS", "100"))
DAYS_BACK     = int(os.getenv("HIST_DAYS", "10"))
SCROLL_SLEEP  = 2.0   # วินาทีระหว่าง scroll round
ELEMENT_SLEEP = 0.8   # ต่อ post card (ลดจาก 3.0 — ไม่รอ CDN image เก่า)


def load_seen() -> set:
    if SEEN_FILE.exists():
        try:
            return set(json.loads(SEEN_FILE.read_text(encoding="utf-8")))
        except Exception:
            pass
    return set()


def save_seen(seen: set):
    lst = list(seen)[-8000:]
    SEEN_FILE.write_text(json.dumps(lst), encoding="utf-8")


JS_EXTRACT = r"""
(article) => {
    const result = {
        author: '', author_url: '', author_id: '',
        content: '', post_url: '', external_id: '',
        timestamp: '', post_type: 'text',
        likes: 0, comments: 0,
        images: []
    };

    // AUTHOR
    for (const a of article.querySelectorAll('a[href*="/user/"]')) {
        const t = (a.innerText || '').trim();
        if (t.length > 1 && t.length < 100) {
            result.author = t;
            const href = a.getAttribute('href') || '';
            result.author_url = href.startsWith('/') ? 'https://www.facebook.com' + href.split('?')[0] : href.split('?')[0];
            const m = href.match(/\/user\/([^/?#]+)/);
            if (m) result.author_id = m[1];
            break;
        }
    }
    if (!result.author) {
        for (const a of article.querySelectorAll('a[href*="profile.php"]')) {
            const t = (a.innerText || '').trim();
            if (t.length > 1 && t.length < 100) {
                result.author = t;
                const m = (a.getAttribute('href') || '').match(/id=([0-9]+)/);
                if (m) result.author_id = m[1];
                break;
            }
        }
    }
    if (!result.author) {
        const sa = article.querySelector('h2 a, h3 a, strong a');
        if (sa) result.author = (sa.innerText || '').trim();
    }

    // POST URL + EXTERNAL ID
    const groupM = window.location.href.match(/\/groups\/([0-9]+)/);
    const GID = groupM ? groupM[1] : '';
    const ins = article.querySelector('a[href*="/post_insights/"]');
    if (ins) {
        const m = (ins.getAttribute('href') || '').match(/\/post_insights\/([0-9]+)/);
        if (m) { result.external_id = m[1]; result.post_url = 'https://www.facebook.com/groups/' + GID + '/posts/' + m[1] + '/'; }
    }
    if (!result.external_id) {
        for (const lnk of article.querySelectorAll('a[href*="/posts/"], a[href*="/permalink/"]')) {
            const h = lnk.getAttribute('href') || '';
            if (h.includes('comment_id')) continue;
            result.post_url = h.startsWith('/') ? 'https://www.facebook.com' + h : h;
            const m = h.match(/\/posts\/([0-9]+)|\/permalink\/([0-9]+)/);
            if (m) { result.external_id = m[1] || m[2]; break; }
        }
    }

    // TIMESTAMP
    const abbrEl = article.querySelector('abbr[data-utime]');
    if (abbrEl) result.timestamp = abbrEl.getAttribute('data-utime') || '';
    if (!result.timestamp) {
        const ts = article.querySelector('a[href*="/posts/"] span');
        if (ts) result.timestamp = ts.getAttribute('title') || ts.innerText || '';
    }

    // CONTENT
    const FB_UI = /View\s+insights?|View\s+more\s+(?:comments?|replies?)|Hide\s+translation|See\s+(?:more|less|translation|original)|was\s+live\.?|Original\s+audio/gi;
    const clean = (s) => s.replace(/\bhttps?:\/\/\S+/gi,'').replace(FB_UI,'').replace(/\b[A-Za-z0-9]{12,}\b/g,'').replace(/\s{2,}/g,' ').trim();
    const SKIP = new Set(['Facebook','Like','Comment','Share','Reply','See more','View insights','ถูกใจ','ความคิดเห็น','แชร์','ดูเพิ่มเติม']);
    const els = Array.from(article.querySelectorAll(':scope > div div[dir="auto"]'));
    const lines = [...new Set(els.map(e=>(e.innerText||'').trim()).filter(t=>t&&t!==result.author&&!SKIP.has(t)&&t.length>5&&!/^[0-9]+\s*(h|m|d|w|y|วัน|ชม)/.test(t)))]
        .map(clean).filter(t=>t.length>5);
    result.content = [...new Set(lines)].slice(0,3).join('\n').slice(0,2000);

    // IMAGES
    for (const img of article.querySelectorAll('img')) {
        const src = img.currentSrc || img.getAttribute('src') || '';
        if (!src.includes('scontent') || src.includes('emoji') || src.includes('rsrc.php')) continue;
        if (img.naturalWidth > 0 && img.naturalWidth <= 60) continue;
        if (!result.images.includes(src)) result.images.push(src);
    }
    if (result.images.length) result.post_type = 'photo';
    if (article.querySelector('video')) result.post_type = 'video';

    // ENGAGEMENT
    const parseNum = t => { t=(t||'').replace(/,/g,'').trim().toLowerCase(); const m=t.match(/([0-9.]+)\s*([km]?)/); if(!m)return 0; let n=parseFloat(m[1]); if(m[2]==='k')n*=1000; if(m[2]==='m')n*=1000000; return Math.round(n); };
    const likeBtn = article.querySelector('div[aria-label="Like"],div[aria-label="ถูกใจ"]');
    if (likeBtn) { const t=(likeBtn.innerText||'').trim(); if(/^[\d.,KkMm]+$/.test(t)) result.likes=parseNum(t); }
    let rx=0;
    for (const el of article.querySelectorAll('[aria-label$=" people"]')) { const m=(el.getAttribute('aria-label')||'').match(/([0-9,]+)\s+people/); if(m)rx+=parseInt(m[1].replace(/,/g,''),10); }
    if(rx>result.likes) result.likes=rx;
    const cmtBtn = article.querySelector('div[aria-label="Leave a comment"],div[aria-label="แสดงความคิดเห็น"]');
    if (cmtBtn) { const t=(cmtBtn.innerText||'').trim(); if(/^[\d.,KkMm]+$/.test(t)) result.comments=parseNum(t); }

    return result;
}
"""


async def send_post(session: aiohttp.ClientSession, post: dict) -> bool:
    images = post.get("images") or []
    payload = {
        "channel":      "facebook",
        "author":       post.get("author") or "Unknown",
        "author_id":    post.get("author_id") or None,
        "external_id":  post.get("external_id") or None,
        "content":      (post.get("content") or "").strip(),
        "url":          post.get("url") or FB_GROUP_URL,
        "image_url":    images[0] if images else None,
        "image_urls":   images,
        "published_at": post.get("timestamp") or None,
        "likes":        post.get("likes", 0),
        "comments":     post.get("comments", 0),
        "shares":       0,
        "views":        0,
    }
    try:
        async with session.post(WEBHOOK_URL, json=payload, timeout=aiohttp.ClientTimeout(total=15)) as resp:
            return resp.status == 200
    except Exception as e:
        print(f"  ❌ webhook: {e}")
        return False


async def run():
    from playwright.async_api import async_playwright

    seen = load_seen()
    group_url = FB_GROUP_URL.rstrip("/") + "?sorting_setting=CHRONOLOGICAL"
    cutoff_ts = time.time() - DAYS_BACK * 86400

    print(f"📅 เก็บย้อนหลัง {DAYS_BACK} วัน | scroll {SCROLL_ROUNDS} รอบ")
    print(f"📋 seen cache: {len(seen)} รายการ")
    print(f"🎯 cutoff: {time.strftime('%Y-%m-%d %H:%M', time.localtime(cutoff_ts))}")

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=False)
        ctx_args = {"viewport": {"width": 1280, "height": 900}}
        if SESSION_FILE.exists():
            ctx_args["storage_state"] = str(SESSION_FILE)
        ctx = await browser.new_context(**ctx_args)
        page = await ctx.new_page()

        print("\n🌐 เปิด Facebook group...")
        await page.goto(group_url, wait_until="domcontentloaded")
        await asyncio.sleep(12)

        if "login" in page.url or "checkpoint" in page.url:
            print("❌ Session หมดอายุ — โปรด login ใน browser แล้วรอ 3 นาที...")
            await asyncio.sleep(180)

        print("✅ เริ่ม scroll...\n")

        sent_total = 0
        skipped_total = 0
        oldest_ts = None
        hit_cutoff = False
        processed_children = 0  # track index เพื่อประมวลผลแค่ post ใหม่

        async with aiohttp.ClientSession() as http:
            for round_i in range(1, SCROLL_ROUNDS + 1):
                await page.evaluate("window.scrollBy(0, window.innerHeight * 2.5)")
                await asyncio.sleep(SCROLL_SLEEP)

                # ดึง post ใหม่ทุก 5 รอบ หรือใน 3 รอบแรก
                if round_i % 5 == 0 or round_i <= 3:
                    feed = await page.query_selector('[role="feed"]')
                    if not feed:
                        continue

                    all_children = await feed.query_selector_all(":scope > div")
                    new_children = all_children[processed_children:]
                    processed_children = len(all_children)

                    new_posts_this_round = []
                    for child in new_children:
                        # ตรวจว่าเป็น post card
                        is_post = False
                        for sel in ['a[href*="/post_insights/"]', 'a[href*="/posts/"]']:
                            if await child.query_selector(sel):
                                is_post = True
                                break
                        if not is_post:
                            continue
                        try:
                            await child.scroll_into_view_if_needed()
                            await asyncio.sleep(ELEMENT_SLEEP)
                            data = await child.evaluate(JS_EXTRACT)
                        except Exception:
                            continue
                        if not data:
                            continue

                        content = (data.get("content") or "").strip()
                        ext_id  = data.get("external_id", "")
                        if not content and not ext_id:
                            continue

                        dedup = ext_id if ext_id else "h_" + hashlib.md5(content[:120].encode("utf-8", errors="ignore")).hexdigest()[:14]

                        # ตรวจ cutoff
                        ts_raw = data.get("timestamp", "")
                        post_ts = int(ts_raw) if ts_raw and str(ts_raw).isdigit() else None
                        if post_ts and post_ts < cutoff_ts:
                            print(f"\n⏹️  ถึง cutoff ({time.strftime('%Y-%m-%d', time.localtime(post_ts))}) — หยุด")
                            hit_cutoff = True
                            break

                        if dedup in seen:
                            skipped_total += 1
                            continue

                        new_posts_this_round.append((dedup, data))
                        if oldest_ts is None or (post_ts and post_ts < oldest_ts):
                            oldest_ts = post_ts

                    for dedup, p in new_posts_this_round:
                        ok = await send_post(http, {
                            "author":      p.get("author") or "Unknown",
                            "author_id":   p.get("author_id") or "",
                            "content":     (p.get("content") or "").strip(),
                            "url":         p.get("post_url") or FB_GROUP_URL,
                            "external_id": p.get("external_id") or "",
                            "timestamp":   p.get("timestamp") or "",
                            "images":      p.get("images") or [],
                            "likes":       p.get("likes") or 0,
                            "comments":    p.get("comments") or 0,
                        })
                        if ok:
                            seen.add(dedup)
                            sent_total += 1

                    oldest_str = time.strftime('%Y-%m-%d', time.localtime(oldest_ts)) if oldest_ts else "unknown"
                    print(f"รอบ {round_i:3}/{SCROLL_ROUNDS} | cards: {len(all_children)} | ส่ง: {sent_total} | ข้าม: {skipped_total} | เก่าสุด: {oldest_str}")

                    if hit_cutoff:
                        break

        save_seen(seen)
        await browser.close()
        print(f"\n✅ เสร็จแล้ว: ส่ง {sent_total} โพสต์ | ข้าม {skipped_total} (duplicate)")


if __name__ == "__main__":
    asyncio.run(run())
