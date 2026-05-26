"use client";
import { useState } from "react";
import {
  Plug, ArrowRight, CheckCircle, AlertCircle, Clock,
  Code, Globe, Webhook, Key, ExternalLink, ChevronDown, ChevronUp,
  Zap, Database, RefreshCw,
} from "lucide-react";

/* ---------- types ---------- */
type Method = "API" | "Webhook" | "RSS" | "Scraping";
type Tier = "free" | "paid" | "free-limited";

interface Channel {
  id: string;
  name: string;
  emoji: string;
  method: Method;
  tier: Tier;
  description: string;
  howItWorks: string;
  credentials: { key: string; desc: string }[];
  steps: string[];
  webhookExample?: string;
  apiDocsUrl?: string;
  tools?: string[];
}

/* ---------- channel data ---------- */
const CHANNELS: Channel[] = [
  {
    id: "facebook",
    name: "Facebook",
    emoji: "📘",
    method: "API",
    tier: "free-limited",
    description: "ดึงโพสต์, คอมเมนต์, และ mention จาก Page หรือ Group ผ่าน Graph API",
    howItWorks: "Facebook Graph API อนุญาตให้ดึงข้อมูลโพสต์และคอมเมนต์จาก Page ที่เราเป็นเจ้าของ สำหรับ Page ของคู่แข่งหรือ Public Page ต้องใช้ Public Content Access ซึ่งต้องขอ permission พิเศษ",
    credentials: [
      { key: "App ID", desc: "จาก Facebook Developer Console" },
      { key: "App Secret", desc: "จาก Facebook Developer Console" },
      { key: "Page Access Token", desc: "Long-lived token สำหรับ Page ที่ต้องการ monitor" },
      { key: "Page ID", desc: "ID ของ Facebook Page เป้าหมาย" },
    ],
    steps: [
      "ไปที่ developers.facebook.com → สร้าง App ใหม่ (Business type)",
      "เพิ่ม product: Facebook Login + Pages API",
      "ขอ permission: pages_read_engagement, pages_read_user_content",
      "Generate Page Access Token ผ่าน Graph API Explorer",
      "แปลงเป็น Long-lived Token (อายุ 60 วัน) ด้วย /oauth/access_token",
      "เรียก GET /{page-id}/posts?fields=message,created_time,likes.summary(true),comments.summary(true)",
      "ส่งผลลัพธ์ไปยัง POST /api/webhook/mention ของระบบ",
    ],
    apiDocsUrl: "https://developers.facebook.com/docs/graph-api",
    tools: ["n8n", "Make.com", "Python requests"],
    webhookExample: `# Python — ดึง Facebook posts แล้วส่งเข้าระบบ
import requests

PAGE_TOKEN = "your_page_access_token"
PAGE_ID = "your_page_id"
API_URL = "https://your-backend.onrender.com/api/webhook/mention"

r = requests.get(
  f"https://graph.facebook.com/v19.0/{PAGE_ID}/posts",
  params={"fields": "message,created_time,from,likes.summary(true),comments.summary(true)",
          "access_token": PAGE_TOKEN}
)
for post in r.json().get("data", []):
    requests.post(API_URL, json={
        "channel": "facebook",
        "author": post.get("from", {}).get("name", "Unknown"),
        "content": post.get("message", ""),
        "url": f"https://facebook.com/{post['id']}",
        "likes": post.get("likes", {}).get("summary", {}).get("total_count", 0),
        "comments": post.get("comments", {}).get("summary", {}).get("total_count", 0),
    })`,
  },
  {
    id: "twitter",
    name: "X (Twitter)",
    emoji: "🐦",
    method: "API",
    tier: "paid",
    description: "ค้นหา tweet ที่กล่าวถึง keyword ผ่าน Twitter API v2",
    howItWorks: "Twitter API v2 มี Search endpoint ที่ค้น tweet แบบ real-time และ historical ได้ แต่ปัจจุบัน Basic tier ราคา $100/เดือน สำหรับ 10,000 tweets/เดือน หรือใช้ Free tier ได้เพียง 1 App-only read request ต่อ 15 นาที",
    credentials: [
      { key: "Bearer Token", desc: "จาก Twitter Developer Portal (App-only auth)" },
      { key: "API Key & Secret", desc: "สำหรับ User-context auth" },
    ],
    steps: [
      "สมัครที่ developer.twitter.com → สร้าง Project + App",
      "เลือก Basic plan ($100/เดือน) หรือ Free (จำกัดมาก)",
      "คัดลอก Bearer Token จาก Keys and Tokens",
      "เรียก GET /2/tweets/search/recent?query=N8+OR+Natural8&tweet.fields=public_metrics,author_id",
      "ส่งผลลัพธ์ไปยัง POST /api/webhook/mention",
    ],
    apiDocsUrl: "https://developer.twitter.com/en/docs/twitter-api",
    tools: ["n8n", "Tweepy (Python)", "Make.com"],
    webhookExample: `# Python Tweepy — ค้นหา tweet
import tweepy, requests

client = tweepy.Client(bearer_token="YOUR_BEARER_TOKEN")
API_URL = "https://your-backend.onrender.com/api/webhook/mention"

tweets = client.search_recent_tweets(
    query="N8 OR Natural8 OR poker lang:th",
    tweet_fields=["public_metrics", "author_id", "created_at"],
    max_results=100
)
for tweet in (tweets.data or []):
    m = tweet.public_metrics
    requests.post(API_URL, json={
        "channel": "twitter",
        "author": str(tweet.author_id),
        "content": tweet.text,
        "url": f"https://twitter.com/i/web/status/{tweet.id}",
        "likes": m["like_count"],
        "comments": m["reply_count"],
        "shares": m["retweet_count"],
    })`,
  },
  {
    id: "youtube",
    name: "YouTube",
    emoji: "▶️",
    method: "API",
    tier: "free",
    description: "ดึงคอมเมนต์และ video ที่กล่าวถึง keyword ผ่าน YouTube Data API v3",
    howItWorks: "YouTube Data API v3 ฟรี (quota 10,000 units/วัน) ค้นหา video ด้วย keyword แล้วดึง comments ของแต่ละ video ได้ เหมาะมากสำหรับ monitor ว่ามีคนทำ review หรือพูดถึง brand บน YouTube",
    credentials: [
      { key: "Google API Key", desc: "จาก Google Cloud Console (ไม่ต้อง OAuth สำหรับ public data)" },
    ],
    steps: [
      "ไปที่ console.cloud.google.com → สร้าง Project",
      "Enable 'YouTube Data API v3' ใน API Library",
      "สร้าง API Key ใน Credentials (ไม่ต้อง OAuth)",
      "เรียก GET /youtube/v3/search?q=N8+poker&type=video&key=YOUR_KEY",
      "สำหรับ comment: GET /youtube/v3/commentThreads?videoId=XXX&key=YOUR_KEY",
      "ส่งผลลัพธ์ไปยัง POST /api/webhook/mention",
    ],
    apiDocsUrl: "https://developers.google.com/youtube/v3",
    tools: ["n8n", "Google API Python Client", "Make.com"],
    webhookExample: `# Python — YouTube search + comments
from googleapiclient.discovery import build
import requests

youtube = build("youtube", "v3", developerKey="YOUR_API_KEY")
API_URL = "https://your-backend.onrender.com/api/webhook/mention"

# ค้นหา video
search = youtube.search().list(q="N8 poker thailand", part="snippet", type="video", maxResults=10).execute()
for item in search["items"]:
    vid_id = item["id"]["videoId"]
    snippet = item["snippet"]
    # ดึง comment
    try:
        comments = youtube.commentThreads().list(
            videoId=vid_id, part="snippet", maxResults=20
        ).execute()
        for c in comments["items"]:
            top = c["snippet"]["topLevelComment"]["snippet"]
            requests.post(API_URL, json={
                "channel": "youtube",
                "author": top["authorDisplayName"],
                "content": top["textDisplay"],
                "url": f"https://youtube.com/watch?v={vid_id}",
                "likes": top["likeCount"],
                "views": item.get("statistics", {}).get("viewCount", 0),
            })
    except Exception:
        pass`,
  },
  {
    id: "line_oa",
    name: "LINE OA",
    emoji: "💬",
    method: "Webhook",
    tier: "free",
    description: "รับข้อความจาก LINE Official Account แบบ real-time ผ่าน Webhook",
    howItWorks: "LINE Messaging API ส่งข้อความที่ user ส่งมายัง OA ไปยัง Webhook URL ของเรา real-time ไม่ต้อง polling เลย เมื่อมีคนส่งข้อความเข้า OA ระบบจะได้รับทันที เหมาะมากสำหรับ Customer Service monitoring",
    credentials: [
      { key: "Channel Secret", desc: "จาก LINE Developers Console" },
      { key: "Channel Access Token", desc: "Long-lived token สำหรับ reply" },
    ],
    steps: [
      "ไปที่ developers.line.biz → สร้าง Provider + Messaging API Channel",
      "คัดลอก Channel Secret และ Issue Channel Access Token",
      "ใน Messaging API settings → ตั้ง Webhook URL เป็น: https://your-backend.onrender.com/api/webhook/line",
      "เปิด 'Use webhook' toggle",
      "ทดสอบด้วยการส่งข้อความไปที่ OA — ดูใน Live Mentions ทันที",
    ],
    apiDocsUrl: "https://developers.line.biz/en/docs/messaging-api/",
    tools: ["ใช้ได้เลย — ระบบมี webhook endpoint รองรับอยู่แล้ว"],
    webhookExample: `# backend/routers/webhook.py มี endpoint นี้อยู่แล้ว
# ตั้ง Webhook URL ใน LINE Developers Console เป็น:
# https://your-backend.onrender.com/api/webhook/line

# ข้อความจะถูกบันทึกเข้า database อัตโนมัติ
# พร้อม AI sentiment analysis และ keyword matching`,
  },
  {
    id: "instagram",
    name: "Instagram",
    emoji: "📸",
    method: "API",
    tier: "free-limited",
    description: "ดึงโพสต์และ comment จาก Business Account ผ่าน Instagram Graph API",
    howItWorks: "Instagram Graph API ใช้ token เดียวกับ Facebook API สามารถดึงข้อมูลได้เฉพาะ Business/Creator Account ที่เราเป็นเจ้าของเท่านั้น ไม่สามารถดึงข้อมูล Personal Account หรือค้นหา hashtag แบบ public ได้ (ถูกปิดไปแล้ว)",
    credentials: [
      { key: "Instagram Business Account ID", desc: "เชื่อมกับ Facebook Page" },
      { key: "Page Access Token", desc: "Token เดียวกับ Facebook (ต้องมี instagram_basic permission)" },
    ],
    steps: [
      "เชื่อม Instagram Business Account กับ Facebook Page",
      "ใช้ Facebook App เดิม → เพิ่ม permission: instagram_basic, instagram_content_publish",
      "หา Instagram Business Account ID: GET /me/accounts แล้วดู instagram_business_account",
      "ดึงโพสต์: GET /{ig-user-id}/media?fields=caption,like_count,comments_count,timestamp",
      "ส่งผลลัพธ์ไปยัง POST /api/webhook/mention",
    ],
    apiDocsUrl: "https://developers.facebook.com/docs/instagram-api",
    tools: ["n8n", "Make.com", "Python requests"],
  },
  {
    id: "pantip",
    name: "Pantip",
    emoji: "🟣",
    method: "Scraping",
    tier: "free",
    description: "ดึงกระทู้และคอมเมนต์ที่กล่าวถึง keyword จาก Pantip.com ด้วย web scraping",
    howItWorks: "Pantip ไม่มี public API ต้องใช้ web scraping ด้วย Python (BeautifulSoup หรือ Playwright) ค้นหากระทู้จาก search endpoint แล้วดึง title, content, และ replies ข้อระวัง: Pantip มี rate limiting และ bot detection ต้องใช้ delay ระหว่าง request",
    credentials: [
      { key: "ไม่ต้อง", desc: "ข้อมูลเป็น public — scrape ได้เลย" },
    ],
    steps: [
      "ติดตั้ง: pip install requests beautifulsoup4 playwright",
      "ค้นหา URL: https://pantip.com/search?q=N8+poker&type=topic",
      "Parse HTML ดึง title, author, content, likes, comments",
      "ใส่ delay 1-3 วินาทีระหว่าง request เพื่อหลีกเลี่ยง ban",
      "รัน script ด้วย cron job ทุก 30 นาที - 1 ชั่วโมง",
      "ส่งผลลัพธ์ไปยัง POST /api/webhook/mention",
    ],
    tools: ["BeautifulSoup4", "Playwright", "Selenium", "n8n (HTTP Request node)"],
    webhookExample: `# Python — Pantip scraper
import requests, time
from bs4 import BeautifulSoup

API_URL = "https://your-backend.onrender.com/api/webhook/mention"
HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; SocialEye/1.0)"}

def scrape_pantip(keyword: str):
    url = f"https://pantip.com/search?q={keyword}&type=topic"
    r = requests.get(url, headers=HEADERS)
    soup = BeautifulSoup(r.text, "html.parser")
    for topic in soup.select(".pt-list-item"):
        title = topic.select_one(".pt-list-item__title")
        author = topic.select_one(".pt-list-item__author-name")
        link = topic.select_one("a")
        if title and link:
            requests.post(API_URL, json={
                "channel": "pantip",
                "author": author.text.strip() if author else "Unknown",
                "content": title.text.strip(),
                "url": "https://pantip.com" + link["href"],
            })
        time.sleep(1.5)

scrape_pantip("N8 poker")`,
  },
  {
    id: "tiktok",
    name: "TikTok",
    emoji: "🎵",
    method: "API",
    tier: "free-limited",
    description: "ดึง video ที่กล่าวถึง keyword ผ่าน TikTok Research API (ต้องขอ access)",
    howItWorks: "TikTok Research API เปิดสำหรับนักวิจัยและองค์กรที่ผ่านการ verify แล้วเท่านั้น ต้องสมัครและรอ approval จาก TikTok (~2-4 สัปดาห์) ทางเลือกคือใช้ TikTok Display API (สำหรับข้อมูล user เอง) หรือ scraping ผ่าน Playwright",
    credentials: [
      { key: "Client Key", desc: "จาก TikTok Developer Portal (ต้องผ่าน review)" },
      { key: "Client Secret", desc: "จาก TikTok Developer Portal" },
    ],
    steps: [
      "สมัครที่ developers.tiktok.com → เลือก Research API",
      "กรอก use case และวัตถุประสงค์ รอ approval 2-4 สัปดาห์",
      "หลัง approve: ใช้ POST /research/video/query/ ค้นหา video ด้วย hashtag/keyword",
      "ทางเลือก (ไม่ต้อง API): ใช้ Playwright scrape TikTok โดยตรง",
      "ส่งผลลัพธ์ไปยัง POST /api/webhook/mention",
    ],
    apiDocsUrl: "https://developers.tiktok.com/doc/research-api-overview",
    tools: ["TikTok Research API", "Playwright (scraping)", "Apify TikTok Scraper"],
  },
  {
    id: "news",
    name: "Online News",
    emoji: "📰",
    method: "RSS",
    tier: "free",
    description: "ติดตามข่าวจากสื่อออนไลน์ผ่าน RSS Feed หรือ Google News RSS",
    howItWorks: "สำนักข่าวส่วนใหญ่มี RSS Feed ให้ subscribe ได้ฟรี Google News ยังมี RSS endpoint ที่ค้นหาตาม keyword ได้ เป็นวิธีที่เร็วและฟรีที่สุดสำหรับ monitor ข่าว",
    credentials: [
      { key: "ไม่ต้อง", desc: "RSS Feed เป็น public — ไม่ต้อง key" },
    ],
    steps: [
      "ใช้ Google News RSS: https://news.google.com/rss/search?q=N8+poker+thailand&hl=th&gl=TH",
      "หรือ subscribe RSS ของสำนักข่าวโดยตรง: Manager, Sanook News, Kapook",
      "Parse RSS ด้วย Python feedparser library",
      "กรอง article ที่มี keyword ที่ต้องการ",
      "ส่งผลลัพธ์ไปยัง POST /api/webhook/mention ทุก 15-30 นาที",
    ],
    tools: ["feedparser (Python)", "n8n RSS node", "Make.com RSS module"],
    webhookExample: `# Python — RSS News Monitor
import feedparser, requests, hashlib

API_URL = "https://your-backend.onrender.com/api/webhook/mention"
SEEN = set()

RSS_FEEDS = [
    "https://news.google.com/rss/search?q=N8+poker+thailand&hl=th&gl=TH",
    "https://news.google.com/rss/search?q=Natural8+poker&hl=th&gl=TH",
]

def check_feeds():
    for feed_url in RSS_FEEDS:
        feed = feedparser.parse(feed_url)
        for entry in feed.entries:
            uid = hashlib.md5(entry.link.encode()).hexdigest()
            if uid in SEEN:
                continue
            SEEN.add(uid)
            requests.post(API_URL, json={
                "channel": "news",
                "author": entry.get("source", {}).get("title", "News"),
                "content": entry.title + " — " + entry.get("summary", ""),
                "url": entry.link,
            })

check_feeds()`,
  },
  {
    id: "webboard",
    name: "Webboard",
    emoji: "💻",
    method: "Scraping",
    tier: "free",
    description: "ดึงข้อความจาก forum และ webboard ต่างๆ ด้วย web scraping",
    howItWorks: "Webboard ทั่วไปไม่มี API ต้องใช้ scraping โดย target site ที่เกี่ยวข้องกับ brand เช่น forum ของ poker community, gambling board, หรือ review site ต่างๆ",
    credentials: [
      { key: "ไม่ต้อง (public)", desc: "สำหรับ webboard ที่เป็น public" },
      { key: "Username/Password", desc: "สำหรับ webboard ที่ต้อง login" },
    ],
    steps: [
      "ระบุ webboard ที่ต้องการ monitor (เช่น forum.pokerthai.net)",
      "ดู URL pattern ของ search: ?q=keyword หรือ /search/keyword",
      "ใช้ Playwright หรือ Selenium สำหรับ site ที่ต้อง JavaScript",
      "ใช้ requests + BeautifulSoup สำหรับ static HTML",
      "รัน scraper ทุก 1-2 ชั่วโมง และส่งผลลัพธ์เข้าระบบ",
    ],
    tools: ["Playwright", "Selenium", "BeautifulSoup4", "Apify"],
  },
];

