import { ExternalLink, Eye } from "lucide-react";

export interface MentionData {
  id: number;
  channel: string;
  author: string;
  content: string;
  url: string | null;
  image_url: string | null;
  sentiment: string;
  emotion: string | null;
  intent: string | null;
  topic: string | null;
  priority: string;
  risk_score: number;
  engagement: number;
  likes: number;
  comments: number;
  shares: number;
  views: number;
  reach: number;
  ai_summary: string | null;
  suggested_action: string | null;
  tags: { word: string; category: string; is_negative: boolean }[];
  is_reviewed: boolean;
  created_at: string;
  published_at: string | null;
}

const sentimentStyle: Record<string, string> = {
  positive: "bg-green-100 text-green-800 border border-green-200",
  neutral:  "bg-gray-100 text-gray-700 border border-gray-200",
  negative: "bg-red-100 text-red-800 border border-red-200",
};

const priorityStyle: Record<string, string> = {
  low:      "bg-blue-100 text-blue-800",
  medium:   "bg-yellow-100 text-yellow-800",
  high:     "bg-orange-100 text-orange-800",
  critical: "bg-red-600 text-white",
};

const channelStyle: Record<string, string> = {
  facebook:          "bg-blue-700 text-white",
  facebook_comment:  "bg-blue-500 text-white",
  twitter:           "bg-sky-500 text-white",
  tiktok:    "bg-gray-900 text-white",
  youtube:   "bg-red-600 text-white",
  instagram: "bg-purple-600 text-white",
  line_oa:   "bg-green-600 text-white",
  news:      "bg-slate-600 text-white",
  pantip:    "bg-orange-500 text-white",
  webboard:  "bg-teal-600 text-white",
  other:     "bg-gray-500 text-white",
};

const catChipStyle: Record<string, string> = {
  brand:      "bg-blue-50 text-blue-700 border border-blue-200",
  product:    "bg-purple-50 text-purple-700 border border-purple-200",
  competitor: "bg-orange-50 text-orange-700 border border-orange-200",
  crisis:     "bg-red-50 text-red-700 border border-red-200",
  campaign:   "bg-green-50 text-green-700 border border-green-200",
  general:    "bg-gray-50 text-gray-700 border border-gray-200",
};

