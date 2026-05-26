import { FileText } from "lucide-react";

const templates = [
  { name: "Executive Report",    desc: "KPI summary, sentiment overview, top mentions",   color: "border-blue-200 bg-blue-50",   tag: "bg-blue-600" },
  { name: "Crisis Report",       desc: "Crisis timeline, negative spike, root causes",    color: "border-red-200 bg-red-50",     tag: "bg-red-600" },
  { name: "Campaign Report",     desc: "Campaign tracking, reach, engagement metrics",    color: "border-purple-200 bg-purple-50", tag: "bg-purple-600" },
  { name: "Admin QC Report",     desc: "Admin scorecard, SLA compliance, coaching notes", color: "border-green-200 bg-green-50", tag: "bg-green-600" },
];

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
        <p className="text-sm font-medium text-gray-600 mt-0.5">Generate and export reports in PDF or Excel</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {templates.map((t) => (
          <div key={t.name} className={`rounded-xl border-2 p-5 cursor-pointer hover:shadow-md transition-shadow ${t.color}`}>
            <div className="flex items-start justify-between mb-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${t.tag}`}>
                <FileText size={16} className="text-white" />
              </div>
              <div className="flex gap-2">
                <button className="text-xs font-bold bg-white border-2 border-gray-200 text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors">
                  PDF
                </button>
                <button className="text-xs font-bold bg-white border-2 border-gray-200 text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors">
                  Excel
                </button>
              </div>
            </div>
            <h3 className="text-base font-extrabold text-gray-900">{t.name}</h3>
            <p className="text-sm font-medium text-gray-600 mt-1">{t.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
