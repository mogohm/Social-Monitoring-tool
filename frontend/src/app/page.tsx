"use client";
import { useEffect, useState } from "react";
import { fetchStats, fetchTrend } from "@/lib/api";
import KPICard from "@/components/KPICard";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, ResponsiveContainer, Legend,
} from "recharts";
import { MessageSquare, ThumbsUp, ThumbsDown, TrendingUp, Zap, Activity } from "lucide-react";

const COLORS = ["#16a34a", "#94a3b8", "#dc2626"];

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
        { name: "Neutral",  value: Number(stats.neutral)  || 0 },
        { name: "Negative", value: Number(stats.negative) || 0 },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Executive Overview</h1>
          <p className="text-sm font-medium text-gray-600 mt-0.5">Real-time social monitoring dashboard</p>
        </div>
        <select
          className="text-sm font-semibold border-2 border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-800 shadow-sm focus:outline-none focus:border-blue-400"
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
        >
          <option value={1}>24 hours</option>
          <option value={7}>7 days</option>
          <option value={30}>30 days</option>
        </select>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <KPICard title="Total Mentions"    value={stats ? Number(stats.total_mentions).toLocaleString() : "—"} icon={<MessageSquare size={14} />} color="blue" />
        <KPICard title="Positive %"        value={stats ? `${stats.positive_pct}%` : "—"} color="green"  icon={<ThumbsUp size={14} />} />
        <KPICard title="Negative %"        value={stats ? `${stats.negative_pct}%` : "—"} color="red"    icon={<ThumbsDown size={14} />} />
        <KPICard title="Net Sentiment"     value={stats ? `${stats.net_sentiment}%` : "—"} color="purple" icon={<Activity size={14} />} />
        <KPICard title="Total Engagement"  value={stats ? Number(stats.total_engagement).toLocaleString() : "—"} color="yellow" icon={<TrendingUp size={14} />} />
        <KPICard title="Avg Risk Score"    value={stats ? `${stats.avg_risk_score}/100` : "—"} color="red" icon={<Zap size={14} />} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <h2 className="text-base font-bold text-gray-900 mb-4">Mention Volume & Sentiment Trend</h2>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={trend} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="pos" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#16a34a" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="neg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#dc2626" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#dc2626" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="date" tick={{ fontSize: 12, fill: "#4b5563", fontWeight: 600 }} />
              <YAxis tick={{ fontSize: 12, fill: "#4b5563", fontWeight: 600 }} />
              <Tooltip contentStyle={{ fontSize: 13, fontWeight: 600 }} />
              <Legend wrapperStyle={{ fontSize: 13, fontWeight: 600 }} />
              <Area type="monotone" dataKey="positive" name="Positive" stroke="#16a34a" fill="url(#pos)" strokeWidth={2.5} />
              <Area type="monotone" dataKey="neutral"  name="Neutral"  stroke="#64748b" fill="none" strokeWidth={1.5} strokeDasharray="4 4" />
              <Area type="monotone" dataKey="negative" name="Negative" stroke="#dc2626" fill="url(#neg)" strokeWidth={2.5} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <h2 className="text-base font-bold text-gray-900 mb-4">Sentiment Distribution</h2>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={sentimentPie} dataKey="value" cx="50%" cy="50%" outerRadius={70}
                label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                labelLine={false} fontSize={12}>
                {sentimentPie.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
              </Pie>
              <Tooltip contentStyle={{ fontSize: 13, fontWeight: 600 }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-3 space-y-2">
            {sentimentPie.map((s, i) => (
              <div key={s.name} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 font-semibold text-gray-700">
                  <span className="w-3 h-3 rounded-full" style={{ background: COLORS[i] }} />
                  {s.name}
                </span>
                <span className="font-bold text-gray-900">{s.value.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {stats && Array.isArray(stats.channels) && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <h2 className="text-base font-bold text-gray-900 mb-4">Top Channels</h2>
          <div className="flex flex-wrap gap-3">
            {(stats.channels as { channel: string; count: number }[]).map((c) => (
              <div key={c.channel} className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2">
                <span className="text-sm font-bold text-gray-800 capitalize">{c.channel}</span>
                <span className="text-xs font-semibold text-gray-600 bg-gray-200 px-2 py-0.5 rounded-full">{c.count.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
