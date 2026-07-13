"use client";
import { useState, useEffect } from "react";
import { Bell, Zap, TrendingDown, User, Save, CheckCircle2 } from "lucide-react";
import { api } from "@/lib/api";

const ALERT_TYPES = [
  { key: "negative_spike", icon: TrendingDown, label: "Negative Spike Alert",  desc: "แจ้งเตือนเมื่อ negative mentions เพิ่มขึ้น > 50% ใน 30 นาที",  color: "text-red-600 bg-red-100",    border: "border-red-200" },
  { key: "keyword",        icon: Zap,          label: "Keyword Alert",          desc: "แจ้งเตือนเมื่อตรวจพบ crisis keywords ในโพสต์ใหม่",             color: "text-orange-600 bg-orange-100", border: "border-orange-200" },
  { key: "influencer",     icon: User,         label: "Influencer Alert",        desc: "แจ้งเตือนเมื่อบัญชีที่มี reach สูงกล่าวถึงแบรนด์",             color: "text-purple-600 bg-purple-100", border: "border-purple-200" },
  { key: "sla",            icon: Bell,         label: "SLA Alert",               desc: "แจ้งเตือนเมื่อเวลา response ของ admin เกิน threshold",          color: "text-blue-600 bg-blue-100",   border: "border-blue-200" },
];

const NOTIFY_CHANNELS = [
  { key: "email",    label: "Email",       placeholder: "admin@example.com" },
  { key: "line",     label: "LINE Notify", placeholder: "LINE Notify Token" },
  { key: "telegram", label: "Telegram",    placeholder: "Bot Token:Chat ID" },
];

type AlertState = Record<string, boolean>;
type NotifyState = Record<string, string>;

export default function AlertsPage() {
  const [enabled,  setEnabled]  = useState<AlertState>({});
  const [notify,   setNotify]   = useState<NotifyState>({});
  const [saved,    setSaved]    = useState(false);
  const [keywords, setKeywords] = useState<{ id: number; word: string; is_negative: boolean }[]>([]);

  useEffect(() => {
    const raw = localStorage.getItem("socialeye_alert_config");
    if (raw) {
      try {
        const cfg = JSON.parse(raw);
        setEnabled(cfg.enabled || {});
        setNotify(cfg.notify || {});
      } catch { /* ignore */ }
    }
    api.get("/api/keywords?active_only=true").then(r => setKeywords(r.data)).catch(() => {});
  }, []);

  function toggle(key: string) {
    setEnabled((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function save() {
    localStorage.setItem("socialeye_alert_config", JSON.stringify({ enabled, notify }));
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  const negativeKws = keywords.filter((k) => k.is_negative);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Alert Configuration</h1>
          <p className="text-sm font-medium text-gray-600 mt-0.5">ตั้งค่าการแจ้งเตือน real-time ผ่าน Email, LINE, Telegram</p>
        </div>
        <button onClick={save}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold px-5 py-2.5 rounded-xl transition-colors">
          {saved ? <><CheckCircle2 size={15} /> บันทึกแล้ว</> : <><Save size={15} /> บันทึก</>}
        </button>
      </div>

      {/* Alert toggles */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {ALERT_TYPES.map(({ key, icon: Icon, label, desc, color, border }) => (
          <div key={key}
            onClick={() => toggle(key)}
            className={`bg-white rounded-xl border-2 p-5 cursor-pointer transition-all select-none ${enabled[key] ? border + " shadow-sm" : "border-gray-200 hover:border-gray-300"}`}>
            <div className="flex items-start gap-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
                <Icon size={18} />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-gray-900">{label}</h3>
                <p className="text-xs font-medium text-gray-500 mt-0.5">{desc}</p>
              </div>
              {/* Toggle */}
              <div className={`w-11 h-6 rounded-full transition-colors shrink-0 relative ${enabled[key] ? "bg-blue-600" : "bg-gray-200"}`}>
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${enabled[key] ? "left-6" : "left-1"}`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Crisis keywords preview */}
      {negativeKws.length > 0 && (
        <div className="bg-white rounded-xl border-2 border-gray-200 p-5">
          <h2 className="text-sm font-bold text-gray-900 mb-3">Crisis Keywords ที่ตั้งค่าไว้ ({negativeKws.length})</h2>
          <div className="flex flex-wrap gap-2">
            {negativeKws.map((k) => (
              <span key={k.id} className="text-xs font-bold bg-red-50 text-red-700 border border-red-200 px-2.5 py-1 rounded-lg">
                ⚠ {k.word}
              </span>
            ))}
          </div>
          <p className="text-xs font-medium text-gray-500 mt-2">จัดการ keywords เพิ่มเติมได้ที่หน้า Keywords</p>
        </div>
      )}

      {/* Notification channels */}
      <div className="bg-white rounded-xl border-2 border-gray-200 p-5">
        <h2 className="text-base font-bold text-gray-900 mb-4">Notification Channels</h2>
        <div className="space-y-3">
          {NOTIFY_CHANNELS.map(({ key, label, placeholder }) => (
            <div key={key} className="flex items-center gap-3">
              <span className="w-28 text-sm font-bold text-gray-700 shrink-0">{label}</span>
              <input
                type="text"
                value={notify[key] || ""}
                onChange={(e) => setNotify((p) => ({ ...p, [key]: e.target.value }))}
                placeholder={placeholder}
                className="flex-1 border-2 border-gray-200 rounded-lg px-3 py-2 text-sm font-medium text-gray-800 bg-gray-50 focus:outline-none focus:border-blue-400"
              />
              <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${notify[key] ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                {notify[key] ? "ตั้งค่าแล้ว" : "ยังไม่ได้ตั้งค่า"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
