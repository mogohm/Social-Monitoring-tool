# -*- coding: utf-8 -*-
"""Debug: dump raw DOM data from post cards — engagement text, aria-labels, image srcs"""
import asyncio, os, sys, json
from pathlib import Path
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent / ".env")

FB_GROUP_URL = os.getenv("FB_GROUP_URL", "")
SESSION_FILE = Path(__file__).parent / ".fb_session.json"
OUT_FILE     = Path(__file__).parent / "debug_engagement.json"

JS = r"""
() => {
    const feed = document.querySelector('[role="feed"]');
    if (!feed) return {error: 'no feed'};

    const results = [];
    const children = Array.from(feed.children);
    let found = 0;

    for (const child of children) {
        if (found >= 5) break;

        // Check it's a post card
        const allLinks = Array.from(child.querySelectorAll('a[href]'));
        const isPost = allLinks.some(a => {
            const h = a.getAttribute('href') || '';
            return h.includes('/post_insights/') || h.includes('/posts/') || h.includes('set=gm.');
        });
        if (!isPost) continue;
        found++;

        // --- Author ---
        let author = '';
        for (const a of child.querySelectorAll('a[href*="/user/"], a[href*="profile.php"]')) {
            const t = (a.innerText || '').trim();
            if (t.length > 1 && t.length < 80) { author = t; break; }
        }

        // --- Full innerText (first 800 chars) ---
        const fullText = (child.innerText || '').slice(0, 800);

        // --- All aria-label elements ---
        const ariaEls = Array.from(child.querySelectorAll('[aria-label]')).map(el => ({
            tag: el.tagName,
            label: el.getAttribute('aria-label'),
            text: (el.innerText || '').slice(0, 60)
        }));

        // --- All images ---
        const imgs = Array.from(child.querySelectorAll('img')).map(img => ({
            attrSrc: img.getAttribute('src') || '',
            currentSrc: img.currentSrc || '',
            dataSrc: img.getAttribute('data-src') || '',
            w: img.getAttribute('width') || '',
            h: img.getAttribute('height') || '',
            naturalW: img.naturalWidth,
            naturalH: img.naturalHeight
        }));

        // --- Background images ---
        const bgImgs = Array.from(child.querySelectorAll('[style*="background-image"]')).map(el => ({
            style: (el.getAttribute('style') || '').slice(0, 200)
        }));

        // --- Reaction/comment count spans (look for numbers near reaction icons) ---
        const spanNums = Array.from(child.querySelectorAll('span')).filter(s => {
            const t = (s.innerText || '').trim();
            return /^[\d.,]+[KkMm]?$/.test(t) && t.length < 10;
        }).map(s => ({
            text: s.innerText.trim(),
            html: s.parentElement ? s.parentElement.innerText.trim().slice(0, 80) : ''
        }));

        results.push({ author, fullText, ariaEls, imgs, bgImgs, spanNums });
    }
    return { feedChildren: children.length, postsFound: found, results };
}
"""

async def run():
    from playwright.async_api import async_playwright
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=False)
        ctx_args = {"viewport": {"width": 1280, "height": 900}}
        if SESSION_FILE.exists():
            ctx_args["storage_state"] = str(SESSION_FILE)
        ctx  = await browser.new_context(**ctx_args)
        page = await ctx.new_page()

        url = FB_GROUP_URL.rstrip("/") + "?sorting_setting=CHRONOLOGICAL"
        print(f"Opening: {url}")
        await page.goto(url, wait_until="domcontentloaded")
        await asyncio.sleep(12)

        print("Scrolling to load posts...")
        for _ in range(6):
            await page.evaluate("window.scrollBy(0, window.innerHeight * 1.5)")
            await asyncio.sleep(3)

        print("Extracting debug data...")
        data = await page.evaluate(JS)

        OUT_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"\nSaved to {OUT_FILE}")
        print(f"Feed children: {data.get('feedChildren')}, Posts found: {data.get('postsFound')}")

        for i, r in enumerate(data.get('results', [])):
            print(f"\n{'='*60}")
            print(f"POST {i+1}: {r['author']}")
            print(f"--- innerText (first 400 chars) ---")
            print(r['fullText'][:400])
            print(f"--- aria-labels ({len(r['ariaEls'])}) ---")
            for a in r['ariaEls'][:15]:
                if a['label']: print(f"  [{a['tag']}] label='{a['label'][:80]}' text='{a['text']}'")
            print(f"--- images ({len(r['imgs'])}) ---")
            for img in r['imgs']:
                cs = img['currentSrc'][:80] if img['currentSrc'] else ''
                at = img['attrSrc'][:80] if img['attrSrc'] else ''
                print(f"  currentSrc={cs}")
                print(f"  attrSrc   ={at}")
                print(f"  size attr=({img['w']}x{img['h']}) natural=({img['naturalW']}x{img['naturalH']})")
            print(f"--- span numbers ---")
            for s in r['spanNums'][:10]:
                print(f"  '{s['text']}' in: {s['html'][:60]}")

        await browser.close()

if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    asyncio.run(run())
