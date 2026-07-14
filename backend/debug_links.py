# -*- coding: utf-8 -*-
"""Debug all links inside feed children"""
import asyncio, os, sys
from pathlib import Path
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent / ".env")

FB_GROUP_URL = os.getenv("FB_GROUP_URL","")
SESSION_FILE = Path(__file__).parent / ".fb_session.json"

JS = r"""
() => {
    const feed = document.querySelector('[role="feed"]');
    if (!feed) return {error: 'no feed'};

    return Array.from(feed.children).slice(0,8).map((child, idx) => {
        const allLinks = Array.from(child.querySelectorAll('a[href]'))
            .map(a => a.getAttribute('href')||'')
            .filter(h => h.length > 3)
            .slice(0,8);

        const hasComment = allLinks.some(h => h.includes('comment_id'));
        const hasPost    = allLinks.some(h => (h.includes('/posts/') || h.includes('/permalink/') || h.includes('story_fbid')) && !h.includes('comment_id'));
        const articleCnt = child.querySelectorAll('[role="article"]').length;
        const text = (child.innerText||'').slice(0,80).replace(/\n/g,' ');

        return { idx, hasPost, hasComment, articleCnt, text, links: allLinks };
    });
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
        await page.goto(url, wait_until="domcontentloaded")
        await asyncio.sleep(10)

        for i in range(3):
            await page.evaluate("window.scrollBy(0, window.innerHeight * 1.5)")
            await asyncio.sleep(3)

        data = await page.evaluate(JS)
        for item in data:
            print(f"\n[{item['idx']}] hasPost={item['hasPost']} hasComment={item['hasComment']} articles={item['articleCnt']}")
            print(f"  text: {item['text']}")
            for lnk in item['links']:
                print(f"  link: {lnk[:100]}")

        await browser.close()

if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    asyncio.run(run())
