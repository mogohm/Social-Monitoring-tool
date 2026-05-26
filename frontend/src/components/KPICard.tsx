interface Props {
  title: string;
  value: string | number;
  sub?: string;
  color?: "blue" | "green" | "red" | "yellow" | "purple";
  icon?: React.ReactNode;
}

const colorMap = {
  blue:   { icon: "text-blue-600 bg-blue-100",   value: "text-blue-700" },
  green:  { icon: "text-green-600 bg-green-100",  value: "text-green-700" },
  red:    { icon: "text-red-600 bg-red-100",      value: "text-red-700" },
  yellow: { icon: "text-yellow-700 bg-yellow-100", value: "text-yellow-700" },
  purple: { icon: "text-purple-600 bg-purple-100", value: "text-purple-700" },
};

export default function KPICard({ title, value, sub, color = "blue", icon }: Props) {
  const c = colorMap[color];
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{title}</span>
        {icon && (
          <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${c.icon}`}>
            {icon}
          </span>
        )}
      </div>
      <div className={`text-2xl font-extrabold ${c.value}`}>{value}</div>
      {sub && <div className="text-xs font-medium text-gray-500">{sub}</div>}
    </div>
  );
}
