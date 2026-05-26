export default function TopicsPage() {
  const topics = [
    { topic: "Poker Card Game",   count: 234, trend: "+45%", sentiment: "neutral" },
    { topic: "N8 Thailand",       count: 189, trend: "+120%", sentiment: "positive" },
    { topic: "Natural8 Bonus",    count: 156, trend: "+28%",  sentiment: "positive" },
    { topic: "Slow Withdrawal",   count:  98, trend: "+80%",  sentiment: "negative" },
    { topic: "N8TH Promotion",    count:  87, trend: "+15%",  sentiment: "positive" },
  ];
  const sentColor: Record<string, string> = {
    positive: "text-green-700 bg-green-100", neutral: "text-gray-700 bg-gray-100", negative: "text-red-700 bg-red-100",
  };
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Topics &amp; Trends</h1>
        <p className="text-sm font-medium text-gray-600 mt-0.5">Emerging topics from keyword monitoring</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 border-b border-gray-200">
            <tr>
              {["#", "Topic", "Mentions", "Trend (24h)", "Sentiment"].map((h) => (
                <th key={h} className="px-5 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {topics.map((t, i) => (
              <tr key={t.topic} className="hover:bg-gray-50 transition-colors">
                <td className="px-5 py-4 text-sm font-bold text-gray-500">#{i + 1}</td>
                <td className="px-5 py-4 text-sm font-extrabold text-gray-900">{t.topic}</td>
                <td className="px-5 py-4 text-sm font-bold text-gray-800">{t.count.toLocaleString()}</td>
                <td className="px-5 py-4 text-sm font-extrabold text-green-700">{t.trend}</td>
                <td className="px-5 py-4">
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-md ${sentColor[t.sentiment]}`}>{t.sentiment}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-5">
        <h3 className="text-sm font-extrabold text-blue-800 mb-1">Connect OpenAI for AI-powered clustering</h3>
        <p className="text-sm font-semibold text-blue-700">Add OPENAI_API_KEY in backend/.env to enable automatic topic clustering and trend explanation.</p>
      </div>
    </div>
  );
}
