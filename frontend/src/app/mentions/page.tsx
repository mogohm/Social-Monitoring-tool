"use client";
import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { fetchMentions } from "@/lib/api";
import { api } from "@/lib/api";
import MentionCard, { type MentionData } from "@/components/MentionCard";
import MentionDetail from "@/components/MentionDetail";
import { RefreshCw, Tag } from "lucide-react";

const CHANNELS   = ["", "facebook", "twitter", "tiktok", "youtube", "line_oa", "instagram", "pantip", "news"];
const SENTIMENTS = ["", "positive", "neutral", "negative"];
const PRIORITIES = ["", "low", "medium", "high", "critical"];

interface Keyword { id: number; word: string; category: string; is_negative: boolean; }

export default function MentionsPage() {
  const searchParams = useSearchParams();
  const [mentions,  setMentions]  = useState<MentionData[]>([]);
  const [keywords,  setKeywords]  = useState<Keyword[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [channel,   setChannel]   = useState(searchParams.get("channel") ?? "");
  const [sentiment, setSentiment] = useState("");
  const [priority,  setPriority]  = useState("");
  const [keyword,   setKeyword]   = useState(searchParams.get("keyword") ?? "");
  const [days,      setDays]      = useState(7);
  const [detailId,  setDetailId]  = useState<number | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    const params: Record<string, string | number> = { days, limit: 50 };
    if (channel)   params.channel   = channel;
    if (sentiment) params.sentiment = sentiment;
    if (priority)  params.priority  = priority;
    if (keyword)   params.keyword   = keyword;
    fetchMentions(params).then((d) => setMentions(d)).finally(() => setLoading(false));
  }, [channel, sentiment, priority, keyword, days]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    api.get("/api/keywords?active_only=true").then((r) => setKeywords(r.data)).catch(() => {});
  }, []);

  const selectClass = "text-sm font-semibold border-2 border-gray-200 rounded-xl px-3 py-2 bg-white text-gray-800 focus:outline-none focus:border-blue-400";

  return (
    <>
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Live Mention Feed</h1>
            <p className="text-sm font-medium text-gray-600 mt-0.5">{mentions.length} mentions found</p>
          </div>
          <button onClick={load} className="flex items-center gap-1.5 text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl transition-colors">
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Refresh
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white border-2 border-gray-200 rounded-xl p-4 space-y-3">
          <div className="flex flex-wrap gap-3">
            <select className={selectClass} value={channel}   onChange={(e) => setChannel(e.target.value)}>
              {CHANNELS.map((c)  => <option key={c} value={c}>{c  || "All Channels"}</option>)}
            </select>
            <select className={selectClass} value={sentiment} onChange={(e) => setSentiment(e.target.value)}>
              {SENTIMENTS.map((s) => <option key={s} value={s}>{s || "All Sentiments"}</option>)}
            </select>
            <select className={selectClass} value={priority}  onChange={(e) => setPriority(e.target.value)}>
              {PRIORITIES.map((p) => <option key={p} value={p}>{p || "All Priorities"}</option>)}
            </select>
            <select className={selectClass} value={days} onChange={(e) => setDays(Number(e.target.value))}>
              <option value={1}>24 hours</option>
              <option value={7}>7 days</option>
              <option value={30}>30 days</option>
            </select>
          </div>

          {/* Keyword quick-filter chips */}
          {keywords.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="flex items-center gap-1 text-xs font-extrabold text-gray-600"><Tag size={11} />Filter by keyword:</span>
              <button
                onClick={() => setKeyword("")}
                className={`text-xs font-bold px-2.5 py-1 rounded-lg border transition-colors ${keyword === "" ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700 border-gray-200 hover:border-blue-300"}`}
              >
                ทั้งหมด
              </button>
              {keywords.map((kw) => (
                <button
                  key={kw.id}
                  onClick={() => setKeyword(kw.word === keyword ? "" : kw.word)}
                  className={`text-xs font-bold px-2.5 py-1 rounded-lg border transition-colors ${keyword === kw.word ? "bg-blue-600 text-white border-blue-600" : kw.is_negative ? "bg-red-50 text-red-700 border-red-200 hover:border-red-400" : "bg-gray-50 text-gray-700 border-gray-200 hover:border-blue-300"}`}
                >
                  #{kw.word}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Mention grid */}
        {loading ? (
          <div className="text-center py-20 text-gray-500 font-semibold">Loading mentions...</div>
        ) : mentions.length === 0 ? (
          <div className="text-center py-20 text-gray-500 font-semibold bg-white rounded-xl border-2 border-gray-200">
            No mentions found for the selected filters.
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {mentions.map((m) => (
              <MentionCard key={m.id} mention={m} onViewDetail={(m) => setDetailId(m.id)} />
            ))}
          </div>
        )}
      </div>

      {/* Detail panel */}
      <MentionDetail mentionId={detailId} onClose={() => setDetailId(null)} />
    </>
  );
}
