"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, MessageSquare, BarChart2, TrendingUp,
  Users, AlertTriangle, ShieldCheck, FileText, Settings,
  Bell, Database, Search, Tag, Plug,
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
  { href: "/keywords", label: "Keywords", icon: Tag },
  { href: "/alerts", label: "Alerts", icon: Bell },
  { href: "/data-sources", label: "Data Sources", icon: Database },
  { href: "/integrations", label: "Integration Guide", icon: Plug },
  { href: "/query-builder", label: "Query Builder", icon: Search },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function Sidebar() {
  const path = usePathname();
  return (
    <aside className="w-60 min-h-screen bg-[#101828] flex flex-col shrink-0">
      <div className="px-5 py-5 border-b border-white/10">
        <div className="flex items-baseline gap-1">
          <span className="text-white font-bold text-xl tracking-tight">SocialEye</span>
          <span className="text-blue-400 text-sm font-semibold">Monitor</span>
        </div>
        <p className="text-gray-400 text-xs mt-0.5">Social Listening Platform</p>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = path === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? "bg-blue-600 text-white"
                  : "text-gray-200 hover:bg-white/10 hover:text-white"
              }`}
            >
              <Icon size={15} className={active ? "text-white" : "text-gray-400"} />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="px-4 py-4 border-t border-white/10">
        <p className="text-xs text-gray-500">v1.0.0 · N8 Thailand</p>
      </div>
    </aside>
  );
}
