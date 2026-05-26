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

const sentimentColor: Record<string, string> = {
  positive: "bg-green-100 text-green-700",
  neutral: "bg-gray-100 text-gray-600",
  negative: "bg-red-100 text-red-700",
};

const priorityColor: Record<string, string> = {
  low: "bg-blue-100 text-blue-700",
  medium: "bg-yellow-100 text-yellow-700",
  high: "bg-orange-100 text-orange-700",
  critical: "bg-red-600 text-white",
};

const channelColor: Record<string, string> = {
  facebook: "bg-blue-600",
  twitter: "bg-sky-500",
  tiktok: "bg-black",
  youtube: "bg-red-600",
  instagram: "bg-purple-600",
  line_oa: "bg-green-600",
  news: "bg-gray-600",
  pantip: "bg-orange-500",
  other: "bg-gray-400",
};

export default function MentionCard({ mention }: { mention: Mention }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`text-xs text-white px-2 py-0.5 rounded font-medium ${channelColor[mention.channel] || "bg-gray-400"}`}>
            {mention.channel?.toUpperCase()}
          </span>
          <span className={`text-xs px-2 py-0.5 rounded font-medium ${sentimentColor[mention.sentiment] || "bg-gray-100 text-gray-600"}`}>
            {mention.sentiment}
          </span>
          <span className={`text-xs px-2 py-0.5 rounded font-medium ${priorityColor[mention.priority] || "bg-gray-100 text-gray-600"}`}>
            {mention.priority}
          </span>
        </div>
        <span className="text-xs text-gray-400">{new Date(mention.created_at).toLocaleString("th-TH")}</span>
      </div>

      <div>
        <div className="text-sm font-medium text-gray-700">{mention.author || "Anonymous"}</div>
        <p className="text-sm text-gray-800 mt-1 line-clamp-3">{mention.content}</p>
      </div>

      {mention.ai_summary && (
        <div className="text-xs text-blue-700 bg-blue-50 rounded px-3 py-2">
          AI: {mention.ai_summary}
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-gray-400">
        <span>Engagement: {mention.engagement?.toLocaleString()}</span>
        <span>Risk: {mention.risk_score?.toFixed(0)}/100</span>
      </div>
    </div>
  );
}
