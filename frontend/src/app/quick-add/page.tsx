"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  Send, CheckCircle2, AlertCircle, Link2, FileText,
  User, ThumbsUp, MessageSquare, Share2, Bookmark,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const CHANNELS = [
  { id: "facebook",  label: "Facebook",    color: "#1877F2", bg: "#EBF3FF" },
  { id: "instagram", label: "Instagram",   color: "#E1306C", bg: "#FEE7F0" },
  { id: "tiktok",    label: "TikTok",      color: "#010101", bg: "#F0F0F0" },
  { id: "twitter",   label: "X / Twitter", color: "#1DA1F2", bg: "#E8F5FE" },
  { id: "youtube",   label: "YouTube",     color: "#FF0000", bg: "#FFEEEE" },
  { id: "pantip",    label: "Pantip",      color: "#6B21A8", bg: "#F5F0FF" },
  { id: "line_oa",   label: "LINE OA",     color: "#06C755", bg: "#EDFBF1" },
  { id: "news",      label: "News",        color: "#0F172A", bg: "#F1F5F9" },
  { id: "webboard",  label: "Webboard",    color: "#7C3AED", bg: "#F5F3FF" },
];

// Bookmarklet code — opens Quick Add popup with selected text + current URL
const BOOKMARKLET = `javascript:(function(){var s=window.getSelection?window.getSelection().toString():'';var p='url='+encodeURIComponent(location.href);if(s)p+='&content='+encodeURIComponent(s.substring(0,3000));window.open('https://social-monitoring-tool.vercel.app/quick-add?'+p,'socialeye','width=700,height=820,resizable=yes,scrollbars=yes');})();`;

