export default function CompetitorsPage() {
  const data = [
    { brand: "Our Brand (N8)", mentions: 12500, positive: "61%", negative: "14%", engagement: "820K", sov: "42%", isSelf: true },
    { brand: "Competitor A",   mentions:  9800, positive: "55%", negative: "21%", engagement: "710K", sov: "33%", isSelf: false },
    { brand: "Competitor B",   mentions:  7200, positive: "48%", negative: "29%", engagement: "480K", sov: "25%", isSelf: false },
  ];
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Competitor Benchmark</h1>
        <p className="text-sm font-medium text-gray-600 mt-0.5">Share of Voice & engagement comparison</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 border-b border-gray-200">
            <tr>
              {["Brand", "Mentions", "Positive", "Negative", "Engagement", "Share of Voice"].map((h) => (
                <th key={h} className="px-5 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data.map((r) => (
              <tr key={r.brand} className={r.isSelf ? "bg-blue-50" : "hover:bg-gray-50 transition-colors"}>
                <td className="px-5 py-4">
                  <span className={`text-sm font-bold ${r.isSelf ? "text-blue-800" : "text-gray-900"}`}>{r.brand}</span>
                  {r.isSelf && <span className="ml-2 text-xs bg-blue-600 text-white px-2 py-0.5 rounded font-bold">YOU</span>}
                </td>
                <td className="px-5 py-4 text-sm font-bold text-gray-900">{r.mentions.toLocaleString()}</td>
                <td className="px-5 py-4 text-sm font-bold text-green-700">{r.positive}</td>
                <td className="px-5 py-4 text-sm font-bold text-red-700">{r.negative}</td>
                <td className="px-5 py-4 text-sm font-bold text-gray-800">{r.engagement}</td>
                <td className="px-5 py-4">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-600 rounded-full" style={{ width: r.sov }} />
                    </div>
                    <span className="text-sm font-extrabold text-blue-700 w-10 text-right">{r.sov}</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
