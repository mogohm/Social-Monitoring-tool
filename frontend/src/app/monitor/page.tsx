"use client";
import { useEffect, useState, useRef } from "react";
import { api } from "@/lib/api";
import { Activity, Clock, Database, RefreshCw, Wifi, WifiOff, AlertTriangle, CheckCircle, TrendingUp } from "lucide-react";

interface ScraperStatus {
  enabled: boolean;
  interval_minutes: number;
  last_run_at: string | null;
  last_posts_count: number;
  last_duration_seconds: number;
}

interface Mention {
  id: number;
  channel: string;
  author: string;
  content: string;
  sentiment: string;
  risk_score: number;
  priority: string;
  topic: string;
  tags: { word: string; is_negative: boolean }[] | null;
  published_at: string;
  created_at: string;
}

function secondsAgo(iso: string | null): string {
  if (!iso) return "ไม่ทราบ";
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff} วินาทีที่แล้ว`;
  if (diff < 3600) return `${Math.floor(diff / 60)} นาทีที่แล้ว`;
  return `${Math.floor(diff / 3600)} ชั่วโมงที่แล้ว`;
}

function nextRunIn(lastRun: string | null, intervalMin: number): string {
  if (!lastRun) return "—";
  const next = new Date(lastRun).getTime() + intervalMin * 60 * 1000;
  const diff = Math.floor((next - Date.now()) / 1000);
  if (diff <= 0) return "กำลังจะรันเร็วๆ นี้...";
  const m = Math.floor(diff / 60);
  const s = diff % 60;
  return m > 0 ? `${m}:${String(s).padStart(2, "0")} นาที` : `${s} วินาที`;
}

const PRIORITY_COLOR: Record<string, string> = {
  critical: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-yellow-500",
  low: "bg-gray-400",
};
const SENTIMENT_COLOR: Record<string, string> = {
  negative: "text-red-500",
  positive: "text-green-500",
  neutral: "text-gray-400",
};

export default function MonitorPage() {
  const [scraper, setScraper] = useState<ScraperStatus | null>(null);
  const [mentions, setMentions] = useState<Mention[]>([]);
  const [totalToday, setTotalToday] = useState(0);
  const [tick, setTick] = useState(0);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [online, setOnline] = useState(true);
  const prevIds = useRef<Set<number>>(new Set());
  const [newIds, setNewIds] = useState<Set<number>>(new Set());

  const ADMIN_TOKEN =
    typeof window !== "undefined" ? sessionStorage.getItem("adminToken") ?? "" : "";

  async function load() {
    try {
      const [scraperRes, mentionsRes, statsRes] = await Promise.all([
        api.get("/api/admin/scraper", { headers: { "X-Admin-Token": ADMIN_TOKEN } }),
        api.get("/api/mentions", { params: { limit: 20, days: 1 } }),
        api.get("/api/mentions/stats?days=1"),
      ]);
      setScraper(scraperRes.data);
      const incoming: Mention[] = mentionsRes.data;
      const fresh = new Set(incoming.map((m) => m.id).filter((id) => !prevIds.current.has(id)));
      setNewIds(fresh);
      prevIds.current = new Set(incoming.map((m) => m.id));
      setMentions(incoming);
      setTotalToday(statsRes.data?.total_mentions ?? 0);
      setOnline(true);
      setLastRefresh(new Date());
      setTimeout(() => setNewIds(new Set()), 3000);
    } catch {
      setOnline(false);
    }
  }

  useEffect(() => {
    load();
    const dataInterval = setInterval(load, 15000);
    const tickInterval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => {
      clearInterval(dataInterval);
      clearInterval(tickInterval);
    };
  }, []);

  const isRunning = scraper?.enabled && scraper?.last_run_at
    ? (Date.now() - new Date(scraper.last_run_at).getTime()) < (scraper.interval_minutes + 2) * 60 * 1000
    : false;

  return (
    <div className="p-6 space-y-6 min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Activity size={24} className="text-blue-500" />
            Live Monitor
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">ติดตามการทำงานของ scraper แบบ real-time</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-sm">
            {online ? (
              <><Wifi size={14} className="text-green-500" /><span className="text-green-600 dark:text-green-400">ออนไลน์</span></>
            ) : (
              <><WifiOff size={14} className="text-red-500" /><span className="text-red-500">ออฟไลน์</span></>
            )}
          </span>
          <button onClick={load} className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
            <RefreshCw size={13} />
            รีเฟรช
          </button>
          <span className="text-xs text-gray-400">อัพเดทล่าสุด {lastRefresh.toLocaleTimeString("th-TH")}</span>
        </div>
      </div>

      {/* Scraper Status Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Status */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">สถานะ Scraper</span>
            <span className={`w-2.5 h-2.5 rounded-full ${isRunning ? "bg-green-500 animate-pulse" : "bg-gray-400"}`} />
          </div>
          <div className={`text-xl font-bold ${isRunning ? "text-green-600 dark:text-green-400" : "text-gray-500"}`}>
            {scraper == null ? "..." : isRunning ? "กำลังทำงาน" : scraper.enabled ? "รอรอบถัดไป" : "หยุดทำงาน"}
          </div>
          <div className="text-xs text-gray-400 mt-1">
            ทุก {scraper?.interval_minutes ?? "—"} นาที
          </div>
        </div>

        {/* Last Run */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
          <div className="flex items-center gap-1.5 mb-3">
            <Clock size={13} className="text-gray-400" />
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">รอบล่าสุด</span>
          </div>
          <div className="text-base font-bold text-gray-900 dark:text-white">
            {secondsAgo(scraper?.last_run_at ?? null)}
          </div>
          <div className="text-xs text-gray-400 mt-1">
            {scraper?.last_run_at ? new Date(scraper.last_run_at).toLocaleTimeString("th-TH") : "—"}
            {scraper?.last_duration_seconds ? ` · ${Math.round(scraper.last_duration_seconds)}s` : ""}
          </div>
        </div>

        {/* Next Run */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
          <div className="flex items-center gap-1.5 mb-3">
            <RefreshCw size={13} className="text-gray-400" />
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">รอบถัดไปใน</span>
          </div>
          <div className="text-xl font-bold text-blue-600 dark:text-blue-400 font-mono">
            {scraper ? nextRunIn(scraper.last_run_at, scraper.interval_minutes) : "..."}
          </div>
          <div className="text-xs text-gray-400 mt-1">
            โพสต์ล่าสุด {scraper?.last_posts_count ?? "—"} โพสต์
          </div>
        </div>

        {/* Today total */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
          <div className="flex items-center gap-1.5 mb-3">
            <Database size={13} className="text-gray-400" />
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">วันนี้</span>
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{totalToday}</div>
          <div className="text-xs text-gray-400 mt-1">mentions เก็บได้วันนี้</div>
        </div>
      </div>

      {/* Live Feed */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <TrendingUp size={16} className="text-blue-500" />
            <span className="font-semibold text-gray-900 dark:text-white">โพสต์ล่าสุด (24 ชั่วโมง)</span>
            <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-2 py-0.5 rounded-full font-medium">
              {mentions.length} รายการ
            </span>
          </div>
          <span className="text-xs text-gray-400 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse inline-block" />
            auto-refresh ทุก 15 วิ
          </span>
        </div>

        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {mentions.length === 0 && (
            <div className="py-12 text-center text-gray-400 text-sm">ยังไม่มีข้อมูล</div>
          )}
          {mentions.map((m) => (
            <div
              key={m.id}
              className={`px-5 py-3.5 flex gap-4 items-start transition-colors ${
                newIds.has(m.id) ? "bg-blue-50 dark:bg-blue-900/10" : "hover:bg-gray-50 dark:hover:bg-gray-800/50"
              }`}
            >
              {/* Priority dot */}
              <div className="mt-1.5 flex-shrink-0">
                <span className={`w-2 h-2 rounded-full block ${PRIORITY_COLOR[m.priority] ?? "bg-gray-300"}`} />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="text-xs font-semibold bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded uppercase">
                    {m.channel}
                  </span>
                  {newIds.has(m.id) && (
                    <span className="text-xs bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 px-1.5 py-0.5 rounded font-semibold animate-pulse">
                      ใหม่
                    </span>
                  )}
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{m.author}</span>
                  <span className={`text-xs font-semibold ${SENTIMENT_COLOR[m.sentiment] ?? "text-gray-400"}`}>
                    {m.sentiment === "negative" ? "ลบ" : m.sentiment === "positive" ? "บวก" : "กลาง"}
                  </span>
                  {m.risk_score > 0 && (
                    <span className={`text-xs font-bold ${m.risk_score >= 70 ? "text-red-500" : m.risk_score >= 40 ? "text-orange-500" : "text-gray-400"}`}>
                      Risk {m.risk_score}
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2 leading-snug">{m.content}</p>
                {m.tags && m.tags.length > 0 && (
                  <div className="flex gap-1 flex-wrap mt-1.5">
                    {m.tags.slice(0, 5).map((t, i) => (
                      <span
                        key={i}
                        className={`text-xs px-1.5 py-0.5 rounded ${
                          t.is_negative
                            ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
                            : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
                        }`}
                      >
                        #{t.word}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Time */}
              <div className="text-xs text-gray-400 flex-shrink-0 mt-0.5 text-right">
                {new Date(m.created_at).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}
                <div className="text-gray-300 dark:text-gray-600 mt-0.5">
                  {new Date(m.created_at).toLocaleDateString("th-TH", { day: "numeric", month: "short" })}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
