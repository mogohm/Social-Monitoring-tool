"use client";
import { useEffect, useState } from "react";
import { X, ExternalLink, ThumbsUp, MessageCircle, Share2, Eye, Tag, Zap, Brain, Clock, Hash } from "lucide-react";
import { api } from "@/lib/api";
import type { MentionData } from "./MentionCard";

const channelStyle: Record<string, string> = {
  facebook: "bg-blue-700", twitter: "bg-sky-500", tiktok: "bg-gray-900",
  youtube: "bg-red-600", instagram: "bg-purple-600", line_oa: "bg-green-600",
  news: "bg-slate-600", pantip: "bg-orange-500", webboard: "bg-teal-600", other: "bg-gray-500",
};
const sentimentColor: Record<string, string> = {
  positive: "text-green-700 bg-green-100 border-green-200",
  neutral:  "text-gray-700 bg-gray-100 border-gray-200",
  negative: "text-red-700 bg-red-100 border-red-200",
};
const catChipStyle: Record<string, string> = {
  brand: "bg-blue-50 text-blue-700 border-blue-200",
  product: "bg-purple-50 text-purple-700 border-purple-200",
  competitor: "bg-orange-50 text-orange-700 border-orange-200",
  crisis: "bg-red-50 text-red-700 border-red-200",
  campaign: "bg-green-50 text-green-700 border-green-200",
  general: "bg-gray-50 text-gray-700 border-gray-200",
};

