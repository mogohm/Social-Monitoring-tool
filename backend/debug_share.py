# -*- coding: utf-8 -*-
"""Find Share buttons and their parent element roles"""
import asyncio, json, os, sys
from pathlib import Path
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent / ".env")

FB_GROUP_URL = os.getenv("FB_GROUP_URL","")
SESSION_FILE = Path(__file__).parent / ".fb_session.json"

JS = r"""
() => {
    // หา Share buttons ทุกที่บนหน้า
    const allBtns = Array.from(document.querySelectorAll('[role="button"], a[role="button"], button'));
    const shareBtns = allBtns.filter(b => {
        const t = (b.innerText || b.textContent || '').trim().toLowerCase();
        return t === 'share' || t === 'แชร์';
    });

    // หา parent role ของแต่ละ Share button
    const results = shareBtns.map(b => {
        const chain = [];
        let p = b.parentElement;
        while (p && p !== document.body) {
            const role = p.getAttribute?.('role');
            const tag  = p.tagName;
            if (role || tag === 'ARTICLE') {
                chain.push({ role: role || '', tag });
                if (chain.length >= 5) break;
            }
            p = p.parentElement;
        }
        // content preview from nearest article
        let articleEl = b.closest('[role="article"]');
        let preview = '';
        if (articleEl) {
            const dirs = Array.from(articleEl.querySelectorAll('div[dir="auto"]'));
            preview = dirs.map(d => (d.innerText||'').trim()).filter(t=>t.length>3).slice(0,2).join(' | ');
        }
        return { chain, preview };
    });

    // ยังหา Feed container ด้วย
    const feed = document.querySelector('[role="feed"]');
    const feedChildren = feed
        ? Array.from(feed.children).slice(0,10).map(c => ({
            tag: c.tagName,
            role: c.getAttribute('role') || '',
            classes: (c.className||'').slice(0,60),
            hasArticle: c.querySelectorAll('[role="article"]').length,
            hasShare: Array.from(c.querySelectorAll('[role="button"]')).some(
                b => (b.innerText||'').trim().toLowerCase() === 'share'
            )
          }))
        : [];

    return {
        shareCount: shareBtns.length,
        results,
        feedChildren,
        totalArticles: document.querySelectorAll('[role="article"]').length,
        totalFeedItems: feed ? feed.children.length : 0
    };
}
"""

async def run():
    from playwright.async_api import async_playwright
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=False)
        ctx_args = {"viewport":{"width":1280,"height":900}}
        if SESSION_FILE.exists():
            ctx_args["storage_state"] = str(SESSION_FILE)
        ctx  = await browser.new_context(**ctx_args)
        page = await ctx.new_page()

        url = FB_GROUP_URL.rstrip("/") + "?sorting_setting=CHRONOLOGICAL"
        print(f"Opening: {url}")
        await page.goto(url, wait_until="domcontentloaded")
        await asyncio.sleep(10)

        # Scroll ผ่าน header
        print("Scrolling 4 rounds (3s wait each)...")
        for i in range(4):
            await page.evaluate("window.scrollBy(0, window.innerHeight * 1.5)")
            await asyncio.sleep(3)
            # เก็บ article count ระหว่าง scroll
            cnt = await page.evaluate("document.querySelectorAll('[role=\"article\"]').length")
            print(f"  scroll {i+1}: {cnt} articles in DOM")

        # รอเพิ่ม
        await asyncio.sleep(3)

        data = await page.evaluate(JS)
        print(f"\nShare buttons found: {data['shareCount']}")
        print(f"Total articles: {data['totalArticles']}")
        print(f"Feed children: {data['totalFeedItems']}")

        for r in data["results"]:
            print(f"  Share -> chain: {r['chain']} | preview: {r['preview'][:80]}")

        print(f"\nFeed container children (first 10):")
        for fc in data["feedChildren"]:
            print(f"  tag={fc['tag']} role={fc['role']!r} hasArticle={fc['hasArticle']} hasShare={fc['hasShare']} cls={fc['classes'][:50]}")

        await page.screenshot(path=str(Path(__file__).parent / "debug_share.png"))
        print("\nScreenshot: debug_share.png")
        await browser.close()

if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    asyncio.run(run())
