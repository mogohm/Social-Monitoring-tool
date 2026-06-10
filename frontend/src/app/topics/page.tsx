"use client";

import { useEffect, useState } from "react";
import { fetchTopics } from "@/lib/api";
import { TrendingUp, RefreshCw, AlertCircle } from "lucide-react";

interface Topic {
  topic: string;
  count: number;
  positive: number;
  neutral: number;
  negative: number;
  positive_pct: number;
  negative_pct: number;
  neutral_pct: number;
  dominant_sentiment: string;
  share_pct: number;
  engagement: number;
}

const SENT_COLORS: Record<string, string> = {
  positive: "text-green-700 bg-green-100",
  neutral: "text-gray-700 bg-gray-100",
  negative: "text-red-700 bg-red-100",
};

const DAYS_OPTIONS = [7, 14, 30, 90];

export default function TopicsPage() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load(d: number) {
    setLoading(true);
    setError("");
    try {
      const data = await fetchTopics(d);
      setTopics(data);
    } catch {
      setError("Could not load topics — check backend connection.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(days); }, [days]);

  const maxCount = Math.max(...topics.map((t) => t.count), 1);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Topics &amp; Trends</h1>
          <p className="text-sm font-medium text-gray-500 mt-0.5">AI-classified topics from monitored mentions</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-xl border-2 border-gray-200 overflow-hidden">
            {DAYS_OPTIONS.map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-3 py-1.5 text-xs font-bold transition-colors ${days === d ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-50"}`}
              >
                {d}d
              </button>
            ))}
          </div>
          <button
            onClick={() => load(days)}
            className="p-2 border-2 border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
          >
            <RefreshCw size={14} className="text-gray-500" />
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 bg-red-50 border-2 border-red-200 rounded-xl p-4">
          <AlertCircle size={16} className="text-red-600 flex-shrink-0" />
          <p className="text-sm font-semibold text-red-700">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : topics.length === 0 ? (
        <div className="bg-white rounded-xl border-2 border-gray-200 p-12 text-center">
          <TrendingUp size={32} className="text-gray-300 mx-auto mb-3" />
          <p className="text-sm font-semibold text-gray-500">No topics found for this period.</p>
        </div>
      ) : (
        <>
          {/* Bar chart */}
          <div className="bg-white rounded-xl border-2 border-gray-200 p-6">
            <h2 className="text-sm font-extrabold text-gray-700 uppercase tracking-wide mb-5">Mention Volume by Topic</h2>
            <div className="space-y-3">
              {topics.slice(0, 10).map((t) => (
                <div key={t.topic} className="flex items-center gap-3">
                  <div className="w-40 text-xs font-bold text-gray-700 truncate text-right flex-shrink-0">{t.topic}</div>
                  <div className="flex-1 h-7 bg-gray-100 rounded-lg overflow-hidden relative">
                    <div
                      className="h-full rounded-lg transition-all duration-500"
                      style={{
                        width: `${(t.count / maxCount) * 100}%`,
                        background: t.dominant_sentiment === "positive"
                          ? "linear-gradient(90deg,#22c55e,#16a34a)"
                          : t.dominant_sentiment === "negative"
                          ? "linear-gradient(90deg,#ef4444,#dc2626)"
                          : "linear-gradient(90deg,#60a5fa,#3b82f6)",
                      }}
                    />
                    <span className="absolute inset-0 flex items-center pl-3 text-xs font-extrabold text-white mix-blend-normal"
                      style={{ visibility: t.count / maxCount > 0.2 ? "visible" : "hidden" }}>
                      {t.count}
                    </span>
                  </div>
                  <div className="w-14 text-right">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${SENT_COLORS[t.dominant_sentiment]}`}>
                      {t.dominant_sentiment}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border-2 border-gray-200 overflow-hidden">
            <div className="px-5 py-3 bg-gray-50 border-b border-gray-200">
              <h2 className="text-xs font-extrabold text-gray-700 uppercase tracking-wide">Full Topic Breakdown</h2>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  {["#", "Topic", "Mentions", "Share", "Positive", "Negative", "Engagement", "Sentiment"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {topics.map((t, i) => (
                  <tr key={t.topic} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3.5 text-sm font-bold text-gray-400">#{i + 1}</td>
                    <td className="px-4 py-3.5 text-sm font-extrabold text-gray-900">{t.topic}</td>
                    <td className="px-4 py-3.5 text-sm font-bold text-gray-800">{t.count.toLocaleString()}</td>
                    <td className="px-4 py-3.5 text-sm font-bold text-blue-700">{t.share_pct}%</td>
                    <td className="px-4 py-3.5 text-sm font-bold text-green-700">{t.positive_pct}%</td>
                    <td className="px-4 py-3.5 text-sm font-bold text-red-700">{t.negative_pct}%</td>
                    <td className="px-4 py-3.5 text-sm font-bold text-gray-700">{t.engagement.toLocaleString()}</td>
                    <td className="px-4 py-3.5">
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-md ${SENT_COLORS[t.dominant_sentiment]}`}>
                        {t.dominant_sentiment}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
