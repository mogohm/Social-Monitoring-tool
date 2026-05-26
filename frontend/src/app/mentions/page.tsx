"use client";
import { useEffect, useState, useCallback } from "react";
import { fetchMentions } from "@/lib/api";
import MentionCard from "@/components/MentionCard";
import { RefreshCw } from "lucide-react";

const CHANNELS = ["", "facebook", "twitter", "tiktok", "youtube", "line_oa", "instagram", "pantip", "news"];
const SENTIMENTS = ["", "positive", "neutral", "negative"];
const PRIORITIES = ["", "low", "medium", "high", "critical"];

export default function MentionsPage() {
  const [mentions, setMentions] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(false);
  const [channel, setChannel] = useState("");
  const [sentiment, setSentiment] = useState("");
  const [priority, setPriority] = useState("");
  const [days, setDays] = useState(7);

  const load = useCallback(() => {
    setLoading(true);
    const params: Record<string, string | number> = { days, limit: 50 };
    if (channel) params.channel = channel;
    if (sentiment) params.sentiment = sentiment;
    if (priority) params.priority = priority;
    fetchMentions(params)
      .then(setMentions)
      .finally(() => setLoading(false));
  }, [channel, sentiment, priority, days]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Live Mention Feed</h1>
        <button onClick={load} className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800">
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      <div className="flex flex-wrap gap-3">
        <select className="text-sm border rounded-lg px-3 py-1.5 bg-white" value={channel} onChange={(e) => setChannel(e.target.value)}>
          {CHANNELS.map((c) => <option key={c} value={c}>{c || "All Channels"}</option>)}
        </select>
        <select className="text-sm border rounded-lg px-3 py-1.5 bg-white" value={sentiment} onChange={(e) => setSentiment(e.target.value)}>
          {SENTIMENTS.map((s) => <option key={s} value={s}>{s || "All Sentiments"}</option>)}
        </select>
        <select className="text-sm border rounded-lg px-3 py-1.5 bg-white" value={priority} onChange={(e) => setPriority(e.target.value)}>
          {PRIORITIES.map((p) => <option key={p} value={p}>{p || "All Priorities"}</option>)}
        </select>
        <select className="text-sm border rounded-lg px-3 py-1.5 bg-white" value={days} onChange={(e) => setDays(Number(e.target.value))}>
          <option value={1}>24h</option>
          <option value={7}>7 days</option>
          <option value={30}>30 days</option>
        </select>
      </div>

      {loading ? (
        <div className="text-center py-20 text-gray-400">Loading mentions...</div>
      ) : mentions.length === 0 ? (
        <div className="text-center py-20 text-gray-400">No mentions found. Try adding data via the API.</div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {mentions.map((m) => (
            <MentionCard key={m.id as number} mention={m as any} />
          ))}
        </div>
      )}
    </div>
  );
}
