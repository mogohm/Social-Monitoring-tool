"use client";

import { useEffect, useState } from "react";
import { fetchCompetitors } from "@/lib/api";
import { BarChart2, RefreshCw, AlertCircle } from "lucide-react";

interface Competitor {
  keyword: string;
  count: number;
  positive: number;
  neutral: number;
  negative: number;
  positive_pct: number;
  negative_pct: number;
  engagement: number;
  sov_pct: number;
}

const DAYS_OPTIONS = [7, 14, 30, 90];

const SOV_COLORS = [
  "#3b82f6", "#8b5cf6", "#06b6d4", "#10b981", "#f59e0b",
  "#ef4444", "#6366f1", "#ec4899", "#84cc16", "#f97316",
];

export default function CompetitorsPage() {
  const [rows, setRows] = useState<Competitor[]>([]);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load(d: number) {
    setLoading(true);
    setError("");
    try {
      const data = await fetchCompetitors(d);
      setRows(data);
    } catch {
      setError("Could not load data — check backend connection.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(days); }, [days]);

  const maxCount = Math.max(...rows.map((r) => r.count), 1);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Keyword Share of Voice</h1>
          <p className="text-sm font-medium text-gray-500 mt-0.5">Mention distribution across tracked keywords</p>
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
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="bg-white rounded-xl border-2 border-gray-200 p-12 text-center">
          <BarChart2 size={32} className="text-gray-300 mx-auto mb-3" />
          <p className="text-sm font-semibold text-gray-500">No keyword data found for this period.</p>
        </div>
      ) : (
        <>
          {/* SOV visual */}
          <div className="bg-white rounded-xl border-2 border-gray-200 p-6">
            <h2 className="text-sm font-extrabold text-gray-700 uppercase tracking-wide mb-1">Share of Voice</h2>
            <p className="text-xs font-semibold text-gray-400 mb-5">% of total mentions by keyword tag</p>

            {/* Stacked bar */}
            <div className="h-10 rounded-xl overflow-hidden flex mb-4">
              {rows.map((r, i) => (
                <div
                  key={r.keyword}
                  className="h-full transition-all duration-500 flex items-center justify-center"
                  style={{ width: `${r.sov_pct}%`, backgroundColor: SOV_COLORS[i % SOV_COLORS.length] }}
                  title={`${r.keyword}: ${r.sov_pct}%`}
                >
                  {r.sov_pct > 6 && (
                    <span className="text-xs font-extrabold text-white truncate px-1">{r.keyword}</span>
                  )}
                </div>
              ))}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-3">
              {rows.map((r, i) => (
                <div key={r.keyword} className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: SOV_COLORS[i % SOV_COLORS.length] }} />
                  <span className="text-xs font-semibold text-gray-600">{r.keyword} ({r.sov_pct}%)</span>
                </div>
              ))}
            </div>
          </div>

          {/* Volume bar chart */}
          <div className="bg-white rounded-xl border-2 border-gray-200 p-6">
            <h2 className="text-sm font-extrabold text-gray-700 uppercase tracking-wide mb-5">Mention Volume by Keyword</h2>
            <div className="space-y-3">
              {rows.map((r, i) => (
                <div key={r.keyword} className="flex items-center gap-3">
                  <div className="w-28 text-xs font-bold text-gray-700 truncate text-right flex-shrink-0">{r.keyword}</div>
                  <div className="flex-1 h-7 bg-gray-100 rounded-lg overflow-hidden relative">
                    <div
                      className="h-full rounded-lg transition-all duration-500"
                      style={{
                        width: `${(r.count / maxCount) * 100}%`,
                        backgroundColor: SOV_COLORS[i % SOV_COLORS.length],
                      }}
                    />
                    {r.count / maxCount > 0.15 && (
                      <span className="absolute inset-0 flex items-center pl-3 text-xs font-extrabold text-white">
                        {r.count}
                      </span>
                    )}
                  </div>
                  <div className="w-12 text-right text-xs font-bold text-gray-500">{r.sov_pct}%</div>
                </div>
              ))}
            </div>
          </div>

          {/* Detailed table */}
          <div className="bg-white rounded-xl border-2 border-gray-200 overflow-hidden">
            <div className="px-5 py-3 bg-gray-50 border-b border-gray-200">
              <h2 className="text-xs font-extrabold text-gray-700 uppercase tracking-wide">Keyword Detail</h2>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  {["Keyword", "Mentions", "SOV", "Positive", "Negative", "Engagement"].map((h) => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((r, i) => (
                  <tr key={r.keyword} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: SOV_COLORS[i % SOV_COLORS.length] }} />
                        <span className="text-sm font-extrabold text-gray-900">{r.keyword}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm font-bold text-gray-900">{r.count.toLocaleString()}</td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${r.sov_pct}%`, backgroundColor: SOV_COLORS[i % SOV_COLORS.length] }} />
                        </div>
                        <span className="text-sm font-extrabold w-10 text-right" style={{ color: SOV_COLORS[i % SOV_COLORS.length] }}>{r.sov_pct}%</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm font-bold text-green-700">{r.positive_pct}%</td>
                    <td className="px-5 py-4 text-sm font-bold text-red-700">{r.negative_pct}%</td>
                    <td className="px-5 py-4 text-sm font-bold text-gray-700">{r.engagement.toLocaleString()}</td>
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
