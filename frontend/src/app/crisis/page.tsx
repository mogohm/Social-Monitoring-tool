"use client";
import { useEffect, useState } from "react";
import { fetchStats, fetchMentions } from "@/lib/api";
import { AlertTriangle, Shield, Activity } from "lucide-react";

export default function CrisisPage() {
  const [stats, setStats]       = useState<Record<string, unknown> | null>(null);
  const [criticals, setCriticals] = useState<Record<string, string | number | boolean | null>[]>([]);

  useEffect(() => {
    fetchStats(1).then(setStats).catch(() => {});
    fetchMentions({ priority: "critical", days: 1, limit: 10 }).then(setCriticals).catch(() => {});
  }, []);

  const riskScore  = stats ? Number(stats.avg_risk_score) : 0;
  const negPct     = stats ? Number(stats.negative_pct) : 0;
  const total      = stats ? Number(stats.total_mentions) : 0;
  const crisisLevel = riskScore >= 70 || negPct >= 40 ? "Critical"
    : riskScore >= 50 ? "High"
    : riskScore >= 30 ? "Medium"
    : "Low";

  const levelStyle = {
    Critical: { pill: "bg-red-600 text-white",    gauge: "bg-red-600",    border: "border-red-200 bg-red-50" },
    High:     { pill: "bg-orange-500 text-white",  gauge: "bg-orange-500", border: "border-orange-200 bg-orange-50" },
    Medium:   { pill: "bg-yellow-500 text-white",  gauge: "bg-yellow-500", border: "border-yellow-200 bg-yellow-50" },
    Low:      { pill: "bg-green-600 text-white",   gauge: "bg-green-600",  border: "border-green-200 bg-green-50" },
  }[crisisLevel];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
          <AlertTriangle className="text-red-600" size={20} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Crisis Center</h1>
          <p className="text-sm font-medium text-gray-600">Real-time crisis monitoring (last 24h)</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className={`rounded-xl border-2 p-5 text-center ${levelStyle.border}`}>
          <div className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-3">Crisis Level</div>
          <div className={`inline-block px-5 py-2 rounded-full text-lg font-extrabold ${levelStyle.pill}`}>
            {crisisLevel}
          </div>
        </div>
        <div className="bg-white rounded-xl border-2 border-gray-200 p-5 text-center">
          <div className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-2">Avg Risk Score</div>
          <div className="text-4xl font-extrabold text-gray-900">
            {riskScore}<span className="text-lg text-gray-500 font-semibold">/100</span>
          </div>
          <div className="mt-2 h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all ${levelStyle.gauge}`} style={{ width: `${riskScore}%` }} />
          </div>
        </div>
        <div className="bg-white rounded-xl border-2 border-gray-200 p-5 text-center">
          <div className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-2">Negative Rate (24h)</div>
          <div className={`text-4xl font-extrabold ${negPct >= 40 ? "text-red-600" : negPct >= 20 ? "text-orange-600" : "text-green-700"}`}>
            {negPct}%
          </div>
          <div className="text-sm font-semibold text-gray-600 mt-1">{total} total mentions</div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4">
          <Shield size={18} className="text-red-600" />
          <h2 className="text-base font-bold text-gray-900">Critical Mentions (24h)</h2>
          {criticals.length > 0 && (
            <span className="ml-auto bg-red-100 text-red-700 text-xs font-bold px-2.5 py-1 rounded-full">
              {criticals.length} issues
            </span>
          )}
        </div>
        {criticals.length === 0 ? (
          <div className="flex flex-col items-center py-12 gap-2">
            <Activity className="text-green-500" size={32} />
            <p className="text-base font-bold text-gray-700">No critical mentions in the last 24 hours</p>
            <p className="text-sm font-medium text-gray-500">System is operating normally</p>
          </div>
        ) : (
          <div className="space-y-3">
            {criticals.map((m) => (
              <div key={String(m.id)} className="border-2 border-red-200 rounded-xl p-4 bg-red-50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-extrabold text-red-700 bg-red-100 px-2.5 py-1 rounded uppercase">
                    {String(m.channel ?? "")}
                  </span>
                  <span className="text-xs font-semibold text-gray-600">
                    {new Date(String(m.created_at ?? "")).toLocaleString("th-TH")}
                  </span>
                </div>
                <p className="text-sm font-semibold text-gray-900">{String(m.content ?? "")}</p>
                {m.ai_summary && (
                  <p className="text-xs font-semibold text-red-700 mt-2 bg-red-100 rounded px-2 py-1">
                    AI: {String(m.ai_summary)}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
