"use client";

import { useEffect, useState } from "react";
import { fetchStats, fetchMentions } from "@/lib/api";
import { FileText, TrendingUp, MessageCircle, Heart, AlertTriangle, Download, RefreshCw } from "lucide-react";

interface Stats {
  total_mentions: number;
  positive: number;
  negative: number;
  neutral: number;
  positive_pct: number;
  negative_pct: number;
  net_sentiment: number;
  avg_risk_score: number;
  total_engagement: number;
  channels: { channel: string; count: number }[];
}

interface Mention {
  id: number;
  channel: string;
  content: string;
  sentiment: string;
  ai_summary: string;
  published_at: string;
  engagement: number;
  priority: string;
}

const SENT_COLOR: Record<string, string> = {
  positive: "text-green-700 bg-green-100",
  neutral: "text-gray-600 bg-gray-100",
  negative: "text-red-700 bg-red-100",
};

const CHANNEL_LABELS: Record<string, string> = {
  facebook: "Facebook", twitter: "Twitter / X", instagram: "Instagram",
  youtube: "YouTube", tiktok: "TikTok", pantip: "Pantip", line_oa: "LINE OA",
  news: "News", webboard: "Webboard",
};

const TEMPLATES = [
  { name: "Executive Summary",   desc: "KPI overview, sentiment, top channels",      color: "border-blue-200 bg-blue-50",    dot: "bg-blue-600" },
  { name: "Crisis Report",       desc: "Negative spikes, risk scores, root causes",  color: "border-red-200 bg-red-50",      dot: "bg-red-600" },
  { name: "Campaign Report",     desc: "Campaign reach, engagement, keyword impact", color: "border-purple-200 bg-purple-50", dot: "bg-purple-600" },
  { name: "Admin QC Report",     desc: "SLA compliance, review rates, scores",       color: "border-green-200 bg-green-50",  dot: "bg-green-600" },
];

