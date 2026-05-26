"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface Channel {
  id: number;
  name: string;
  display_name: string;
  webhook_url: string | null;
  is_active: boolean;
  last_synced: string | null;
}

const channelColors: Record<string, string> = {
  facebook: "bg-blue-600", twitter: "bg-sky-500", tiktok: "bg-gray-900",
  youtube: "bg-red-600", instagram: "bg-purple-600", line_oa: "bg-green-600",
  news: "bg-slate-600", pantip: "bg-orange-500", webboard: "bg-teal-600",
};

export default function DataSourcesPage() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [saving, setSaving] = useState<number | null>(null);

  const load = () => api.get("/api/channels").then((r) => setChannels(r.data)).catch(() => {});

  useEffect(() => { load(); }, []);

  const toggle = async (ch: Channel) => {
    setSaving(ch.id);
    await api.patch(`/api/channels/${ch.id}`, { is_active: !ch.is_active });
    await load();
    setSaving(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Data Sources</h1>
        <p className="text-sm font-medium text-gray-600 mt-0.5">Enable or disable monitoring channels</p>
      </div>

      {channels.length === 0 ? (
        <div className="text-center py-14 text-gray-500 font-semibold bg-white rounded-xl border border-gray-200">
          No channels configured. Backend initializes defaults on startup.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {channels.map((ch) => (
            <div key={ch.id} className={`bg-white rounded-xl border-2 p-5 transition-colors ${ch.is_active ? "border-blue-200" : "border-gray-200"}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className={`w-10 h-10 rounded-xl flex items-center justify-center text-white text-xs font-extrabold ${channelColors[ch.name] || "bg-gray-500"}`}>
                    {ch.name.substring(0, 2).toUpperCase()}
                  </span>
                  <div>
                    <div className="text-sm font-extrabold text-gray-900">{ch.display_name}</div>
                    <div className="text-xs font-semibold text-gray-500 mt-0.5">
                      {ch.last_synced ? `Last sync: ${new Date(ch.last_synced).toLocaleDateString("th-TH")}` : "Not synced yet"}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => toggle(ch)}
                  disabled={saving === ch.id}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${ch.is_active ? "bg-blue-600" : "bg-gray-300"} ${saving === ch.id ? "opacity-50" : ""}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${ch.is_active ? "translate-x-6" : "translate-x-1"}`} />
                </button>
              </div>
              {ch.is_active && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <input
                    placeholder="Webhook URL (optional)"
                    defaultValue={ch.webhook_url || ""}
                    className="w-full text-xs font-medium border border-gray-200 rounded-lg px-3 py-2 text-gray-700 bg-gray-50 focus:outline-none focus:border-blue-400"
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
