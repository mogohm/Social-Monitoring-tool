"use client";
import { useState } from "react";
import { api } from "@/lib/api";
import MentionCard, { MentionData } from "@/components/MentionCard";
import { Search, Plus } from "lucide-react";

const OPERATORS = ["AND", "OR", "NOT", "#hashtag", "@author", "site:domain"];

function parseQuery(q: string): string[] {
  // ดึง keywords จาก boolean query — คำที่ไม่ใช่ operator
  const terms = q.match(/"[^"]+"|[\w฀-๿]+/g) || [];
  return terms
    .map((t) => t.replace(/^"|"$/g, ""))
    .filter((t) => !["AND", "OR", "NOT"].includes(t.toUpperCase()) && t.length > 1);
}

export default function QueryBuilderPage() {
  const [query,    setQuery]   = useState("");
  const [days,     setDays]    = useState(30);
  const [channel,  setChannel] = useState("");
  const [results,  setResults] = useState<MentionData[]>([]);
  const [loading,  setLoading] = useState(false);
  const [ran,      setRan]     = useState(false);

  async function runQuery() {
    const keywords = parseQuery(query);
    if (!keywords.length) return;
    setLoading(true);
    setRan(true);
    try {
      const allResults: MentionData[] = [];
      for (const kw of keywords.slice(0, 5)) {
        const params: Record<string, string | number> = { keyword: kw, days, limit: 50 };
        if (channel) params.channel = channel;
        const { data } = await api.get("/api/mentions", { params });
        for (const m of data) {
          if (!allResults.find((r) => r.id === m.id)) allResults.push(m);
        }
      }
      // เรียง created_at ล่าสุดก่อน
      allResults.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setResults(allResults.slice(0, 100));
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  function insertOperator(op: string) {
    setQuery((q) => (q ? q + " " + op + " " : op + " "));
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Boolean Query Builder</h1>
        <p className="text-sm font-medium text-gray-600 mt-0.5">ค้นหาข้อมูลด้วย Boolean logic</p>
      </div>

      <div className="bg-white rounded-xl border-2 border-gray-200 p-6 space-y-4">
        <div>
          <label className="block text-sm font-bold text-gray-800 mb-2">Query</label>
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && e.ctrlKey) runQuery(); }}
            className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm font-semibold text-gray-900 focus:outline-none focus:border-blue-400 bg-gray-50 h-28 resize-none"
            placeholder={'ตัวอย่าง: "N8" OR "Natural8" OR poker'}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {OPERATORS.map((op) => (
            <button key={op} onClick={() => insertOperator(op)}
              className="text-xs font-extrabold bg-gray-100 hover:bg-blue-100 border-2 border-gray-200 hover:border-blue-300 text-gray-700 hover:text-blue-700 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1">
              <Plus size={10} />{op}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select value={days} onChange={(e) => setDays(Number(e.target.value))}
            className="border-2 border-gray-200 rounded-lg px-3 py-2 text-sm font-semibold text-gray-800 bg-gray-50 focus:outline-none focus:border-blue-400">
            {[7, 14, 30, 60, 90].map((d) => <option key={d} value={d}>{d} วัน</option>)}
          </select>
          <select value={channel} onChange={(e) => setChannel(e.target.value)}
            className="border-2 border-gray-200 rounded-lg px-3 py-2 text-sm font-semibold text-gray-800 bg-gray-50 focus:outline-none focus:border-blue-400">
            <option value="">ทุก Channel</option>
            {["facebook", "twitter", "tiktok", "youtube", "instagram", "line_oa", "pantip"].map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <button onClick={runQuery} disabled={loading || !query.trim()}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-bold px-6 py-2.5 rounded-xl transition-colors">
            <Search size={14} />
            {loading ? "กำลังค้นหา..." : "Run Query"}
          </button>
        </div>
      </div>

      {ran && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-gray-900">ผลลัพธ์</h2>
            <span className="text-sm font-semibold text-gray-500 bg-gray-100 px-2.5 py-0.5 rounded-full">
              {loading ? "กำลังโหลด…" : `${results.length} รายการ`}
            </span>
          </div>
          {!loading && results.length === 0 && (
            <div className="bg-white rounded-xl border-2 border-gray-200 p-10 text-center text-gray-500 font-semibold">
              ไม่พบข้อมูลที่ตรงกับ query นี้
            </div>
          )}
          <div className="space-y-3">
            {results.map((m) => <MentionCard key={m.id} mention={m} />)}
          </div>
        </div>
      )}
    </div>
  );
}
