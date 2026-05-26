export default function CompetitorsPage() {
  const mockData = [
    { brand: "Our Brand", mentions: 12500, positive: "61%", negative: "14%", engagement: "820K", sov: "42%" },
    { brand: "Competitor A", mentions: 9800, positive: "55%", negative: "21%", engagement: "710K", sov: "33%" },
    { brand: "Competitor B", mentions: 7200, positive: "48%", negative: "29%", engagement: "480K", sov: "25%" },
  ];
  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-gray-900">Competitor Benchmark</h1>
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              {["Brand", "Mentions", "Positive", "Negative", "Engagement", "Share of Voice"].map((h) => (
                <th key={h} className="px-5 py-3 text-left">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {mockData.map((r, i) => (
              <tr key={r.brand} className={i === 0 ? "bg-blue-50" : "hover:bg-gray-50"}>
                <td className="px-5 py-3 font-medium text-gray-800">{r.brand}</td>
                <td className="px-5 py-3 text-gray-600">{r.mentions.toLocaleString()}</td>
                <td className="px-5 py-3 text-green-600 font-medium">{r.positive}</td>
                <td className="px-5 py-3 text-red-600 font-medium">{r.negative}</td>
                <td className="px-5 py-3 text-gray-600">{r.engagement}</td>
                <td className="px-5 py-3 text-blue-600 font-bold">{r.sov}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
