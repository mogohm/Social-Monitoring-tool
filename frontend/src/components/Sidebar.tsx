"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, MessageSquare, BarChart2, TrendingUp,
  Users, AlertTriangle, ShieldCheck, FileText, Settings,
  Bell, Database, Search,
} from "lucide-react";

const nav = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/mentions", label: "Live Mentions", icon: MessageSquare },
  { href: "/sentiment", label: "Sentiment", icon: BarChart2 },
  { href: "/topics", label: "Topics & Trends", icon: TrendingUp },
  { href: "/competitors", label: "Competitors", icon: Users },
  { href: "/crisis", label: "Crisis Center", icon: AlertTriangle },
  { href: "/qc", label: "LINE OA QC", icon: ShieldCheck },
  { href: "/reports", label: "Reports", icon: FileText },
  { href: "/alerts", label: "Alerts", icon: Bell },
  { href: "/data-sources", label: "Data Sources", icon: Database },
  { href: "/query-builder", label: "Query Builder", icon: Search },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function Sidebar() {
  const path = usePathname();
  return (
    <aside className="w-56 min-h-screen bg-[#101828] flex flex-col">
      <div className="px-6 py-5 border-b border-white/10">
        <span className="text-white font-bold text-lg tracking-tight">SocialEye</span>
        <span className="ml-1 text-blue-400 text-xs font-semibold">Monitor</span>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = path === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                active
                  ? "bg-blue-600 text-white"
                  : "text-gray-400 hover:bg-white/10 hover:text-white"
              }`}
            >
              <Icon size={16} />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
