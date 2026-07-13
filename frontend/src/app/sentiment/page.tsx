"use client";
import { useEffect, useState } from "react";
import { fetchTrend, fetchStats } from "@/lib/api";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

export default function SentimentPage() {
  const [trend,   setTrend]   = useState<{ date: string; positive: number; neutral: number; negative: number }[]>([]);
  const [stats,   setStats]   = useState<Record<string, unknown> | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    fetchTrend(14).then(setTrend).catch(() => {});
    fetchStats(14).then(setStats).catch(() => {});
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Sentiment Analysis</h1>
        <p className="text-sm font-medium text-gray-600 mt-0.5">14-day sentiment breakdown</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Positive", value: stats ? `${stats.positive_pct}%` : "—", color: "text-green-700", bg: "bg-green-50 border-green-200" },
          { label: "Neutral",  value: stats ? `${stats.neutral_pct}%` : "—",    color: "text-gray-700",  bg: "bg-gray-50 border-gray-200" },
          { label: "Negative", value: stats ? `${stats.negative_pct}%` : "—", color: "text-red-700",   bg: "bg-red-50 border-red-200" },
        ].map((s) => (
          <div key={s.label} className={`rounded-xl border-2 p-5 text-center ${s.bg}`}>
            <div className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-2">{s.label}</div>
            <div className={`text-3xl font-extrabold ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
        <h2 className="text-base font-bold text-gray-900 mb-5">Sentiment Over Time (14 days)</h2>
        {mounted ? (
          <ResponsiveContainer width="100%" height={340}>
            <BarChart data={trend} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="date" tick={{ fontSize: 12, fill: "#374151", fontWeight: 600 }} />
              <YAxis tick={{ fontSize: 12, fill: "#374151", fontWeight: 600 }} />
              <Tooltip contentStyle={{ fontSize: 13, fontWeight: 600 }} />
              <Legend wrapperStyle={{ fontSize: 13, fontWeight: 600 }} />
              <Bar dataKey="positive" name="Positive" fill="#16a34a" radius={[4, 4, 0, 0]} />
              <Bar dataKey="neutral"  name="Neutral"  fill="#94a3b8" radius={[4, 4, 0, 0]} />
              <Bar dataKey="negative" name="Negative" fill="#dc2626" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[340px] bg-gray-50 rounded animate-pulse" />
        )}
      </div>
    </div>
  );
}
