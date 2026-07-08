"use client";

import { useState } from "react";
import {
  Send, CheckCircle2, AlertCircle, Link2, FileText,
  User, ThumbsUp, MessageSquare, Share2, ChevronDown,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const CHANNELS = [
  { id: "facebook",  label: "Facebook",   color: "#1877F2", bg: "#EBF3FF" },
  { id: "instagram", label: "Instagram",  color: "#E1306C", bg: "#FEE7F0" },
  { id: "tiktok",    label: "TikTok",     color: "#010101", bg: "#F0F0F0" },
  { id: "twitter",   label: "X / Twitter",color: "#1DA1F2", bg: "#E8F5FE" },
  { id: "youtube",   label: "YouTube",    color: "#FF0000", bg: "#FFEEEE" },
  { id: "pantip",    label: "Pantip",     color: "#6B21A8", bg: "#F5F0FF" },
  { id: "line_oa",   label: "LINE OA",    color: "#06C755", bg: "#EDFBF1" },
  { id: "news",      label: "News",       color: "#0F172A", bg: "#F1F5F9" },
  { id: "webboard",  label: "Webboard",   color: "#7C3AED", bg: "#F5F3FF" },
];

export default function QuickAddPage() {
  const [channel, setChannel] = useState("facebook");
  const [url, setUrl]         = useState("");
  const [content, setContent] = useState("");
  const [author, setAuthor]   = useState("");
  const [likes, setLikes]     = useState("");
  const [comments, setComments] = useState("");
  const [shares, setShares]   = useState("");
  const [status, setStatus]   = useState<"idle" | "loading" | "success" | "error">("idle");
  const [result, setResult]   = useState<{id?: number; keywords?: number} | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

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

      // reset form after 2s
      setTimeout(() => {
        setContent(""); setUrl(""); setAuthor("");
        setLikes(""); setComments(""); setShares("");
        setStatus("idle");
      }, 3000);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Connection failed");
      setStatus("error");
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Quick Add</h1>
        <p className="text-sm font-medium text-gray-500 mt-0.5">
          เพิ่ม post หรือ comment จาก Facebook Group เข้า SocialEye ด้วยมือ
        </p>
      </div>

      {/* How to use */}
      <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4 flex gap-3">
        <div className="text-blue-500 mt-0.5 flex-shrink-0">
          <FileText size={16} />
        </div>
        <div className="text-sm font-semibold text-blue-800 leading-relaxed">
          เห็น post น่าสนใจใน Facebook Group → copy ข้อความมาวางในช่อง Content
          → ใส่ URL ของ post → กด Add to SocialEye — ระบบจะวิเคราะห์ sentiment อัตโนมัติ
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">

        {/* Channel selector */}
        <div className="bg-white rounded-xl border-2 border-gray-200 p-5">
          <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-3">
            ช่องทาง
          </label>
          <div className="flex flex-wrap gap-2">
            {CHANNELS.map((ch) => (
              <button
                key={ch.id}
                type="button"
                onClick={() => setChannel(ch.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border-2 transition-all ${
                  channel === ch.id
                    ? "border-transparent scale-105 shadow-sm"
                    : "border-gray-200 text-gray-600 hover:border-gray-300 bg-white"
                }`}
                style={channel === ch.id ? {
                  backgroundColor: ch.bg,
                  color: ch.color,
                  borderColor: ch.color + "44",
                } : {}}
              >
                {ch.label}
              </button>
            ))}
          </div>
        </div>

        {/* URL */}
        <div className="bg-white rounded-xl border-2 border-gray-200 p-5">
          <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-2">
            <span className="flex items-center gap-1.5">
              <Link2 size={12} /> URL ของ Post (ไม่บังคับ)
            </span>
          </label>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://facebook.com/groups/..."
            className="w-full border-2 border-gray-200 rounded-lg px-3.5 py-2.5 text-sm font-medium text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-400 transition-colors bg-gray-50 focus:bg-white"
          />
        </div>

        {/* Content — main input */}
        <div className="bg-white rounded-xl border-2 border-gray-200 p-5">
          <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-2">
            <span className="flex items-center gap-1.5">
              <FileText size={12} /> เนื้อหา Post / Comment <span className="text-red-500">*</span>
            </span>
          </label>
          <textarea
            required
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="วาง text ของ post หรือ comment ที่ต้องการ monitor ไว้ที่นี่…"
            rows={6}
            className="w-full border-2 border-gray-200 rounded-lg px-3.5 py-2.5 text-sm font-medium text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-400 transition-colors resize-none bg-gray-50 focus:bg-white leading-relaxed"
          />
          <p className="text-xs text-gray-400 mt-1.5 font-semibold">
            {content.length} ตัวอักษร
          </p>
        </div>

        {/* Author + Engagement */}
        <div className="bg-white rounded-xl border-2 border-gray-200 p-5 space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-2">
              <span className="flex items-center gap-1.5">
                <User size={12} /> ชื่อผู้โพสต์ (ไม่บังคับ)
              </span>
            </label>
            <input
              type="text"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="เช่น สมชาย ใจดี"
              className="w-full border-2 border-gray-200 rounded-lg px-3.5 py-2.5 text-sm font-medium text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-400 transition-colors bg-gray-50 focus:bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-2">
              Engagement (ไม่บังคับ)
            </label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { icon: ThumbsUp,      label: "Likes",    val: likes,    set: setLikes },
                { icon: MessageSquare, label: "Comments", val: comments, set: setComments },
                { icon: Share2,        label: "Shares",   val: shares,   set: setShares },
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
          className={`w-full py-3.5 rounded-xl text-sm font-extrabold flex items-center justify-center gap-2 transition-all duration-200 ${
            status === "loading"
              ? "bg-blue-400 text-white cursor-wait"
              : !content.trim()
              ? "bg-gray-200 text-gray-400 cursor-not-allowed"
              : "bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white shadow-sm"
          }`}
          style={status === "idle" && content.trim() ? { backgroundColor: selectedCh.color } : {}}
        >
          {status === "loading" ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              กำลังส่ง...
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
        <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4 flex items-start gap-3 animate-in fade-in duration-300">
          <CheckCircle2 size={18} className="text-green-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-extrabold text-green-800">เพิ่มสำเร็จแล้ว!</p>
            <p className="text-xs font-semibold text-green-700 mt-0.5">
              Mention ID #{result.id} · พบ {result.keywords} keywords · ระบบกำลังวิเคราะห์ sentiment
            </p>
            <p className="text-xs font-semibold text-green-600 mt-1">
              ดูใน Live Mentions → จะปรากฏภายในไม่กี่วินาที
            </p>
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
            <p className="text-xs font-semibold text-red-500 mt-1">
              ตรวจสอบว่า backend รันอยู่ที่ {API_URL}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
