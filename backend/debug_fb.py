# -*- coding: utf-8 -*-
"""Debug script — วิเคราะห์ DOM structure จริงของกลุ่ม Facebook"""

import asyncio, json, os, sys
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

FB_GROUP_URL = os.getenv("FB_GROUP_URL", "")
SESSION_FILE = Path(__file__).parent / ".fb_session.json"
LOG_FILE     = Path(__file__).parent / "debug_dom.json"

JS_DEBUG = r"""
() => {
    const articles = Array.from(document.querySelectorAll('div[role="article"]'));
    return articles.map((art, idx) => {
        // depth of ancestor articles
        let depth = 0, p = art.parentElement;
        while (p && p !== document.body) {
            if (p.getAttribute?.('role') === 'article') depth++;
            p = p.parentElement;
        }

        // buttons
        const btns = Array.from(art.querySelectorAll('[role="button"], a[role="button"]'));
        const btnTexts = btns.map(b => (b.innerText || '').trim()).filter(t => t.length < 30 && t.length > 0);

        // links
        const links = Array.from(art.querySelectorAll('a[href]'))
            .map(a => a.getAttribute('href') || '')
            .filter(h => h.includes('/posts/') || h.includes('/permalink/') || h.includes('comment_id'))
            .slice(0, 5);

        // author links
        const userLinks = Array.from(art.querySelectorAll('a[href*="/user/"]'))
            .map(a => ({ text: (a.innerText||'').trim(), href: a.getAttribute('href')||'' }))
            .filter(x => x.text.length > 1 && x.text.length < 80)
            .slice(0, 2);

        // content preview
        const dirEls = Array.from(art.querySelectorAll('div[dir="auto"], span[dir="auto"]'));
        const texts = [...new Set(dirEls.map(e => (e.innerText||'').trim()).filter(t => t.length > 5))].slice(0, 3);

        // images
        const imgs = Array.from(art.querySelectorAll('img'))
            .map(i => i.src || i.getAttribute('data-src') || '')
            .filter(s => s.includes('scontent') || s.includes('fbcdn'))
            .slice(0, 2);

        return { idx, depth, btnTexts, links, userLinks, texts, imgs };
    });
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

        # CHRONOLOGICAL = เรียงโพสต์ตามเวลา (ไม่ใช่ comment activity)
        group_url = FB_GROUP_URL.rstrip("/") + "?sorting_setting=CHRONOLOGICAL"
        print(f"Opening: {group_url}")
        await page.goto(group_url, wait_until="domcontentloaded")
        await asyncio.sleep(10)

        print(f"URL after load: {page.url}")
        body_preview = (await page.inner_text("body"))[:300]
        print(f"Body: {body_preview}")

        # Pre-scroll ผ่าน header/featured — ไม่คลิก tab ใดๆ
        print("Pre-scrolling 6 rounds...")
        for i in range(6):
            await page.evaluate("window.scrollBy(0, window.innerHeight * 1.5)")
            await asyncio.sleep(2.5)
            print(f"  scroll {i+1}/6")

        # เก็บ screenshot
        await page.screenshot(path=str(Path(__file__).parent / "debug_after_scroll.png"), full_page=False)
        print("Screenshot saved: debug_after_scroll.png")

        print("Running DOM analysis...")
        data = await page.evaluate(JS_DEBUG)
        LOG_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"Found {len(data)} articles — saved to debug_dom.json")

        for item in data:
            has_share = any(t.lower() in ("share", "แชร์") for t in item["btnTexts"])
            post_link = any("/posts/" in l or "/permalink/" in l for l in item["links"]
                            if "comment_id" not in l)
            print(f"\n--- Article [{item['idx']}] depth={item['depth']} hasShare={has_share} hasPostLink={post_link}")
            print(f"   btns:  {item['btnTexts'][:6]}")
            print(f"   links: {item['links'][:3]}")
            print(f"   user:  {item['userLinks']}")
            print(f"   texts: {[t[:50] for t in item['texts']]}")
            print(f"   imgs:  {len(item['imgs'])} images")

        await browser.close()


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    asyncio.run(run())
