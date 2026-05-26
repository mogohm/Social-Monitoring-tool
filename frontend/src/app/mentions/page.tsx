"use client";
import { useEffect, useState, useCallback } from "react";
import { fetchMentions } from "@/lib/api";
import MentionCard from "@/components/MentionCard";
import { RefreshCw } from "lucide-react";

const CHANNELS  = ["", "facebook", "twitter", "tiktok", "youtube", "line_oa", "instagram", "pantip", "news"];
const SENTIMENTS = ["", "positive", "neutral", "negative"];
const PRIORITIES = ["", "low", "medium", "high", "critical"];

export default function MentionsPage() {
  const [mentions, setMentions] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading]   = useState(false);
  const [channel,   setChannel]   = useState("");
  const [sentiment, setSentiment] = useState("");
  const [priority,  setPriority]  = useState("");
  const [days, setDays] = useState(7);

  const load = useCallback(() => {
    setLoading(true);
    const params: Record<string, string | number> = { days, limit: 50 };
    if (channel)   params.channel   = channel;
    if (sentiment) params.sentiment = sentiment;
    if (priority)  params.priority  = priority;
    fetchMentions(params).then(setMentions).finally(() => setLoading(false));
  }, [channel, sentiment, priority, days]);

  useEffect(() => { load(); }, [load]);

  const selectClass = "text-sm font-semibold border-2 border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-800 focus:outline-none focus:border-blue-400";

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Live Mention Feed</h1>
          <p className="text-sm font-medium text-gray-600 mt-0.5">{mentions.length} mentions found</p>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 text-sm font-semibold text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors">
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      <div className="flex flex-wrap gap-3 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
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

      {loading ? (
        <div className="text-center py-20 text-gray-500 font-semibold text-base">Loading mentions...</div>
      ) : mentions.length === 0 ? (
        <div className="text-center py-20 text-gray-500 font-semibold text-base bg-white rounded-xl border border-gray-200">
          No mentions found. Try adding data via the API.
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {mentions.map((m) => <MentionCard key={m.id as number} mention={m as any} />)}
        </div>
      )}
    </div>
  );
}
