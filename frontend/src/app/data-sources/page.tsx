export default function DataSourcesPage() {
  const sources = ["LINE OA Webhook", "Facebook Page", "YouTube Comments", "TikTok", "News RSS", "Pantip", "CSV Import"];
  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-gray-900">Data Sources</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sources.map((s) => (
          <div key={s} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">{s}</span>
            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">Configure</span>
          </div>
        ))}
      </div>
    </div>
  );
}
