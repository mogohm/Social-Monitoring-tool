"use client";
import { useEffect, useState } from "react";
import { fetchStats, fetchMentions } from "@/lib/api";
import { AlertTriangle, Shield } from "lucide-react";

export default function CrisisPage() {
  const [stats, setStats] = useState<Record<string, unknown> | null>(null);
  const [criticals, setCriticals] = useState<Record<string, string | number | boolean | null>[]>([]);

  useEffect(() => {
    fetchStats(1).then(setStats).catch(() => {});
    fetchMentions({ priority: "critical", days: 1, limit: 10 }).then(setCriticals).catch(() => {});
  }, []);

  const riskScore = stats ? Number(stats.avg_risk_score) : 0;
  const negPct = stats ? Number(stats.negative_pct) : 0;
  const crisisLevel = riskScore >= 70 || negPct >= 40 ? "Critical" : riskScore >= 50 ? "High" : riskScore >= 30 ? "Medium" : "Low";
  const levelColor = { Critical: "text-red-600 bg-red-50", High: "text-orange-600 bg-orange-50", Medium: "text-yellow-600 bg-yellow-50", Low: "text-green-600 bg-green-50" };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <AlertTriangle className="text-red-500" size={22} />
        <h1 className="text-xl font-bold text-gray-900">Crisis Center</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 text-center">
          <div className="text-xs text-gray-500 uppercase mb-2">Crisis Level (24h)</div>
          <div className={`inline-block px-4 py-1.5 rounded-full text-lg font-bold ${levelColor[crisisLevel as keyof typeof levelColor]}`}>
            {crisisLevel}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 text-center">
          <div className="text-xs text-gray-500 uppercase mb-2">Avg Risk Score</div>
          <div className="text-3xl font-bold text-gray-800">{riskScore}<span className="text-base text-gray-400">/100</span></div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 text-center">
          <div className="text-xs text-gray-500 uppercase mb-2">Negative Rate (24h)</div>
          <div className="text-3xl font-bold text-red-600">{negPct}%</div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4">
          <Shield size={16} className="text-red-500" />
          <h2 className="text-sm font-semibold text-gray-700">Critical Mentions (24h)</h2>
        </div>
        {criticals.length === 0 ? (
          <div className="text-center py-10 text-gray-400">No critical mentions in the last 24 hours.</div>
        ) : (
          <div className="space-y-3">
            {criticals.map((m) => (
              <div key={String(m.id)} className="border border-red-100 rounded-lg p-3 bg-red-50">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-red-700 uppercase">{String(m.channel)}</span>
                  <span className="text-xs text-gray-400">{new Date(String(m.created_at)).toLocaleString("th-TH")}</span>
                </div>
                <p className="text-sm text-gray-800">{String(m.content ?? "")}</p>
                {m.ai_summary && <p className="text-xs text-red-600 mt-1">AI: {String(m.ai_summary ?? "")}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