export default function ReportsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [mentions, setMentions] = useState<Mention[]>([]);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);

  async function load(d: number) {
    setLoading(true);
    try {
      const [s, m] = await Promise.all([
        fetchStats(d),
        fetchMentions({ days: d, limit: 5 }),
      ]);
      setStats(s);
      setMentions(m);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(days); }, [days]);

  function exportCSV() {
    if (!mentions.length) return;
    const header = "channel,sentiment,engagement,published_at,content\n";
    const rows = mentions.map((m) =>
      `${m.channel},${m.sentiment},${m.engagement},"${m.published_at}","${m.content.replace(/"/g, "'").slice(0, 120)}"`
    ).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `socialeye_report_${days}d.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const topChannel = stats?.channels?.[0];
  const coverageRate = stats ? Math.round((stats.positive + stats.negative + stats.neutral) / (stats.total_mentions || 1) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
          <p className="text-sm font-medium text-gray-500 mt-0.5">Live stats &amp; exportable report templates</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-xl border-2 border-gray-200 overflow-hidden">
            {[7, 14, 30, 90].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-3 py-1.5 text-xs font-bold transition-colors ${days === d ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-50"}`}
              >
                {d}d
              </button>
            ))}
          </div>
          <button onClick={() => load(days)} className="p-2 border-2 border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
            <RefreshCw size={14} className="text-gray-500" />
          </button>
          <button onClick={exportCSV} className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-colors">
            <Download size={13} />
            Export CSV
          </button>
        </div>
      </div>

      {/* Live KPI strip */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border-2 border-gray-200 p-5">
            <div className="flex items-center gap-2 mb-2">
              <MessageCircle size={16} className="text-blue-600" />
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Total Mentions</span>
            </div>
            <p className="text-3xl font-extrabold text-gray-900">{stats.total_mentions.toLocaleString()}</p>
            <p className="text-xs font-semibold text-gray-400 mt-1">last {days} days</p>
          </div>

          <div className="bg-white rounded-xl border-2 border-gray-200 p-5">
            <div className="flex items-center gap-2 mb-2">
              <Heart size={16} className="text-green-600" />
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Net Sentiment</span>
            </div>
            <p className={`text-3xl font-extrabold ${stats.net_sentiment >= 0 ? "text-green-700" : "text-red-700"}`}>
              {stats.net_sentiment > 0 ? "+" : ""}{stats.net_sentiment}%
            </p>
            <p className="text-xs font-semibold text-gray-400 mt-1">{stats.positive_pct}% positive · {stats.negative_pct}% negative</p>
          </div>

          <div className="bg-white rounded-xl border-2 border-gray-200 p-5">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp size={16} className="text-purple-600" />
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Total Engagement</span>
            </div>
            <p className="text-3xl font-extrabold text-gray-900">
              {stats.total_engagement >= 1000 ? `${(stats.total_engagement / 1000).toFixed(1)}K` : stats.total_engagement}
            </p>
            <p className="text-xs font-semibold text-gray-400 mt-1">likes + comments + shares</p>
          </div>

          <div className="bg-white rounded-xl border-2 border-gray-200 p-5">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle size={16} className="text-amber-500" />
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Avg Risk Score</span>
            </div>
            <p className={`text-3xl font-extrabold ${stats.avg_risk_score >= 7 ? "text-red-700" : stats.avg_risk_score >= 4 ? "text-amber-600" : "text-green-700"}`}>
              {stats.avg_risk_score}/10
            </p>
            <p className="text-xs font-semibold text-gray-400 mt-1">{stats.avg_risk_score >= 7 ? "High risk" : stats.avg_risk_score >= 4 ? "Medium risk" : "Low risk"}</p>
          </div>
        </div>
      )}

      {/* Sentiment + Channel breakdown */}
      {stats && !loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Sentiment breakdown */}
          <div className="bg-white rounded-xl border-2 border-gray-200 p-5">
            <h2 className="text-xs font-extrabold text-gray-700 uppercase tracking-wide mb-4">Sentiment Breakdown</h2>
            <div className="space-y-3">
              {[
                { label: "Positive", count: stats.positive, pct: stats.positive_pct, bar: "bg-green-500" },
                { label: "Neutral",  count: stats.neutral,  pct: Math.round(stats.neutral / (stats.total_mentions || 1) * 100), bar: "bg-gray-400" },
                { label: "Negative", count: stats.negative, pct: stats.negative_pct, bar: "bg-red-500" },
              ].map((s) => (
                <div key={s.label}>
                  <div className="flex justify-between text-xs font-bold text-gray-700 mb-1">
                    <span>{s.label}</span>
                    <span>{s.count.toLocaleString()} ({s.pct}%)</span>
                  </div>
                  <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-500 ${s.bar}`} style={{ width: `${s.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Channel breakdown */}
          <div className="bg-white rounded-xl border-2 border-gray-200 p-5">
            <h2 className="text-xs font-extrabold text-gray-700 uppercase tracking-wide mb-4">Channel Distribution</h2>
            <div className="space-y-2">
              {stats.channels.slice(0, 6).map((ch) => {
                const pct = Math.round(ch.count / (stats.total_mentions || 1) * 100);
                return (
                  <div key={ch.channel}>
                    <div className="flex justify-between text-xs font-bold text-gray-700 mb-1">
                      <span>{CHANNEL_LABELS[ch.channel] || ch.channel}</span>
                      <span>{ch.count} ({pct}%)</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Insight summary */}
      {stats && !loading && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl p-5">
          <h2 className="text-sm font-extrabold text-blue-900 mb-2">Auto-Generated Summary</h2>
          <p className="text-sm font-semibold text-blue-800 leading-relaxed">
            In the past <strong>{days} days</strong>, SocialEye tracked{" "}
            <strong>{stats.total_mentions.toLocaleString()} mentions</strong> across{" "}
            <strong>{stats.channels.length} channels</strong>.{" "}
            Sentiment is <strong>{stats.net_sentiment >= 0 ? "net positive" : "net negative"}</strong> at{" "}
            <strong>{stats.net_sentiment > 0 ? "+" : ""}{stats.net_sentiment}%</strong>.{" "}
            {topChannel && <>Top channel by volume: <strong>{CHANNEL_LABELS[topChannel.channel] || topChannel.channel}</strong> ({topChannel.count} mentions).</>}{" "}
            Average risk score: <strong>{stats.avg_risk_score}/10</strong>.{" "}
            Total engagement generated: <strong>{stats.total_engagement.toLocaleString()}</strong>.
          </p>
        </div>
      )}

      {/* Recent mentions preview */}
      {mentions.length > 0 && !loading && (
        <div className="bg-white rounded-xl border-2 border-gray-200 overflow-hidden">
          <div className="px-5 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-xs font-extrabold text-gray-700 uppercase tracking-wide">Recent Highlights</h2>
            <span className="text-xs font-semibold text-gray-400">Latest 5 mentions</span>
          </div>
          <div className="divide-y divide-gray-100">
            {mentions.map((m) => (
              <div key={m.id} className="px-5 py-4 flex items-start gap-4">
                <span className={`mt-0.5 text-xs font-bold px-2 py-0.5 rounded-md flex-shrink-0 ${SENT_COLOR[m.sentiment] || "text-gray-600 bg-gray-100"}`}>
                  {m.sentiment}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 line-clamp-2">{m.content}</p>
                  {m.ai_summary && (
                    <p className="text-xs font-medium text-gray-500 mt-1 italic">{m.ai_summary}</p>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs font-bold text-gray-500">{CHANNEL_LABELS[m.channel] || m.channel}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{m.engagement.toLocaleString()} engmt</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Export templates */}
      <div>
        <h2 className="text-base font-extrabold text-gray-900 mb-3">Export Templates</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {TEMPLATES.map((t) => (
            <div key={t.name} className={`rounded-xl border-2 p-5 ${t.color}`}>
              <div className="flex items-start justify-between mb-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${t.dot}`}>
                  <FileText size={16} className="text-white" />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={exportCSV}
                    className="text-xs font-bold bg-white border-2 border-gray-200 text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-1"
                  >
                    <Download size={11} /> CSV
                  </button>
                  <button
                    disabled
                    className="text-xs font-bold bg-white border-2 border-gray-200 text-gray-400 px-3 py-1.5 rounded-lg cursor-not-allowed"
                    title="PDF export coming soon"
                  >
                    PDF
                  </button>
                </div>
              </div>
              <h3 className="text-base font-extrabold text-gray-900">{t.name}</h3>
              <p className="text-sm font-medium text-gray-600 mt-1">{t.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
