export default function QueryBuilderPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Boolean Query Builder</h1>
        <p className="text-sm font-medium text-gray-600 mt-0.5">Build advanced search queries for monitoring</p>
      </div>
      <div className="bg-white rounded-xl border-2 border-gray-200 p-6 space-y-4">
        <div>
          <label className="block text-sm font-bold text-gray-800 mb-2">Query</label>
          <textarea
            className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm font-semibold text-gray-900 focus:outline-none focus:border-blue-400 bg-gray-50 h-28"
            placeholder={'Example: ("N8" OR "Natural8" OR "N8TH") AND ("poker" OR "card") NOT "spam"'}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {["AND", "OR", "NOT", "#hashtag", "@author", "site:domain"].map((op) => (
            <button key={op} className="text-xs font-extrabold bg-gray-100 hover:bg-blue-100 border-2 border-gray-200 hover:border-blue-300 text-gray-700 hover:text-blue-700 px-3 py-1.5 rounded-lg transition-colors">
              {op}
            </button>
          ))}
        </div>
        <button className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold px-6 py-2.5 rounded-xl transition-colors">
          Run Query
        </button>
      </div>
    </div>
  );
}
