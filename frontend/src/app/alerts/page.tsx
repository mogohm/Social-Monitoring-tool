export default function AlertsPage() {
  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-gray-900">Alert Configuration</h1>
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <p className="text-sm text-gray-500">Configure alerts for: Negative spike, Influencer mentions, Keyword triggers, SLA breaches.</p>
        <p className="text-xs text-gray-400 mt-2">Alert delivery: Email · LINE · Telegram</p>
      </div>
    </div>
  );
}
