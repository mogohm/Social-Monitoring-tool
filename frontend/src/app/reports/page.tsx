export default function ReportsPage() {
  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-gray-900">Reports</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {["Executive Template", "Crisis Template", "Campaign Template", "Admin QC Template"].map((t) => (
          <div key={t} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 cursor-pointer hover:border-blue-300 transition-colors">
            <div className="text-sm font-semibold text-gray-700">{t}</div>
            <div className="text-xs text-gray-400 mt-1">Click to generate PDF/Excel</div>
          </div>
        ))}
      </div>
    </div>
  );
}
