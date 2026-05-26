interface Mention {
  id: number;
  channel: string;
  author: string;
  content: string;
  sentiment: string;
  priority: string;
  risk_score: number;
  engagement: number;
  ai_summary: string;
  created_at: string;
}

const sentimentStyle: Record<string, string> = {
  positive: "bg-green-100 text-green-800 border border-green-200",
  neutral:  "bg-gray-100 text-gray-700 border border-gray-200",
  negative: "bg-red-100 text-red-800 border border-red-200",
};

const priorityStyle: Record<string, string> = {
  low:      "bg-blue-100 text-blue-800 border border-blue-200",
  medium:   "bg-yellow-100 text-yellow-800 border border-yellow-200",
  high:     "bg-orange-100 text-orange-800 border border-orange-200",
  critical: "bg-red-600 text-white",
};

const channelStyle: Record<string, string> = {
  facebook:  "bg-blue-700 text-white",
  twitter:   "bg-sky-500 text-white",
  tiktok:    "bg-gray-900 text-white",
  youtube:   "bg-red-600 text-white",
  instagram: "bg-purple-600 text-white",
  line_oa:   "bg-green-600 text-white",
  news:      "bg-slate-600 text-white",
  pantip:    "bg-orange-500 text-white",
  webboard:  "bg-teal-600 text-white",
  other:     "bg-gray-500 text-white",
};

export default function MentionCard({ mention }: { mention: Mention }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-3 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-xs px-2.5 py-1 rounded-md font-semibold ${channelStyle[mention.channel] || "bg-gray-500 text-white"}`}>
            {mention.channel?.toUpperCase()}
          </span>
          <span className={`text-xs px-2.5 py-1 rounded-md font-semibold ${sentimentStyle[mention.sentiment] || "bg-gray-100 text-gray-700"}`}>
            {mention.sentiment}
          </span>
          <span className={`text-xs px-2.5 py-1 rounded-md font-semibold ${priorityStyle[mention.priority] || "bg-gray-100 text-gray-700"}`}>
            {mention.priority}
          </span>
        </div>
        <span className="text-xs font-medium text-gray-500">
          {new Date(mention.created_at).toLocaleString("th-TH")}
        </span>
      </div>

      <div>
        <div className="text-sm font-bold text-gray-900">{mention.author || "Anonymous"}</div>
        <p className="text-sm text-gray-800 mt-1 leading-relaxed line-clamp-3">{mention.content}</p>
      </div>

      {mention.ai_summary && (
        <div className="text-xs font-medium text-blue-800 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
          <span className="font-bold text-blue-600">AI: </span>{mention.ai_summary}
        </div>
      )}

      <div className="flex items-center justify-between text-xs font-semibold text-gray-600 pt-1 border-t border-gray-100">
        <span>Engagement: <span className="text-gray-900">{mention.engagement?.toLocaleString()}</span></span>
        <span>Risk: <span className={mention.risk_score >= 60 ? "text-red-600" : "text-gray-900"}>{mention.risk_score?.toFixed(0)}/100</span></span>
      </div>
    </div>
  );
}