function highlightKeywords(text: string, tags: MentionData["tags"]): React.ReactNode {
  if (!tags?.length) return text;
  const words = tags.map((t) => t.word).sort((a, b) => b.length - a.length);
  const pattern = new RegExp(`(${words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
  const parts = text.split(pattern);
  return parts.map((part, i) => {
    const tag = tags.find((t) => t.word.toLowerCase() === part.toLowerCase());
    if (!tag) return part;
    return (
      <mark key={i} className={`px-0.5 rounded font-bold not-italic ${tag.is_negative ? "bg-red-200 text-red-900" : "bg-yellow-200 text-yellow-900"}`}>
        {part}
      </mark>
    );
  });
}

interface Props {
  mention: MentionData;
  onViewDetail?: (m: MentionData) => void;
}

export default function MentionCard({ mention, onViewDetail }: Props) {
  // Filter to valid keyword tags only — exclude metadata objects like {image_urls:[...]}
  const tags: MentionData["tags"] = Array.isArray(mention.tags)
    ? (mention.tags as any[]).filter((t) => typeof t?.word === "string")
    : [];
  // Use image_url if available, otherwise fall back to first image in tags metadata
  const imageSrc: string | null =
    mention.image_url ||
    (() => {
      if (!Array.isArray(mention.tags)) return null;
      const meta = (mention.tags as any[]).find((t) => Array.isArray(t?.image_urls));
      return meta?.image_urls?.[0] ?? null;
    })();

  return (
    <div className={`bg-white rounded-xl border-2 shadow-sm p-4 space-y-3 hover:shadow-md transition-shadow ${mention.priority === "critical" ? "border-red-300" : "border-gray-200"}`}>
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Channel badge — clickable if URL present */}
          {mention.url ? (
            <a href={mention.url} target="_blank" rel="noopener noreferrer"
              className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-md font-extrabold hover:opacity-80 transition-opacity ${channelStyle[mention.channel] || "bg-gray-500 text-white"}`}
              title={`Open original on ${mention.channel}`}>
              {mention.channel.toUpperCase()}
              <ExternalLink size={10} />
            </a>
          ) : (
            <span className={`text-xs px-2.5 py-1 rounded-md font-extrabold ${channelStyle[mention.channel] || "bg-gray-500 text-white"}`}>
              {mention.channel.toUpperCase()}
            </span>
          )}
          <span className={`text-xs px-2.5 py-1 rounded-md font-semibold ${sentimentStyle[mention.sentiment] || "bg-gray-100 text-gray-700"}`}>
            {mention.sentiment}
          </span>
          <span className={`text-xs px-2.5 py-1 rounded-md font-semibold ${priorityStyle[mention.priority] || "bg-gray-100 text-gray-700"}`}>
            {mention.priority}
          </span>
          {mention.is_reviewed && (
            <span className="text-xs px-2 py-0.5 rounded font-semibold bg-teal-50 text-teal-700 border border-teal-200">✓ reviewed</span>
          )}
        </div>
        <span className="text-xs font-medium text-gray-500 shrink-0">
          {new Date(mention.created_at).toLocaleString("th-TH")}
        </span>
      </div>

      {/* Author + content */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-extrabold text-gray-900">{mention.author || "Anonymous"}</span>
          {mention.url && (
            <a href={mention.url} target="_blank" rel="noopener noreferrer"
              className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 hover:underline">
              ดูต้นทาง <ExternalLink size={11} />
            </a>
          )}
        </div>
        {/* Post image */}
        {imageSrc && (
          <div className="mb-2 rounded-lg overflow-hidden border border-gray-200 max-h-52">
            <img
              src={imageSrc}
              alt="post image"
              referrerPolicy="no-referrer"
              className="w-full object-cover max-h-52"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          </div>
        )}
        <p className="text-sm font-medium text-gray-800 leading-relaxed line-clamp-3">
          {highlightKeywords(mention.content, tags)}
        </p>
      </div>

      {/* Matched keyword chips */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <span className="text-xs font-bold text-gray-500">Keywords:</span>
          {tags.map((t, i) => (
            <span key={i} className={`text-xs px-2 py-0.5 rounded-md font-bold ${catChipStyle[t.category] || catChipStyle.general}`}>
              #{t.word}
              {t.is_negative && <span className="ml-1 text-red-500">⚠</span>}
            </span>
          ))}
        </div>
      )}

      {/* AI summary */}
      {mention.ai_summary && (
        <div className="text-xs font-semibold text-blue-800 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
          <span className="font-extrabold text-blue-600">AI: </span>{mention.ai_summary}
        </div>
      )}

      {/* Footer: stats + actions */}
      <div className="flex items-center justify-between pt-2 border-t border-gray-100">
        <div className="flex items-center gap-3 text-xs font-semibold text-gray-600">
          {mention.likes  > 0 && <span>👍 {mention.likes.toLocaleString()}</span>}
          {mention.comments > 0 && <span>💬 {mention.comments.toLocaleString()}</span>}
          {mention.shares > 0 && <span>🔄 {mention.shares.toLocaleString()}</span>}
          {mention.views  > 0 && <span>👁 {mention.views.toLocaleString()}</span>}
          {mention.likes === 0 && mention.comments === 0 && (
            <span>Engagement: <span className="text-gray-900">{mention.engagement.toLocaleString()}</span></span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold ${mention.risk_score >= 60 ? "text-red-600" : "text-gray-500"}`}>
            Risk {mention.risk_score?.toFixed(0)}/100
          </span>
          {onViewDetail && (
            <button
              onClick={() => onViewDetail(mention)}
              className="flex items-center gap-1 text-xs font-bold bg-gray-100 hover:bg-blue-100 text-gray-700 hover:text-blue-700 px-2.5 py-1 rounded-lg transition-colors"
            >
              <Eye size={11} /> รายละเอียด
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
