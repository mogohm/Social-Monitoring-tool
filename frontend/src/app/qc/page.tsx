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
  const color = value >= 90 ? "text-green-600" : value >= 75 ? "text-yellow-600" : "text-red-600";
  return <span className={`font-bold text-lg ${color}`}>{value}</span>;
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
        <div className="flex items-center gap-2">
          <ShieldCheck className="text-green-600" size={22} />
          <h1 className="text-xl font-bold text-gray-900">LINE OA Admin QC Dashboard</h1>
        </div>
        <select className="text-sm border rounded-lg px-3 py-1.5 bg-white" value={days} onChange={(e) => setDays(Number(e.target.value))}>
          <option value={7}>7 days</option>
          <option value={30}>30 days</option>
        </select>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-5 py-3 text-left">Admin</th>
              <th className="px-5 py-3 text-right">Chats</th>
              <th className="px-5 py-3 text-right">Avg Response</th>
              <th className="px-5 py-3 text-right">SLA Pass</th>
              <th className="px-5 py-3 text-right">Accuracy</th>
              <th className="px-5 py-3 text-right">Politeness</th>
              <th className="px-5 py-3 text-right">Score</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {data.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-12 text-gray-400">
                  No QC data yet. Connect LINE OA webhook to start collecting.
                </td>
              </tr>
            ) : (
              data.map((a, i) => (
                <tr key={a.admin_id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3 font-medium text-gray-800">
                    <span className="text-gray-400 mr-2">#{i + 1}</span>
                    {a.admin_name || a.admin_id}
                  </td>
                  <td className="px-5 py-3 text-right text-gray-600">{a.total_chats}</td>
                  <td className="px-5 py-3 text-right text-gray-600">{a.avg_response_min ? `${a.avg_response_min} min` : "—"}</td>
                  <td className={`px-5 py-3 text-right font-medium ${a.sla_pass_pct >= 90 ? "text-green-600" : "text-red-600"}`}>
                    {a.sla_pass_pct}%
                  </td>
                  <td className="px-5 py-3 text-right text-gray-600">{a.avg_accuracy}%</td>
                  <td className="px-5 py-3 text-right text-gray-600">{a.avg_politeness}%</td>
                  <td className="px-5 py-3 text-right"><ScoreBadge value={a.score} /></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