/* ---------- helper components ---------- */
const METHOD_COLOR: Record<Method, string> = {
  API:      "bg-blue-100 text-blue-800 border-blue-200",
  Webhook:  "bg-green-100 text-green-800 border-green-200",
  RSS:      "bg-orange-100 text-orange-800 border-orange-200",
  Scraping: "bg-purple-100 text-purple-800 border-purple-200",
};
const TIER_LABEL: Record<Tier, { label: string; cls: string }> = {
  free:          { label: "ฟรี",              cls: "bg-green-100 text-green-800" },
  "free-limited":{ label: "ฟรี (จำกัด)",      cls: "bg-yellow-100 text-yellow-800" },
  paid:          { label: "มีค่าใช้จ่าย",     cls: "bg-red-100 text-red-800" },
};

function ChannelCard({ ch }: { ch: Channel }) {
  const [open, setOpen] = useState(false);
  const tier = TIER_LABEL[ch.tier];

  return (
    <div className="bg-white rounded-xl border-2 border-gray-200 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">{ch.emoji}</span>
          <div className="text-left">
            <div className="flex items-center gap-2">
              <span className="font-bold text-gray-900 text-base">{ch.name}</span>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${METHOD_COLOR[ch.method]}`}>
                {ch.method}
              </span>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${tier.cls}`}>
                {tier.label}
              </span>
            </div>
            <p className="text-sm text-gray-600 mt-0.5 font-medium">{ch.description}</p>
          </div>
        </div>
        {open ? <ChevronUp size={18} className="text-gray-400 shrink-0" /> : <ChevronDown size={18} className="text-gray-400 shrink-0" />}
      </button>

      {open && (
        <div className="border-t-2 border-gray-100 px-5 py-5 space-y-5">
          {/* How it works */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="text-sm font-bold text-blue-900 mb-1 flex items-center gap-1.5">
              <Zap size={13} /> หลักการทำงาน
            </h4>
            <p className="text-sm text-blue-800 leading-relaxed">{ch.howItWorks}</p>
          </div>

          {/* Credentials */}
          <div>
            <h4 className="text-sm font-bold text-gray-800 mb-2 flex items-center gap-1.5">
              <Key size={13} /> Credentials ที่ต้องการ
            </h4>
            <div className="space-y-1.5">
              {ch.credentials.map((c) => (
                <div key={c.key} className="flex items-start gap-2 text-sm">
                  <span className="font-bold text-gray-700 min-w-[160px] shrink-0 bg-gray-100 px-2 py-0.5 rounded text-xs">
                    {c.key}
                  </span>
                  <span className="text-gray-600">{c.desc}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Steps */}
          <div>
            <h4 className="text-sm font-bold text-gray-800 mb-2 flex items-center gap-1.5">
              <CheckCircle size={13} className="text-green-600" /> ขั้นตอน Setup
            </h4>
            <ol className="space-y-1.5">
              {ch.steps.map((step, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                  <span className="w-5 h-5 bg-blue-600 text-white rounded-full text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </div>

          {/* Tools */}
          {ch.tools && (
            <div>
              <h4 className="text-sm font-bold text-gray-800 mb-2 flex items-center gap-1.5">
                <Database size={13} /> เครื่องมือที่แนะนำ
              </h4>
              <div className="flex flex-wrap gap-2">
                {ch.tools.map((t) => (
                  <span key={t} className="text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-200 px-2.5 py-1 rounded-lg">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Code example */}
          {ch.webhookExample && (
            <div>
              <h4 className="text-sm font-bold text-gray-800 mb-2 flex items-center gap-1.5">
                <Code size={13} /> ตัวอย่าง Code
              </h4>
              <pre className="bg-gray-900 text-green-400 text-xs p-4 rounded-lg overflow-x-auto leading-relaxed font-mono whitespace-pre-wrap">
                {ch.webhookExample}
              </pre>
            </div>
          )}

          {/* API Docs link */}
          {ch.apiDocsUrl && (
            <a
              href={ch.apiDocsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-bold text-blue-600 hover:text-blue-800 hover:underline"
            >
              <ExternalLink size={13} /> Official API Documentation
            </a>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------- main page ---------- */
export default function IntegrationsPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Plug size={22} className="text-blue-600" /> Integration Guide
        </h1>
        <p className="text-sm font-medium text-gray-600 mt-0.5">
          วิธีการเชื่อมต่อและเก็บข้อมูลจากแต่ละช่องทาง
        </p>
      </div>

      {/* Architecture Overview */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl p-6">
        <h2 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Globe size={16} className="text-blue-600" /> ภาพรวมการทำงานของระบบ
        </h2>
        <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
          <div className="flex flex-col items-center gap-1">
            <div className="bg-white border-2 border-blue-300 rounded-lg px-4 py-2 text-blue-800 text-center">
              <div className="text-xs text-gray-500 mb-0.5">แหล่งข้อมูล</div>
              📘📸🐦▶️💬🟣📰
            </div>
          </div>
          <ArrowRight size={16} className="text-gray-400" />
          <div className="bg-white border-2 border-purple-300 rounded-lg px-4 py-2 text-purple-800 text-center">
            <div className="text-xs text-gray-500 mb-0.5">Collector</div>
            Python / n8n / Make
          </div>
          <ArrowRight size={16} className="text-gray-400" />
          <div className="bg-white border-2 border-green-300 rounded-lg px-4 py-2 text-green-800 text-center">
            <div className="text-xs text-gray-500 mb-0.5">Backend API</div>
            POST /api/webhook/mention
          </div>
          <ArrowRight size={16} className="text-gray-400" />
          <div className="bg-white border-2 border-yellow-300 rounded-lg px-4 py-2 text-yellow-800 text-center">
            <div className="text-xs text-gray-500 mb-0.5">AI Analysis</div>
            Sentiment + Keywords
          </div>
          <ArrowRight size={16} className="text-gray-400" />
          <div className="bg-blue-600 text-white rounded-lg px-4 py-2 text-center">
            <div className="text-xs text-blue-200 mb-0.5">Dashboard</div>
            SocialEye Monitor
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
          <div className="bg-white/70 rounded-lg p-3 border border-blue-200">
            <div className="font-bold text-blue-800 flex items-center gap-1.5 mb-1">
              <Webhook size={13} /> Push (Webhook)
            </div>
            <p className="text-gray-700 text-xs">Platform ส่งข้อมูลมาให้เราเอง real-time เช่น LINE OA Webhook ไม่ต้อง polling</p>
          </div>
          <div className="bg-white/70 rounded-lg p-3 border border-purple-200">
            <div className="font-bold text-purple-800 flex items-center gap-1.5 mb-1">
              <RefreshCw size={13} /> Pull (API Polling)
            </div>
            <p className="text-gray-700 text-xs">ระบบเราเรียกดึงข้อมูลจาก Platform API เป็นระยะ เช่น ทุก 30 นาที ใช้กับ Facebook, YouTube</p>
          </div>
          <div className="bg-white/70 rounded-lg p-3 border border-green-200">
            <div className="font-bold text-green-800 flex items-center gap-1.5 mb-1">
              <Code size={13} /> Webhook Endpoint
            </div>
            <p className="text-gray-700 text-xs font-mono break-all">POST /api/webhook/mention รับ JSON แล้ว process เข้า database อัตโนมัติ</p>
          </div>
        </div>
      </div>

      {/* Webhook payload spec */}
      <div className="bg-gray-900 rounded-xl p-5">
        <h3 className="text-sm font-bold text-gray-300 mb-3 flex items-center gap-2">
          <Code size={14} /> Webhook Payload Format — POST /api/webhook/mention
        </h3>
        <pre className="text-green-400 text-xs font-mono leading-relaxed overflow-x-auto">{`{
  "channel":  "facebook",          // ชื่อ channel (required)
  "author":   "ชื่อผู้โพสต์",       // required
  "content":  "ข้อความ",           // required
  "url":      "https://...",        // link ต้นทาง (optional)
  "likes":    123,                  // จำนวน likes (optional)
  "comments": 45,                   // จำนวน comments (optional)
  "shares":   12,                   // จำนวน shares (optional)
  "views":    5000,                 // จำนวน views (optional)
}`}</pre>
        <div className="mt-3 flex items-center gap-2">
          <AlertCircle size={13} className="text-yellow-400 shrink-0" />
          <p className="text-xs text-yellow-300">ระบบจะทำ AI Sentiment Analysis และ Keyword Matching อัตโนมัติหลังรับข้อมูล</p>
        </div>
      </div>

      {/* Method legend */}
      <div className="flex flex-wrap gap-3">
        {(Object.entries(METHOD_COLOR) as [Method, string][]).map(([m, cls]) => (
          <span key={m} className={`text-xs font-bold px-3 py-1.5 rounded-full border ${cls}`}>
            {m === "API" && "🔌"} {m === "Webhook" && "⚡"} {m === "RSS" && "📡"} {m === "Scraping" && "🕷️"} {m}
          </span>
        ))}
        <span className="text-xs text-gray-500 font-medium self-center">— กด channel เพื่อดูรายละเอียด setup</span>
      </div>

      {/* Channel cards */}
      <div className="space-y-3">
        {CHANNELS.map((ch) => (
          <ChannelCard key={ch.id} ch={ch} />
        ))}
      </div>

      {/* Automation tools */}
      <div className="bg-white rounded-xl border-2 border-gray-200 p-5">
        <h2 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Zap size={16} className="text-yellow-500" /> เครื่องมือ Automation แนะนำ (ไม่ต้องเขียน code)
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              name: "n8n", emoji: "🔄", tier: "ฟรี / Self-host",
              desc: "Workflow automation แบบ visual ทำได้ทุกอย่าง มี node สำเร็จรูปสำหรับ Facebook, YouTube, RSS, HTTP Request",
              url: "https://n8n.io",
            },
            {
              name: "Make.com", emoji: "⚙️", tier: "มี Free tier",
              desc: "คล้าย Zapier แต่ทำได้ซับซ้อนกว่า รองรับ Facebook, YouTube, LINE, RSS และ HTTP Webhook",
              url: "https://make.com",
            },
            {
              name: "Apify", emoji: "🕷️", tier: "มี Free tier",
              desc: "Platform สำหรับ web scraping โดยเฉพาะ มี pre-built scraper สำหรับ TikTok, Pantip, Instagram ที่ไม่มี API",
              url: "https://apify.com",
            },
          ].map((tool) => (
            <a
              key={tool.name}
              href={tool.url}
              target="_blank"
              rel="noopener noreferrer"
              className="border-2 border-gray-200 rounded-xl p-4 hover:border-blue-300 hover:bg-blue-50 transition-colors block"
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">{tool.emoji}</span>
                <span className="font-bold text-gray-900">{tool.name}</span>
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-semibold">{tool.tier}</span>
              </div>
              <p className="text-sm text-gray-600">{tool.desc}</p>
              <div className="flex items-center gap-1 mt-2 text-xs font-bold text-blue-600">
                <ExternalLink size={11} /> เปิดเว็บไซต์
              </div>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
