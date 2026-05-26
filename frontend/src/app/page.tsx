"use client";
import { useEffect, useState } from "react";
import { fetchStats, fetchTrend } from "@/lib/api";
import KPICard from "@/components/KPICard";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, ResponsiveContainer, Legend,
} from "recharts";
import { MessageSquare, ThumbsUp, ThumbsDown, TrendingUp, Zap, Activity } from "lucide-react";

const COLORS = ["#22c55e", "#94a3b8", "#ef4444"];

export default function OverviewPage() {
  const [stats, setStats] = useState<Record<string, number | { channel: string; count: number }[]> | null>(null);
  const [trend, setTrend] = useState<{ date: string; positive: number; neutral: number; negative: number }[]>([]);
  const [days, setDays] = useState(7);

  useEffect(() => {
    fetchStats(days).then(setStats).catch(() => {});
    fetchTrend(days).then(setTrend).catch(() => {});
  }, [days]);

  const sentimentPie = stats
    ? [
        { name: "Positive", value: Number(stats.positive) || 0 },
        { name: "Neutral", value: Number(stats.neutral) || 0 },
        { name: "Negative", value: Number(stats.negative) || 0 },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Executive Overview</h1>
          <p className="text-sm text-gray-500">Real-time social monitoring dashboard</p>
        </div>
        <select
          className="text-sm border rounded-lg px-3 py-1.5 bg-white shadow-sm"
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
        >
          <option value={1}>24 hours</option>
          <option value={7}>7 days</option>
          <option value={30}>30 days</option>
        </select>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <KPICard title="Total Mentions" value={stats ? Number(stats.total_mentions).toLocaleString() : "—"} icon={<MessageSquare size={14} />} color="blue" />
        <KPICard title="Positive %" value={stats ? `${stats.positive_pct}%` : "—"} color="green" icon={<ThumbsUp size={14} />} />
        <KPICard title="Negative %" value={stats ? `${stats.negative_pct}%` : "—"} color="red" icon={<ThumbsDown size={14} />} />
        <KPICard title="Net Sentiment" value={stats ? `${stats.net_sentiment}%` : "—"} color="purple" icon={<Activity size={14} />} />
        <KPICard title="Total Engagement" value={stats ? Number(stats.total_engagement).toLocaleString() : "—"} color="yellow" icon={<TrendingUp size={14} />} />
        <KPICard title="Avg Risk Score" value={stats ? `${stats.avg_risk_score}/100` : "—"} color="red" icon={<Zap size={14} />} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Mention Volume & Sentiment Trend</h2>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={trend} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="pos" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="neg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Area type="monotone" dataKey="positive" stroke="#22c55e" fill="url(#pos)" strokeWidth={2} />
              <Area type="monotone" dataKey="neutral" stroke="#94a3b8" fill="none" strokeWidth={1} strokeDasharray="4 4" />
              <Area type="monotone" dataKey="negative" stroke="#ef4444" fill="url(#neg)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Sentiment Distribution</h2>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={sentimentPie} dataKey="value" cx="50%" cy="50%" outerRadius={70} label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`} labelLine={false} fontSize={11}>
                {sentimentPie.map((_, i) => (
                  <Cell key={i} fill={COLORS[i]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-2 space-y-1">
            {sentimentPie.map((s, i) => (
              <div key={s.name} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ background: COLORS[i] }} />
                  {s.name}
                </span>
                <span className="font-medium text-gray-700">{s.value.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {stats && Array.isArray(stats.channels) && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Top Channels</h2>
          <div className="flex flex-wrap gap-3">
            {(stats.channels as { channel: string; count: number }[]).map((c) => (
              <div key={c.channel} className="flex items-center gap-2 bg-gray-50 rounded-lg px-4 py-2">
                <span className="text-sm font-medium text-gray-700 capitalize">{c.channel}</span>
                <span className="text-xs text-gray-500">{c.count.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
