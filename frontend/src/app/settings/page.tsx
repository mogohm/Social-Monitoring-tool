export default function SettingsPage() {
  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-gray-900">Settings</h1>
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">API Base URL</label>
          <input defaultValue="http://localhost:8000" className="w-full border rounded-lg px-3 py-2 text-sm" readOnly />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Roles & Permissions</label>
          <p className="text-sm text-gray-400">Super Admin · Manager · QC Lead · Analyst · Admin Agent · Executive · PR/Legal</p>
        </div>
      </div>
    </div>
  );
}
