# -*- coding: utf-8 -*-
"""Quick test — ตรวจว่าหา post cards ได้จาก role=feed > div"""
import asyncio, os, sys
from pathlib import Path
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent / ".env")

FB_GROUP_URL = os.getenv("FB_GROUP_URL","")
SESSION_FILE = Path(__file__).parent / ".fb_session.json"

JS = r"""
() => {
    const feed = document.querySelector('[role="feed"]');
    if (!feed) return {error: 'no feed', articles: 0, children: 0};

    const children = Array.from(feed.children);
    const postCards = [];

    for (const child of children) {
        const links = Array.from(child.querySelectorAll('a[href*="/posts/"], a[href*="/permalink/"]'));
        // ตรวจ post_insights, photo set=gm., หรือ /posts/ ไม่มี comment_id
        const allLinks = Array.from(child.querySelectorAll('a[href]'));
        const isPost = allLinks.some(a => {
            const h = a.getAttribute('href') || '';
            return h.includes('/post_insights/') ||
                   (h.includes('/photo/') && h.includes('set=gm.')) ||
                   (h.includes('/posts/') && !h.includes('comment_id'));
        });
        if (!isPost) continue;

        // สกัดข้อมูลจาก post card
        // Author
        let author = '';
        for (const a of child.querySelectorAll('a[href*="/user/"]')) {
            const t = (a.innerText || '').trim();
            if (t.length > 1 && t.length < 80) { author = t; break; }
        }

        // Content
        const dirs = Array.from(child.querySelectorAll('div[dir="auto"], span[dir="auto"]'));
        const texts = [...new Set(dirs.map(e=>(e.innerText||'').trim()).filter(t=>t.length>5))];
        const content = texts.slice(0,3).join(' | ').slice(0,100);

        // Post URL from post_insights or photo
        let postUrl = '', postId = '';
        const groupM = window.location.href.match(/\/groups\/([0-9]+)/);
        const GID = groupM ? groupM[1] : '';
        const ins = child.querySelector('a[href*="/post_insights/"]');
        if (ins) {
            const m = (ins.getAttribute('href')||'').match(/\/post_insights\/([0-9]+)/);
            if (m) { postId = m[1]; postUrl = 'https://www.facebook.com/groups/'+GID+'/posts/'+postId+'/'; }
        }
        if (!postId) {
            const ph = child.querySelector('a[href*="/photo/"]');
            if (ph) {
                const m = (ph.getAttribute('href')||'').match(/set=gm\.([0-9]+)/);
                if (m) { postId = m[1]; postUrl = 'https://www.facebook.com/groups/'+GID+'/posts/'+postId+'/'; }
            }
        }

        // Images
        const imgs = Array.from(child.querySelectorAll('img'))
            .map(i=>i.src||'')
            .filter(s=>s.includes('scontent')||s.includes('fbcdn'))
            .filter(s=>!s.includes('rsrc.php')&&!s.includes('emoji'))
            .length;

        // Reactions
        const rxn = child.querySelector('[aria-label*="reaction"i],[aria-label*="ปฏิกิริยา"i]');
        const likes = rxn ? (rxn.getAttribute('aria-label')||rxn.innerText||'') : '';

        postCards.push({ author, content, postId, postUrl: postUrl.slice(0,80), imgs, likes: likes.slice(0,30) });
    }

    return {
        feedChildren: children.length,
        postCardsFound: postCards.length,
        articleComments: document.querySelectorAll('[role="article"]').length,
        posts: postCards
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

        print("Pre-scroll 4 rounds...")
        for i in range(4):
            await page.evaluate("window.scrollBy(0, window.innerHeight * 1.5)")
            await asyncio.sleep(3)

        r = await page.evaluate(JS)
        print(f"\nFeed children: {r.get('feedChildren',0)}")
        print(f"POST CARDS FOUND: {r.get('postCardsFound',0)}")
        print(f"Comment articles: {r.get('articleComments',0)}")
        for p in r.get('posts',[]):
            print(f"\n  POST: {p['author']} | imgs={p['imgs']} | likes={p['likes']}")
            print(f"    content: {p['content']}")
            print(f"    url: {p['postUrl']}")

        await page.screenshot(path=str(Path(__file__).parent/"debug_posts.png"))
        await browser.close()

if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    asyncio.run(run())
