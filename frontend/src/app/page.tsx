"use client";
import { useEffect, useState } from "react";
import { fetchStats, fetchTrend, fetchKeywordStats } from "@/lib/api";
import KPICard from "@/components/KPICard";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, ResponsiveContainer, Legend,
  BarChart, Bar,
} from "recharts";
import { MessageSquare, ThumbsUp, ThumbsDown, TrendingUp, Zap, Activity, Tag, Hash } from "lucide-react";
import Link from "next/link";

const COLORS = ["#16a34a", "#94a3b8", "#dc2626"];
const CAT_COLOR: Record<string, string> = {
  brand:      "bg-blue-100 text-blue-800 border-blue-200",
  product:    "bg-purple-100 text-purple-800 border-purple-200",
  competitor: "bg-orange-100 text-orange-800 border-orange-200",
  crisis:     "bg-red-100 text-red-800 border-red-200",
  campaign:   "bg-green-100 text-green-800 border-green-200",
  general:    "bg-gray-100 text-gray-700 border-gray-200",
};

interface KeywordStat { id: number; word: string; category: string; is_negative: boolean; match_count: number; mention_count: number; }

export default function OverviewPage() {
  const [stats,    setStats]    = useState<Record<string, number | { channel: string; count: number }[]> | null>(null);
  const [trend,    setTrend]    = useState<{ date: string; positive: number; neutral: number; negative: number }[]>([]);
  const [kwStats,  setKwStats]  = useState<KeywordStat[]>([]);
  const [days, setDays] = useState(7);

  useEffect(() => {
    fetchStats(days).then(setStats).catch(() => {});
    fetchTrend(days).then(setTrend).catch(() => {});
    fetchKeywordStats().then(setKwStats).catch(() => {});
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
              <Link key={c.channel} href={`/mentions?channel=${c.channel}`}
                className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 hover:border-blue-300 hover:bg-blue-50 transition-colors cursor-pointer">
                <span className="text-sm font-bold text-gray-800 capitalize">{c.channel}</span>
                <span className="text-xs font-semibold text-gray-600 bg-gray-200 px-2 py-0.5 rounded-full">{c.count.toLocaleString()}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Keyword Performance */}
      {kwStats.length > 0 && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Bar chart */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <Tag size={15} className="text-blue-600" /> Keyword Match Volume
              </h2>
              <Link href="/keywords" className="text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline">
                Manage →
              </Link>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={kwStats.slice(0, 8).map((k) => ({ name: k.word, count: k.mention_count ?? k.match_count, negative: k.is_negative }))}
                layout="vertical" margin={{ top: 0, right: 20, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 12, fill: "#374151", fontWeight: 600 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: "#374151", fontWeight: 700 }} width={90} />
                <Tooltip
                  contentStyle={{ fontSize: 13, fontWeight: 600 }}
                  formatter={(val) => [`${val} mentions`, "Matches"]}
                />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {kwStats.slice(0, 8).map((k, i) => (
                    <Cell key={i} fill={k.is_negative ? "#dc2626" : "#3b82f6"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="flex items-center gap-4 mt-2 text-xs font-semibold text-gray-600">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-blue-500 inline-block" />Monitor keyword</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-red-500 inline-block" />Negative keyword</span>
            </div>
          </div>

          {/* Keyword chip grid */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <h2 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Hash size={15} className="text-blue-600" /> Keywords ที่กำลัง Monitor
            </h2>
            <div className="flex flex-wrap gap-2">
              {kwStats.map((kw) => (
                <Link
                  key={kw.id}
                  href={`/mentions?keyword=${encodeURIComponent(kw.word)}`}
                  className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-xl font-bold border cursor-pointer hover:shadow-sm transition-shadow ${CAT_COLOR[kw.category] || CAT_COLOR.general}`}
                >
                  #{kw.word}
                  <span className="text-xs font-extrabold bg-white/70 px-1.5 py-0.5 rounded-md ml-1">
                    {(kw.mention_count ?? kw.match_count).toLocaleString()}
                  </span>
                  {kw.is_negative && <span className="text-red-500 font-extrabold">⚠</span>}
                </Link>
              ))}
            </div>
            <p className="text-xs font-semibold text-gray-500 mt-4">กดที่ keyword เพื่อดู mentions ที่เกี่ยวข้อง</p>
          </div>
        </div>
      )}
    </div>
  );
}