function QuickAddForm() {
  const searchParams = useSearchParams();

  const [channel, setChannel]   = useState("facebook");
  const [url, setUrl]           = useState("");
  const [content, setContent]   = useState("");
  const [author, setAuthor]     = useState("");
  const [likes, setLikes]       = useState("");
  const [comments, setComments] = useState("");
  const [shares, setShares]     = useState("");
  const [status, setStatus]     = useState<"idle" | "loading" | "success" | "error">("idle");
  const [result, setResult]     = useState<{id?: number; keywords?: number} | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [showBookmarklet, setShowBookmarklet] = useState(false);

  // Pre-fill from bookmarklet query params
  useEffect(() => {
    const u = searchParams.get("url");
    const c = searchParams.get("content");
    if (u) setUrl(u);
    if (c) setContent(c);
  }, [searchParams]);

  const selectedCh = CHANNELS.find((c) => c.id === channel) || CHANNELS[0];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    setStatus("loading");
    setResult(null);
    setErrorMsg("");

    try {
      const res = await fetch(`${API_URL}/api/webhook/mention`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel,
          author: author.trim() || "Manual Entry",
          content: content.trim(),
          url: url.trim() || undefined,
          likes: parseInt(likes) || 0,
          comments: parseInt(comments) || 0,
          shares: parseInt(shares) || 0,
        }),
      });

      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const data = await res.json();
      setResult({ id: data.id, keywords: data.keywords_matched });
      setStatus("success");

      setTimeout(() => {
        setContent(""); setUrl(""); setAuthor("");
        setLikes(""); setComments(""); setShares("");
        setStatus("idle");
      }, 3500);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Connection failed");
      setStatus("error");
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quick Add</h1>
          <p className="text-sm font-medium text-gray-500 mt-0.5">เพิ่ม post จาก Facebook Group เข้า SocialEye</p>
        </div>
        <button
          onClick={() => setShowBookmarklet(!showBookmarklet)}
          className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl border-2 transition-colors ${showBookmarklet ? "bg-amber-50 border-amber-300 text-amber-700" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}
        >
          <Bookmark size={13} />
          Bookmarklet
        </button>
      </div>

      {/* Bookmarklet setup panel */}
      {showBookmarklet && (
        <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-5 space-y-4">
          <div>
            <h2 className="text-sm font-extrabold text-amber-900 mb-1">ติดตั้ง Bookmarklet สำหรับ Facebook Group ปิด</h2>
            <p className="text-xs font-semibold text-amber-700 leading-relaxed">
              ลาก button นี้ไปวางในแถบ Bookmarks ของ browser
              → เวลาเห็น post ใน Group ให้ <strong>select ข้อความ</strong> ก่อน แล้วคลิก bookmark
              → Quick Add จะเปิดขึ้นพร้อม URL และข้อความที่ select ไว้
            </p>
          </div>

          {/* Drag-to-bookmark button */}
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href={BOOKMARKLET}
              onClick={(e) => e.preventDefault()}
              draggable
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-sm font-extrabold rounded-xl shadow-sm cursor-grab active:cursor-grabbing select-none transition-colors"
              title="ลากไปที่แถบ Bookmarks"
            >
              <Bookmark size={14} />
              📌 SocialEye — Add Post
            </a>
            <span className="text-xs font-semibold text-amber-700">← ลากไปวางในแถบ Bookmarks</span>
          </div>

          {/* Manual steps */}
          <div className="bg-white rounded-xl border border-amber-200 p-4 space-y-2">
            <p className="text-xs font-extrabold text-amber-800 uppercase tracking-wide">วิธีใช้งาน</p>
            {[
              "เปิด Facebook Group ปิด (ต้องเป็น member หรือ admin)",
              "Select ข้อความของ post ที่ต้องการ monitor",
              "คลิก bookmark \'SocialEye — Add Post\'",
              "Quick Add เปิดขึ้นในหน้าต่างใหม่พร้อมข้อมูล",
              "กรอก author + engagement เพิ่มเติม แล้วกด Submit",
            ].map((step, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-800 text-xs font-extrabold flex items-center justify-center flex-shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <p className="text-xs font-semibold text-amber-800">{step}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tip when content is pre-filled */}
      {content && searchParams.get("content") && (
        <div className="bg-green-50 border-2 border-green-200 rounded-xl p-3 flex items-center gap-2">
          <CheckCircle2 size={15} className="text-green-600 flex-shrink-0" />
          <p className="text-xs font-bold text-green-700">ข้อความถูกเติมจาก Bookmarklet แล้ว — ตรวจสอบแล้วกด Submit</p>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">

        {/* Channel */}
        <div className="bg-white rounded-xl border-2 border-gray-200 p-5">
          <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-3">ช่องทาง</label>
          <div className="flex flex-wrap gap-2">
            {CHANNELS.map((ch) => (
              <button
                key={ch.id}
                type="button"
                onClick={() => setChannel(ch.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border-2 transition-all ${
                  channel === ch.id
                    ? "scale-105 shadow-sm"
                    : "border-gray-200 text-gray-600 hover:border-gray-300 bg-white"
                }`}
                style={channel === ch.id ? { backgroundColor: ch.bg, color: ch.color, borderColor: ch.color + "55" } : {}}
              >
                {ch.label}
              </button>
            ))}
          </div>
        </div>

        {/* URL */}
        <div className="bg-white rounded-xl border-2 border-gray-200 p-5">
          <label className="flex items-center gap-1.5 text-xs font-bold text-gray-600 uppercase tracking-wide mb-2">
            <Link2 size={12} /> URL ของ Post
          </label>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://facebook.com/groups/..."
            className="w-full border-2 border-gray-200 rounded-lg px-3.5 py-2.5 text-sm font-medium text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-400 transition-colors bg-gray-50 focus:bg-white"
          />
        </div>

        {/* Content */}
        <div className="bg-white rounded-xl border-2 border-gray-200 p-5">
          <label className="flex items-center gap-1.5 text-xs font-bold text-gray-600 uppercase tracking-wide mb-2">
            <FileText size={12} /> เนื้อหา Post / Comment <span className="text-red-500">*</span>
          </label>
          <textarea
            required
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="วางข้อความของ post ที่นี่… หรือ select text ใน Facebook แล้วคลิก Bookmarklet"
            rows={6}
            className="w-full border-2 border-gray-200 rounded-lg px-3.5 py-2.5 text-sm font-medium text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-400 transition-colors resize-none bg-gray-50 focus:bg-white leading-relaxed"
          />
          <p className="text-xs text-gray-400 mt-1.5 font-semibold">{content.length} ตัวอักษร</p>
        </div>

        {/* Author + Engagement */}
        <div className="bg-white rounded-xl border-2 border-gray-200 p-5 space-y-4">
          <div>
            <label className="flex items-center gap-1.5 text-xs font-bold text-gray-600 uppercase tracking-wide mb-2">
              <User size={12} /> ชื่อผู้โพสต์
            </label>
            <input
              type="text"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="ชื่อ Facebook (ไม่บังคับ)"
              className="w-full border-2 border-gray-200 rounded-lg px-3.5 py-2.5 text-sm font-medium text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-400 transition-colors bg-gray-50 focus:bg-white"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-2">Engagement</label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { icon: ThumbsUp, label: "Likes", val: likes, set: setLikes },
                { icon: MessageSquare, label: "Comments", val: comments, set: setComments },
                { icon: Share2, label: "Shares", val: shares, set: setShares },
              ].map(({ icon: Icon, label, val, set }) => (
                <div key={label}>
                  <label className="flex items-center gap-1 text-xs font-semibold text-gray-500 mb-1">
                    <Icon size={11} /> {label}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={val}
                    onChange={(e) => set(e.target.value)}
                    placeholder="0"
                    className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm font-bold text-gray-900 text-center placeholder-gray-300 focus:outline-none focus:border-blue-400 transition-colors bg-gray-50 focus:bg-white"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={status === "loading" || !content.trim()}
          className="w-full py-3.5 rounded-xl text-sm font-extrabold flex items-center justify-center gap-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-white shadow-sm hover:opacity-90 active:scale-[0.99]"
          style={{ backgroundColor: content.trim() && status !== "loading" ? selectedCh.color : "#9CA3AF" }}
        >
          {status === "loading" ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              กำลังส่งและวิเคราะห์…
            </>
          ) : (
            <>
              <Send size={15} />
              Add to SocialEye
            </>
          )}
        </button>
      </form>

      {/* Success */}
      {status === "success" && result && (
        <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4 flex items-start gap-3">
          <CheckCircle2 size={18} className="text-green-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-extrabold text-green-800">เพิ่มสำเร็จ!</p>
            <p className="text-xs font-semibold text-green-700 mt-0.5">
              Mention #{result.id} · พบ {result.keywords} keywords · วิเคราะห์ sentiment แล้ว
            </p>
            <p className="text-xs text-green-600 mt-1 font-semibold">ดูใน Live Mentions → ปรากฏแล้ว</p>
          </div>
        </div>
      )}

      {/* Error */}
      {status === "error" && (
        <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle size={18} className="text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-extrabold text-red-800">ส่งไม่สำเร็จ</p>
            <p className="text-xs font-semibold text-red-600 mt-0.5">{errorMsg}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function QuickAddPage() {
  return (
    <Suspense fallback={<div className="max-w-2xl mx-auto py-10 text-center text-sm text-gray-400">Loading…</div>}>
      <QuickAddForm />
    </Suspense>
  );
}