function highlightKeywords(text: string, tags: MentionData["tags"]): React.ReactNode {
  if (!tags?.length) return text;
  const words = tags.map((t) => t.word).sort((a, b) => b.length - a.length);
  const pattern = new RegExp(`(${words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
  const parts = text.split(pattern);
  return parts.map((part, i) => {
    const tag = tags.find((t) => t.word.toLowerCase() === part.toLowerCase());
    if (!tag) return part;
    return (
      <mark key={i} className={`px-1 rounded-md font-bold not-italic ${tag.is_negative ? "bg-red-200 text-red-900" : "bg-yellow-200 text-yellow-900"}`}>
        {part}
      </mark>
    );
  });
}

interface Props {
  mentionId: number | null;
  onClose: () => void;
}

export default function MentionDetail({ mentionId, onClose }: Props) {
  const [data, setData] = useState<MentionData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!mentionId) { setData(null); return; }
    setLoading(true);
    api.get(`/api/mentions/${mentionId}`)
      .then((r) => setData(r.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [mentionId]);

  // close on ESC
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // Filter to valid keyword tags only — exclude metadata objects like {image_urls:[...]}
  const tags: MentionData["tags"] = Array.isArray(data?.tags)
    ? (data!.tags as any[]).filter((t) => typeof t?.word === "string")
    : [];

  return (
    <>
      {/* Backdrop */}
      {mentionId && (
        <div className="fixed inset-0 bg-black/40 z-40 transition-opacity" onClick={onClose} />
      )}

      {/* Slide-over panel */}
      <div className={`fixed top-0 right-0 h-full w-full max-w-2xl bg-white z-50 shadow-2xl flex flex-col transition-transform duration-300 ${mentionId ? "translate-x-0" : "translate-x-full"}`}>
        {/* Panel header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h2 className="text-base font-extrabold text-gray-900">รายละเอียด Mention</h2>
          <div className="flex items-center gap-2">
            {data?.url && (
              <a href={data.url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg transition-colors">
                <ExternalLink size={13} /> เปิดต้นทาง
              </a>
            )}
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-200 text-gray-600 transition-colors">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {loading && (
            <div className="flex items-center justify-center py-20 text-gray-500 font-semibold">กำลังโหลด...</div>
          )}
          {!loading && !data && mentionId && (
            <div className="text-center py-20 text-gray-500 font-semibold">ไม่พบข้อมูล</div>
          )}
          {!loading && data && (
            <>
              {/* Source info */}
              <div className="flex items-start gap-4">
                <span className={`w-12 h-12 rounded-xl flex items-center justify-center text-white text-xs font-extrabold shrink-0 ${channelStyle[data.channel] || "bg-gray-500"}`}>
                  {data.channel.substring(0, 2).toUpperCase()}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-base font-extrabold text-gray-900">{data.author || "Anonymous"}</span>
                    <span className={`text-xs font-bold px-2.5 py-0.5 rounded-md border ${sentimentColor[data.sentiment] || sentimentColor.neutral}`}>
                      {data.sentiment}
                    </span>
                    <span className="text-xs font-bold bg-gray-100 text-gray-700 px-2.5 py-0.5 rounded-md capitalize">{data.channel}</span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1 text-xs font-semibold text-gray-500">
                    <Clock size={11} />
                    {data.published_at
                      ? new Date(data.published_at).toLocaleString("th-TH", { dateStyle: "long", timeStyle: "short" })
                      : new Date(data.created_at).toLocaleString("th-TH", { dateStyle: "long", timeStyle: "short" })}
                  </div>
                </div>
              </div>

              {/* Original URL */}
              {data.url && (
                <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-1.5">
                    <ExternalLink size={14} className="text-blue-600 shrink-0" />
                    <span className="text-xs font-extrabold text-blue-800 uppercase tracking-wide">ลิ้งต้นทาง</span>
                  </div>
                  <a href={data.url} target="_blank" rel="noopener noreferrer"
                    className="text-sm font-semibold text-blue-700 hover:text-blue-900 break-all hover:underline">
                    {data.url}
                  </a>
                </div>
              )}

              {/* Full content */}
              <div>
                <h3 className="text-xs font-extrabold text-gray-600 uppercase tracking-wide mb-2">ข้อความ</h3>
                <div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-4 text-sm font-medium text-gray-900 leading-relaxed whitespace-pre-wrap">
                  {highlightKeywords(data.content, tags)}
                </div>
              </div>

              {/* Matched keywords */}
              {tags.length > 0 && (
                <div>
                  <h3 className="text-xs font-extrabold text-gray-600 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <Tag size={12} /> Keywords ที่ตรงกัน
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {tags.map((t, i) => (
                      <div key={i} className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg font-bold border ${catChipStyle[t.category] || catChipStyle.general}`}>
                        <Hash size={12} />
                        {t.word}
                        <span className="text-xs font-semibold opacity-70">({t.category})</span>
                        {t.is_negative && <span className="text-red-500 font-extrabold">⚠</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* AI Analysis */}
              <div>
                <h3 className="text-xs font-extrabold text-gray-600 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                  <Brain size={12} /> AI Analysis
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "Sentiment",  value: data.sentiment,        color: data.sentiment === "negative" ? "text-red-700" : data.sentiment === "positive" ? "text-green-700" : "text-gray-700" },
                    { label: "Emotion",    value: data.emotion || "—",   color: "text-gray-900" },
                    { label: "Intent",     value: data.intent || "—",    color: "text-gray-900" },
                    { label: "Topic",      value: data.topic || "—",     color: "text-gray-900" },
                    { label: "Priority",   value: data.priority,         color: data.priority === "critical" ? "text-red-700" : data.priority === "high" ? "text-orange-700" : "text-gray-900" },
                    { label: "Suggested Action", value: data.suggested_action || "—", color: "text-gray-900" },
                  ].map((item) => (
                    <div key={item.label} className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
                      <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-0.5">{item.label}</div>
                      <div className={`text-sm font-extrabold capitalize ${item.color}`}>{item.value}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Risk score */}
              <div>
                <h3 className="text-xs font-extrabold text-gray-600 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <Zap size={12} /> Risk Score
                </h3>
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-2xl font-extrabold ${(data.risk_score || 0) >= 60 ? "text-red-600" : (data.risk_score || 0) >= 30 ? "text-orange-600" : "text-green-600"}`}>
                      {data.risk_score?.toFixed(0) ?? 0}
                    </span>
                    <span className="text-sm font-bold text-gray-500">/ 100</span>
                  </div>
                  <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${(data.risk_score || 0) >= 60 ? "bg-red-500" : (data.risk_score || 0) >= 30 ? "bg-orange-500" : "bg-green-500"}`}
                      style={{ width: `${data.risk_score || 0}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* AI summary */}
              {data.ai_summary && (
                <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
                  <div className="text-xs font-extrabold text-blue-700 uppercase tracking-wide mb-1.5">AI Summary</div>
                  <p className="text-sm font-semibold text-blue-900">{data.ai_summary}</p>
                </div>
              )}

              {/* Engagement stats */}
              <div>
                <h3 className="text-xs font-extrabold text-gray-600 uppercase tracking-wide mb-3">Engagement</h3>
                <div className="grid grid-cols-4 gap-3">
                  {[
                    { icon: ThumbsUp,       label: "Likes",    value: data.likes    },
                    { icon: MessageCircle,  label: "Comments", value: data.comments },
                    { icon: Share2,         label: "Shares",   value: data.shares   },
                    { icon: Eye,            label: "Views",    value: data.views    },
                  ].map(({ icon: Icon, label, value }) => (
                    <div key={label} className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-3 text-center">
                      <Icon size={16} className="mx-auto mb-1 text-gray-500" />
                      <div className="text-base font-extrabold text-gray-900">{value.toLocaleString()}</div>
                      <div className="text-xs font-semibold text-gray-500">{label}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Mention ID */}
              <div className="text-xs font-semibold text-gray-400 border-t border-gray-100 pt-4">
                Mention ID: #{data.id} · Collected: {new Date(data.created_at).toLocaleString("th-TH")}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
