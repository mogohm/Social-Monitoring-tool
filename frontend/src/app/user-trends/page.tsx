"use client";

import { useEffect, useState, useCallback } from "react";
import { fetchUsers } from "@/lib/api";
import Link from "next/link";
import {
  Users, AlertTriangle, RefreshCw, Shield, ShieldOff,
  TrendingUp, MessageCircle, Search, ArrowUp, ArrowDown, ArrowUpDown,
} from "lucide-react";
import DateRangePicker from "@/components/DateRangePicker";
import { DateRange } from "@/lib/dateRange";

interface UserStat {
  author: string;
  count: number;
  positive: number;
  neutral: number;
  negative: number;
  positive_pct: number;
  negative_pct: number;
  engagement: number;
  channels: string[];
  avg_risk: number;
  dominant_sentiment: string;
  last_seen: string | null;
}

const SENT_COLORS: Record<string, string> = {
  positive: "text-green-700 bg-green-100",
  neutral:  "text-gray-600 bg-gray-100",
  negative: "text-red-700 bg-red-100",
};

const SENT_BAR: Record<string, string> = {
  positive: "#22c55e",
  neutral:  "#94a3b8",
  negative: "#ef4444",
};

const CHANNEL_LABELS: Record<string, string> = {
  facebook: "FB", twitter: "X", instagram: "IG",
  youtube: "YT", tiktok: "TT", pantip: "PT",
  line_oa: "LINE", news: "News", webboard: "Web",
};

const WATCHLIST_KEY = "socialeye_watchlist";

/** Columns the table can be ordered by. */
type SortKey = "author" | "count" | "negative_pct" | "avg_risk" | "last_seen" | "watch";

const SORTABLE: { key: SortKey; label: string }[] = [
  { key: "author",       label: "ผู้ใช้" },
  { key: "count",        label: "Mentions" },
  { key: "negative_pct", label: "Sentiment" },
  { key: "avg_risk",     label: "Risk" },
];

function getRiskColor(risk: number) {
  if (risk >= 7) return "text-red-700 bg-red-100";
  if (risk >= 4) return "text-amber-700 bg-amber-100";
  return "text-green-700 bg-green-100";
}

