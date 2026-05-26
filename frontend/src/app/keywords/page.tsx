"use client";
import { useEffect, useState, useRef } from "react";
import { api } from "@/lib/api";
import { Tag, Plus, Trash2, RefreshCw, BarChart2, AlertCircle } from "lucide-react";

interface Keyword {
  id: number;
  word: string;
  category: string | null;
  is_negative: boolean;
  is_active: boolean;
  match_count: number;
  mention_count?: number;
  created_at: string;
}

const CATEGORIES = ["brand", "product", "competitor", "crisis", "campaign", "general"];

export default function KeywordsPage() {
  const [keywords, setKeywords]   = useState<Keyword[]>([]);
  const [loading, setLoading]     = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [newWord, setNewWord]     = useState("");
  const [newCat, setNewCat]       = useState("brand");
  const [isNeg, setIsNeg]         = useState(false);
  const [adding, setAdding]       = useState(false);
  const [error, setError]         = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/api/keywords");
      setKeywords(data);
    } catch { /* */ } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    setStatsLoading(true);
    try {
      const { data } = await api.get("/api/keywords/stats");
      setKeywords(data);
    } catch { /* */ } finally {
      setStatsLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const addKeyword = async () => {
    setError("");
    const word = newWord.trim();
    if (!word) return;
    setAdding(true);
    try {
      await api.post("/api/keywords", { word, category: newCat, is_negative: isNeg });
      setNewWord("");
      setIsNeg(false);
      await load();
      inputRef.current?.focus();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Error adding keyword";
      setError(String(msg));
    } finally {
      setAdding(false);
    }
  };

  const toggleActive = async (kw: Keyword) => {
    await api.patch(`/api/keywords/${kw.id}`, { is_active: !kw.is_active });
    await load();
  };

  const deleteKeyword = async (id: number) => {
    if (!confirm("Delete this keyword?")) return;
    await api.delete(`/api/keywords/${id}`);
    await load();
  };

  const catColor: Record<string, string> = {
    brand:      "bg-blue-100 text-blue-800 border border-blue-200",
    product:    "bg-purple-100 text-purple-800 border border-purple-200",
    competitor: "bg-orange-100 text-orange-800 border border-orange-200",
    crisis:     "bg-red-100 text-red-800 border border-red-200",
    campaign:   "bg-green-100 text-green-800 border border-green-200",
    general:    "bg-gray-100 text-gray-700 border border-gray-200",
  };

  const active   = keywords.filter((k) => k.is_active);
  const inactive = keywords.filter((k) => !k.is_active);
  const negative = keywords.filter((k) => k.is_negative && k.is_active);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
            <Tag className="text-indigo-600" size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Keyword Management</h1>
            <p className="text-sm font-medium text-gray-600">
              {active.length} active · {negative.length} negative · {keywords.length} total
            </p>
          </div>
        </div>
        <button
          onClick={loadStats}
          disabled={statsLoading}
          className="flex items-center gap-2 text-sm font-bold bg-white border-2 border-gray-200 hover:border-blue-300 text-gray-700 hover:text-blue-700 px-4 py-2 rounded-xl transition-colors"
        >
          <BarChart2 size={15} className={statsLoading ? "animate-pulse" : ""} />
          Refresh Stats
        </button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border-2 border-blue-200 rounded-xl p-4 text-center">
          <div className="text-3xl font-extrabold text-blue-700">{active.length}</div>
          <div className="text-xs font-bold text-gray-600 uppercase tracking-wide mt-1">Active Keywords</div>
        </div>
        <div className="bg-white border-2 border-red-200 rounded-xl p-4 text-center">
          <div className="text-3xl font-extrabold text-red-700">{negative.length}</div>
          <div className="text-xs font-bold text-gray-600 uppercase tracking-wide mt-1">Negative Keywords</div>
        </div>
        <div className="bg-white border-2 border-green-200 rounded-xl p-4 text-center">
          <div className="text-3xl font-extrabold text-green-700">
            {keywords.reduce((s, k) => s + (k.mention_count ?? k.match_count), 0).toLocaleString()}
          </div>
          <div className="text-xs font-bold text-gray-600 uppercase tracking-wide mt-1">Total Matches</div>
        </div>
      </div>

      {/* Add keyword form */}
      <div className="bg-white rounded-xl border-2 border-gray-200 p-5">
        <h2 className="text-base font-extrabold text-gray-900 mb-4 flex items-center gap-2">
          <Plus size={16} className="text-blue-600" /> Add New Keyword
        </h2>
        <div className="flex flex-wrap gap-3">
          <input
            ref={inputRef}
            value={newWord}
            onChange={(e) => { setNewWord(e.target.value); setError(""); }}
            onKeyDown={(e) => e.key === "Enter" && addKeyword()}
            placeholder="e.g. N8, Poker, natural8"
            className="flex-1 min-w-[180px] border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-900 focus:outline-none focus:border-blue-400 placeholder:text-gray-400"
          />
          <select
            value={newCat}
            onChange={(e) => setNewCat(e.target.value)}
            className="border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm font-semibold text-gray-800 focus:outline-none focus:border-blue-400 bg-white"
          >
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <label className="flex items-center gap-2 border-2 border-gray-200 rounded-xl px-4 py-2.5 cursor-pointer hover:bg-gray-50 transition-colors">
            <input type="checkbox" checked={isNeg} onChange={(e) => setIsNeg(e.target.checked)} className="w-4 h-4 accent-red-600" />
            <span className="text-sm font-bold text-gray-700">Negative</span>
          </label>
          <button
            onClick={addKeyword}
            disabled={adding || !newWord.trim()}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-bold px-5 py-2.5 rounded-xl transition-colors"
          >
            <Plus size={14} />
            {adding ? "Adding..." : "Add Keyword"}
          </button>
        </div>
        {error && (
          <div className="flex items-center gap-2 mt-3 text-sm font-semibold text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
            <AlertCircle size={14} />
            {error}
          </div>
        )}
      </div>

      {/* Keyword list */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-base font-extrabold text-gray-900">Keyword List</h2>
          <button onClick={load} className="text-xs font-bold text-gray-500 hover:text-blue-600 flex items-center gap-1.5 transition-colors">
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} /> Refresh
          </button>
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-500 font-semibold">Loading...</div>
        ) : keywords.length === 0 ? (
          <div className="text-center py-12 text-gray-500 font-semibold">No keywords yet. Add your first keyword above.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-bold text-gray-700 uppercase">Keyword</th>
                <th className="px-5 py-3 text-left text-xs font-bold text-gray-700 uppercase">Category</th>
                <th className="px-5 py-3 text-left text-xs font-bold text-gray-700 uppercase">Type</th>
                <th className="px-5 py-3 text-right text-xs font-bold text-gray-700 uppercase">Matches</th>
                <th className="px-5 py-3 text-center text-xs font-bold text-gray-700 uppercase">Active</th>
                <th className="px-5 py-3 text-center text-xs font-bold text-gray-700 uppercase">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {[...active, ...inactive].map((kw) => (
                <tr key={kw.id} className={`transition-colors ${kw.is_active ? "hover:bg-gray-50" : "opacity-50 bg-gray-50"}`}>
                  <td className="px-5 py-3.5">
                    <span className="text-sm font-extrabold text-gray-900">{kw.word}</span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-md ${catColor[kw.category ?? "general"] ?? catColor.general}`}>
                      {kw.category ?? "general"}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    {kw.is_negative
                      ? <span className="text-xs font-bold text-red-700 bg-red-100 px-2.5 py-1 rounded-md border border-red-200">Negative</span>
                      : <span className="text-xs font-bold text-blue-700 bg-blue-100 px-2.5 py-1 rounded-md border border-blue-200">Monitor</span>
                    }
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <span className="text-sm font-extrabold text-gray-900">
                      {(kw.mention_count ?? kw.match_count).toLocaleString()}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-center">
                    <button
                      onClick={() => toggleActive(kw)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${kw.is_active ? "bg-blue-600" : "bg-gray-300"}`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${kw.is_active ? "translate-x-6" : "translate-x-1"}`} />
                    </button>
                  </td>
                  <td className="px-5 py-3.5 text-center">
                    <button
                      onClick={() => deleteKeyword(kw.id)}
                      className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1.5 rounded-lg transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
