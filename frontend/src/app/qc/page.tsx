"use client";
import { useEffect, useState } from "react";
import { fetchQCScoreboard } from "@/lib/api";
import { ShieldCheck } from "lucide-react";

interface AdminScore {
  admin_id: string;
  admin_name: string;
  total_chats: number;
  avg_response_min: number;
  sla_pass_pct: number;
  avg_politeness: number;
  avg_accuracy: number;
  score: number;
}

function ScoreBadge({ value }: { value: number }) {
  const cls = value >= 90 ? "text-green-700 bg-green-100 border border-green-200"
    : value >= 75 ? "text-yellow-800 bg-yellow-100 border border-yellow-200"
    : "text-red-700 bg-red-100 border border-red-200";
  return (
    <span className={`inline-block px-2.5 py-1 rounded-lg text-sm font-bold ${cls}`}>
      {value}
    </span>
  );
}

export default function QCPage() {
  const [data, setData] = useState<AdminScore[]>([]);
  const [days, setDays] = useState(7);

  useEffect(() => {
    fetchQCScoreboard(days).then(setData).catch(() => {});
  }, [days]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
            <ShieldCheck className="text-green-700" size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">LINE OA Admin QC</h1>
            <p className="text-sm font-medium text-gray-600">Admin performance scoreboard</p>
          </div>
        </div>
        <select
          className="text-sm font-semibold border-2 border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-800 focus:outline-none"
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
        >
          <option value={7}>7 days</option>
          <option value={30}>30 days</option>
        </select>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 border-b border-gray-200">
            <tr>
              {["#", "Admin", "Chats", "Avg Response", "SLA Pass", "Accuracy", "Politeness", "Score"].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-14 text-gray-500 font-semibold">
                  No QC data yet. Connect LINE OA webhook to start collecting.
                </td>
              </tr>
            ) : (
              data.map((a, i) => (
                <tr key={a.admin_id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-sm font-bold text-gray-500">#{i + 1}</td>
                  <td className="px-4 py-3 text-sm font-bold text-gray-900">{a.admin_name || a.admin_id}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-gray-800">{a.total_chats}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-gray-800">
                    {a.avg_response_min ? `${a.avg_response_min} min` : "—"}
                  </td>
                  <td className={`px-4 py-3 text-sm font-bold ${a.sla_pass_pct >= 90 ? "text-green-700" : "text-red-700"}`}>
                    {a.sla_pass_pct}%
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold text-gray-800">{a.avg_accuracy}%</td>
                  <td className="px-4 py-3 text-sm font-semibold text-gray-800">{a.avg_politeness}%</td>
                  <td className="px-4 py-3"><ScoreBadge value={a.score} /></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