function timeAgo(iso: string | null) {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function UserTrendsPage() {
  const [users, setUsers]         = useState<UserStat[]>([]);
  const [range, setRange]         = useState<DateRange>({ days: 30 });
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState("");
  const [search, setSearch]       = useState("");
  const [watchlist, setWatchlist] = useState<Set<string>>(new Set());
  const [showWatchOnly, setShowWatchOnly] = useState(false);
  const [sentFilter, setSentFilter] = useState<"" | "positive" | "neutral" | "negative">("");
  const [sortKey, setSortKey]     = useState<SortKey>("count");
  const [sortDir, setSortDir]     = useState<"asc" | "desc">("desc");

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else { setSortKey(key); setSortDir("desc"); }
  }

  // Load watchlist from localStorage
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(WATCHLIST_KEY) || "[]");
      setWatchlist(new Set(saved));
    } catch { /* ignore */ }
  }, []);

  function saveWatchlist(next: Set<string>) {
    setWatchlist(next);
    localStorage.setItem(WATCHLIST_KEY, JSON.stringify([...next]));
  }

  function toggleWatch(author: string) {
    const next = new Set(watchlist);
    if (next.has(author)) next.delete(author);
    else next.add(author);
    saveWatchlist(next);
  }

  const load = useCallback(async (r: DateRange) => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchUsers(r);
      setUsers(data);
    } catch {
      setError("โหลดข้อมูลไม่สำเร็จ — ตรวจสอบการเชื่อมต่อ backend");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(range); }, [range, load]);

  const filtered = users
    .filter((u) => {
      if (showWatchOnly && !watchlist.has(u.author)) return false;
      if (search && !u.author.toLowerCase().includes(search.toLowerCase())) return false;
      if (sentFilter && u.dominant_sentiment !== sentFilter) return false;
      return true;
    })
    .sort((a, b) => {
      const dir = sortDir === "desc" ? -1 : 1;
      switch (sortKey) {
        case "author":   return dir * a.author.localeCompare(b.author, "th");
        case "watch":    return dir * (Number(watchlist.has(a.author)) - Number(watchlist.has(b.author)));
        case "last_seen": {
          const ta = a.last_seen ? new Date(a.last_seen).getTime() : 0;
          const tb = b.last_seen ? new Date(b.last_seen).getTime() : 0;
          return dir * (ta - tb);
        }
        default: return dir * ((a[sortKey] as number) - (b[sortKey] as number));
      }
    });

  const watchedUsers = users.filter((u) => watchlist.has(u.author));
  const highRiskWatched = watchedUsers.filter((u) => u.avg_risk >= 6 || u.negative_pct >= 40);
  const maxCount = Math.max(...users.map((u) => u.count), 1);

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">User Trends</h1>
          <p className="text-sm font-medium text-gray-500 mt-0.5">วิเคราะห์ผู้ใช้งาน · เฝ้าระวัง · ติดตามแนวโน้ม</p>
        </div>
        <DateRangePicker value={range} onChange={setRange} onRefresh={() => load(range)} />
      </div>

      {/* Watchlist alert banner */}
      {highRiskWatched.length > 0 && (
        <div className="bg-red-50 border-2 border-red-300 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle size={18} className="text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-extrabold text-red-800">⚠️ เฝ้าระวัง — ผู้ใช้ในรายชื่อมีกิจกรรมน่าสังเกต</p>
            <div className="flex flex-wrap gap-2 mt-2">
              {highRiskWatched.map((u) => (
                <span key={u.author} className="text-xs font-bold bg-red-100 text-red-700 px-2.5 py-1 rounded-lg">
                  {u.author} · {u.negative_pct}% neg · risk {u.avg_risk}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 text-sm font-semibold text-red-700">{error}</div>
      )}

      {/* KPI strip */}
      {!loading && users.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "ผู้ใช้งานทั้งหมด", value: users.length, icon: Users, color: "text-blue-600" },
            { label: "เฝ้าระวัง", value: watchlist.size, icon: Shield, color: "text-amber-600" },
            { label: "ความเสี่ยงสูง (risk ≥7)", value: users.filter(u => u.avg_risk >= 7).length, icon: AlertTriangle, color: "text-red-600" },
            { label: "Sentiment ลบ >40%", value: users.filter(u => u.negative_pct >= 40).length, icon: TrendingUp, color: "text-orange-600" },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-white rounded-xl border-2 border-gray-200 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Icon size={14} className={color} />
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">{label}</span>
              </div>
              <p className="text-2xl font-extrabold text-gray-900">{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Top users bar chart */}
      {!loading && users.length > 0 && (
        <div className="bg-white rounded-xl border-2 border-gray-200 p-6">
          <h2 className="text-xs font-extrabold text-gray-700 uppercase tracking-wide mb-5">Top 10 ผู้ใช้งานที่พูดถึงมากสุด</h2>
          <div className="space-y-2.5">
            {users.slice(0, 10).map((u, i) => {
              const neutralPct = Math.max(0, 100 - u.positive_pct - u.negative_pct);
              return (
                <div key={u.author} className="flex items-center gap-3">
                  <span className="w-5 text-xs font-bold text-gray-400 text-right flex-shrink-0">#{i+1}</span>
                  {/* Name links to this author's mentions — the feedback asked to
                      be able to click through to the actual posts. */}
                  <Link
                    href={`/mentions?author=${encodeURIComponent(u.author)}`}
                    title={`ดูโพสต์ของ ${u.author}`}
                    className="w-32 text-xs font-bold text-gray-700 hover:text-blue-700 hover:underline
                               truncate flex-shrink-0 text-right"
                  >
                    {u.author}
                  </Link>
                  {/* Percentages are written into the segments, not just colour-coded */}
                  <div className="flex-1 h-6 bg-gray-100 rounded-lg overflow-hidden flex">
                    <div className="h-full flex items-center justify-center transition-all duration-500"
                         style={{ width: `${u.positive_pct}%`, backgroundColor: "#22c55e" }}>
                      {u.positive_pct >= 12 && (
                        <span className="text-[10px] font-extrabold text-white">{u.positive_pct}%</span>
                      )}
                    </div>
                    <div className="h-full flex items-center justify-center transition-all duration-500"
                         style={{ width: `${neutralPct}%`, backgroundColor: "#e2e8f0" }}>
                      {neutralPct >= 12 && (
                        <span className="text-[10px] font-extrabold text-slate-600">{neutralPct}%</span>
                      )}
                    </div>
                    <div className="h-full flex items-center justify-center transition-all duration-500"
                         style={{ width: `${u.negative_pct}%`, backgroundColor: "#ef4444" }}>
                      {u.negative_pct >= 12 && (
                        <span className="text-[10px] font-extrabold text-white">{u.negative_pct}%</span>
                      )}
                    </div>
                  </div>
                  {/* Explicit counts for the segments too narrow to label inline */}
                  <div className="w-24 flex items-center justify-end gap-1.5 text-[10px] font-extrabold flex-shrink-0">
                    <span className="text-green-600">{u.positive}</span>
                    <span className="text-slate-400">/</span>
                    <span className="text-red-600">{u.negative}</span>
                  </div>
                  <div className="w-8 text-right text-xs font-extrabold text-gray-700">{u.count}</div>
                  {watchlist.has(u.author) && (
                    <Shield size={12} className="text-amber-500 flex-shrink-0" />
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-4 mt-4 pt-4 border-t border-gray-100 flex-wrap">
            {[["#22c55e", "Positive"], ["#e2e8f0", "Neutral"], ["#ef4444", "Negative"]].map(([color, label]) => (
              <div key={label} className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: color }} />
                <span className="text-xs font-semibold text-gray-500">{label}</span>
              </div>
            ))}
            <span className="text-xs font-semibold text-gray-400 ml-auto">
              ตัวเลขในแท่ง = % · ตัวเลขท้ายแท่ง = <span className="text-green-600 font-extrabold">บวก</span>
              {" / "}<span className="text-red-600 font-extrabold">ลบ</span> (จำนวนโพสต์) · คลิกชื่อเพื่อดูโพสต์
            </span>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-48 relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ค้นหาชื่อผู้ใช้..."
            className="w-full pl-9 pr-4 py-2.5 border-2 border-gray-200 rounded-xl text-sm font-medium text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-400 bg-white"
          />
        </div>
        {/* Sentiment filter */}
        <div className="flex rounded-xl border-2 border-gray-200 overflow-hidden">
          {([
            { v: "",         label: "ทุก sentiment", cls: "bg-gray-700" },
            { v: "positive", label: "บวก",           cls: "bg-green-600" },
            { v: "neutral",  label: "กลาง",          cls: "bg-slate-500" },
            { v: "negative", label: "ลบ",            cls: "bg-red-600" },
          ] as const).map((o) => (
            <button
              key={o.v}
              onClick={() => setSentFilter(o.v)}
              className={`px-3 py-2.5 text-xs font-bold transition-colors ${
                sentFilter === o.v ? `${o.cls} text-white` : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowWatchOnly(!showWatchOnly)}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold rounded-xl border-2 transition-colors ${showWatchOnly ? "bg-amber-50 border-amber-300 text-amber-700" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}
        >
          <Shield size={13} />
          เฝ้าระวังเท่านั้น {watchlist.size > 0 && `(${watchlist.size})`}
        </button>
      </div>

      {(sentFilter || search || showWatchOnly) && (
        <p className="text-xs font-semibold text-gray-500 -mt-3">
          แสดง {filtered.length} จาก {users.length} ผู้ใช้
        </p>
      )}

      {/* Main table */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(8)].map((_, i) => <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border-2 border-gray-200 p-12 text-center">
          <Users size={32} className="text-gray-300 mx-auto mb-3" />
          <p className="text-sm font-semibold text-gray-400">ไม่พบผู้ใช้ในช่วงเวลานี้</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border-2 border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                {SORTABLE.map(({ key, label }) => (
                  <th key={key} className="px-4 py-3 text-left">
                    <button
                      onClick={() => toggleSort(key)}
                      className={`flex items-center gap-1 text-xs font-bold uppercase tracking-wide transition-colors ${
                        sortKey === key ? "text-blue-700" : "text-gray-600 hover:text-gray-900"
                      }`}
                    >
                      {label}
                      {sortKey === key
                        ? (sortDir === "desc" ? <ArrowDown size={11} /> : <ArrowUp size={11} />)
                        : <ArrowUpDown size={11} className="text-gray-300" />}
                    </button>
                  </th>
                ))}
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wide">Channels</th>
                <th className="px-4 py-3 text-left">
                  <button
                    onClick={() => toggleSort("last_seen")}
                    className={`flex items-center gap-1 text-xs font-bold uppercase tracking-wide transition-colors ${
                      sortKey === "last_seen" ? "text-blue-700" : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    ล่าสุด
                    {sortKey === "last_seen"
                      ? (sortDir === "desc" ? <ArrowDown size={11} /> : <ArrowUp size={11} />)
                      : <ArrowUpDown size={11} className="text-gray-300" />}
                  </button>
                </th>
                <th className="px-4 py-3 text-left">
                  <button
                    onClick={() => toggleSort("watch")}
                    className={`flex items-center gap-1 text-xs font-bold uppercase tracking-wide transition-colors ${
                      sortKey === "watch" ? "text-blue-700" : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    เฝ้าระวัง
                    {sortKey === "watch"
                      ? (sortDir === "desc" ? <ArrowDown size={11} /> : <ArrowUp size={11} />)
                      : <ArrowUpDown size={11} className="text-gray-300" />}
                  </button>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((u) => {
                const isWatched = watchlist.has(u.author);
                return (
                  <tr key={u.author} className={`transition-colors ${isWatched ? "bg-amber-50 hover:bg-amber-100" : "hover:bg-gray-50"}`}>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        {isWatched && <Shield size={13} className="text-amber-500 flex-shrink-0" />}
                        <Link
                          href={`/mentions?author=${encodeURIComponent(u.author)}`}
                          title={`ดูโพสต์ของ ${u.author}`}
                          className={`text-sm font-extrabold hover:underline ${
                            isWatched ? "text-amber-900 hover:text-amber-700" : "text-gray-900 hover:text-blue-700"
                          }`}
                        >
                          {u.author}
                        </Link>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${(u.count / maxCount) * 100}%` }} />
                        </div>
                        <span className="text-sm font-bold text-gray-900">{u.count}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${SENT_COLORS[u.dominant_sentiment]}`}>
                          {u.dominant_sentiment}
                        </span>
                        <span className="text-xs font-semibold text-green-600">{u.positive_pct}%↑</span>
                        <span className="text-xs font-semibold text-red-600">{u.negative_pct}%↓</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`text-xs font-extrabold px-2 py-0.5 rounded-md ${getRiskColor(u.avg_risk)}`}>
                        {u.avg_risk}/10
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex gap-1 flex-wrap">
                        {u.channels.map((ch) => (
                          <span key={ch} className="text-xs font-bold bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                            {CHANNEL_LABELS[ch] || ch}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-xs font-semibold text-gray-500">
                      {timeAgo(u.last_seen)}
                    </td>
                    <td className="px-4 py-3.5">
                      <button
                        onClick={() => toggleWatch(u.author)}
                        className={`flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-lg border-2 transition-colors ${
                          isWatched
                            ? "bg-amber-100 border-amber-300 text-amber-700 hover:bg-amber-200"
                            : "border-gray-200 text-gray-500 hover:border-amber-300 hover:text-amber-600"
                        }`}
                      >
                        {isWatched ? <ShieldOff size={11} /> : <Shield size={11} />}
                        {isWatched ? "ยกเลิก" : "เฝ้าระวัง"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* How to use watchlist */}
      <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-5">
        <h3 className="text-sm font-extrabold text-blue-900 mb-2 flex items-center gap-2">
          <Shield size={15} /> วิธีใช้ระบบเฝ้าระวัง
        </h3>
        <ul className="space-y-1.5 text-xs font-semibold text-blue-800">
          <li>• กด <strong>เฝ้าระวัง</strong> ที่ผู้ใช้ที่ต้องการติดตาม — บันทึกใน browser ของคุณ</li>
          <li>• Banner แจ้งเตือนจะปรากฏด้านบนเมื่อผู้ใช้ในรายชื่อมี sentiment ลบ หรือ risk score สูง</li>
          <li>• กด <strong>เฝ้าระวังเท่านั้น</strong> เพื่อกรองดูเฉพาะผู้ใช้ที่ติดตามอยู่</li>
          <li>• ใช้ร่วมกับ <strong>fb_group_scraper.py</strong> เพื่อดึงข้อมูลทั้งกลุ่มอัตโนมัติ</li>
        </ul>
      </div>
    </div>
  );
}
