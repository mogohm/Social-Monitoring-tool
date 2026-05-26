const roles = [
  { role: "Super Admin", perms: "Full access to all features" },
  { role: "Manager",     perms: "View all dashboards, export, assign cases" },
  { role: "QC Lead",     perms: "Review admin conversations and QC scoring" },
  { role: "Analyst",     perms: "View mentions, sentiment, and trend analysis" },
  { role: "Admin Agent", perms: "View assigned cases only" },
  { role: "Executive",   perms: "Summary dashboards only (read-only)" },
  { role: "PR / Legal",  perms: "Crisis cases and escalation management" },
];

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm font-medium text-gray-600 mt-0.5">System configuration and user permissions</p>
      </div>

      <div className="bg-white rounded-xl border-2 border-gray-200 p-6 space-y-5">
        <h2 className="text-base font-extrabold text-gray-900">API Configuration</h2>
        <div>
          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5">Backend API URL</label>
          <input defaultValue="http://localhost:8000" readOnly
            className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-800 bg-gray-50 focus:outline-none" />
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5">OpenAI API Key</label>
          <input type="password" placeholder="sk-..." readOnly
            className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-800 bg-gray-50 focus:outline-none" />
          <p className="text-xs font-semibold text-gray-500 mt-1">Set in backend/.env — required for AI sentiment analysis</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border-2 border-gray-200 p-6">
        <h2 className="text-base font-extrabold text-gray-900 mb-4">Roles &amp; Permissions</h2>
        <div className="space-y-2">
          {roles.map((r) => (
            <div key={r.role} className="flex items-center justify-between py-2.5 px-4 bg-gray-50 rounded-xl border border-gray-200">
              <span className="text-sm font-extrabold text-gray-900">{r.role}</span>
              <span className="text-xs font-semibold text-gray-600">{r.perms}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
