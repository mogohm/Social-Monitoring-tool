import { Bell, Zap, TrendingDown, User } from "lucide-react";

const alertTypes = [
  { icon: TrendingDown, label: "Negative Spike Alert", desc: "Trigger when negative mentions increase > 50% in 30 min", color: "text-red-600 bg-red-100" },
  { icon: Zap,          label: "Keyword Alert",         desc: "Trigger when crisis keywords are detected",             color: "text-orange-600 bg-orange-100" },
  { icon: User,         label: "Influencer Alert",       desc: "Trigger when a high-reach account mentions your brand", color: "text-purple-600 bg-purple-100" },
  { icon: Bell,         label: "SLA Alert",              desc: "Trigger when admin response time exceeds threshold",    color: "text-blue-600 bg-blue-100" },
];

export default function AlertsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Alert Configuration</h1>
        <p className="text-sm font-medium text-gray-600 mt-0.5">Set up real-time alerts via Email, LINE, and Telegram</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {alertTypes.map(({ icon: Icon, label, desc, color }) => (
          <div key={label} className="bg-white rounded-xl border-2 border-gray-200 p-5 hover:border-blue-300 transition-colors cursor-pointer">
            <div className="flex items-start gap-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
                <Icon size={18} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900">{label}</h3>
                <p className="text-sm font-medium text-gray-600 mt-1">{desc}</p>
              </div>
              <div className="ml-auto">
                <div className="w-11 h-6 bg-gray-200 rounded-full cursor-pointer relative">
                  <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full shadow" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border-2 border-gray-200 p-5">
        <h2 className="text-base font-bold text-gray-900 mb-4">Notification Channels</h2>
        <div className="grid grid-cols-3 gap-3">
          {["Email", "LINE Notify", "Telegram"].map((ch) => (
            <div key={ch} className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
              <span className="text-sm font-bold text-gray-800">{ch}</span>
              <span className="text-xs font-bold text-gray-500 bg-gray-200 px-2 py-0.5 rounded">Configure</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
