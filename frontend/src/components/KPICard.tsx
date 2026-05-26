interface Props {
  title: string;
  value: string | number;
  sub?: string;
  color?: "blue" | "green" | "red" | "yellow" | "purple";
  icon?: React.ReactNode;
}

const colorMap = {
  blue: "text-blue-600 bg-blue-50",
  green: "text-green-600 bg-green-50",
  red: "text-red-600 bg-red-50",
  yellow: "text-yellow-600 bg-yellow-50",
  purple: "text-purple-600 bg-purple-50",
};

export default function KPICard({ title, value, sub, color = "blue", icon }: Props) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{title}</span>
        {icon && (
          <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${colorMap[color]}`}>
            {icon}
          </span>
        )}
      </div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      {sub && <div className="text-xs text-gray-400">{sub}</div>}
    </div>
  );
}
