"use client";
import { useState, useEffect, useCallback } from "react";
import {
  Bell, Plus, Trash2, Pencil, X, Check,
  Mail, AlertTriangle, Tag, Layers, Globe,
  ChevronDown, ChevronUp, History, Clock, User, Zap,
} from "lucide-react";
import { api } from "@/lib/api";

// ─── Types ────────────────────────────────────────────────────────────────

interface AlertLog {
  id: number;
  alert_id: number;
  mention_id: number | null;
  sent_at: string;
  recipients: string[];
  channel: string | null;
  author: string | null;
  content_preview: string | null;
  risk_score: number | null;
  topic: string | null;
  matched_keywords: string[];
  mention_url: string | null;
}

interface AlertConfig {
  id?: number;
  name: string;
  condition_type: string;
  threshold: number | null;
  keywords: string[];
  category_filter: string[];
  channels: string[];
  email_recipients: string[];
  is_active: boolean;
}

const EMPTY: AlertConfig = {
  name: "",
  condition_type: "keyword_match",
  threshold: 60,
  keywords: [],
  category_filter: [],
  channels: [],
  email_recipients: [],
  is_active: true,
};

// ─── Constants ───────────────────────────────────────────────────────────

const CONDITION_TYPES = [
  { value: "all",           label: "ทุกโพสต์",     icon: Globe,         desc: "ส่งทุกโพสต์ที่เข้ามา" },
  { value: "keyword_match", label: "Keyword Match",  icon: Tag,           desc: "เมื่อโพสต์มี keyword ที่กำหนด" },
  { value: "risk_score",    label: "Risk Score ≥ X", icon: AlertTriangle, desc: "เมื่อ AI ให้คะแนนความเสี่ยงถึง threshold" },
  { value: "category",      label: "Category",       icon: Layers,        desc: "เมื่อโพสต์จัดอยู่ใน category ที่เลือก" },
];

const CATEGORIES = [
  { value: "brand",              label: "เกี่ยวกับแบรนด์", color: "bg-blue-100 text-blue-700 border-blue-300" },
  { value: "deposit_withdrawal", label: "ฝาก/ถอนเงิน",     color: "bg-yellow-100 text-yellow-700 border-yellow-300" },
  { value: "promotion",          label: "โปรโมชั่น/โบนัส", color: "bg-green-100 text-green-700 border-green-300" },
  { value: "system",             label: "ระบบ/แอป",         color: "bg-purple-100 text-purple-700 border-purple-300" },
  { value: "game",               label: "เกม/ไพ่",          color: "bg-pink-100 text-pink-700 border-pink-300" },
  { value: "scam",               label: "โกง/ปัญหา",        color: "bg-red-100 text-red-700 border-red-300" },
  { value: "general",            label: "ทั่วไป",           color: "bg-gray-100 text-gray-700 border-gray-300" },
];

const CHANNELS_LIST = ["facebook", "twitter", "instagram", "tiktok", "youtube", "pantip", "line_oa"];

const COND_ICON_COLOR: Record<string, string> = {
  all:           "bg-gray-100 text-gray-600",
  keyword_match: "bg-orange-100 text-orange-600",
  risk_score:    "bg-red-100 text-red-600",
  category:      "bg-purple-100 text-purple-600",
};

// ─── Main page ────────────────────────────────────────────────────────────

interface SmtpStatus {
  configured: boolean;
  smtp_host: string;
  smtp_port: string;
  smtp_user: string;
  smtp_pass_set: boolean;
  message: string;
}

export default function AlertsPage() {
  const [alerts, setAlerts]     = useState<AlertConfig[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing]   = useState<AlertConfig | null>(null);
  const [smtp, setSmtp]         = useState<SmtpStatus | null>(null);
  const [testing, setTesting]   = useState(false);
  const [testMsg, setTestMsg]   = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/api/alerts");
      setAlerts(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSmtp = useCallback(async () => {
    try {
      const { data } = await api.get("/api/alerts/smtp-status");
      setSmtp(data);
    } catch {
      setSmtp(null);
    }
  }, []);

  async function sendTestEmail() {
    const to = alerts[0]?.email_recipients ?? [];
    if (!to.length) { setTestMsg("ยังไม่มี alert ที่มีอีเมลผู้รับ"); return; }
    setTesting(true); setTestMsg("");
    try {
      await api.post("/api/alerts/test-email", { recipients: to });
      setTestMsg(`ส่งอีเมลทดสอบไปที่ ${to.join(", ")} แล้ว — เช็ค inbox`);
    } catch (e: unknown) {
      const msg = (e as {response?: {data?: {detail?: string}}})?.response?.data?.detail;
      setTestMsg(msg || "ส่งไม่สำเร็จ");
    } finally {
      setTesting(false);
    }
  }

  useEffect(() => { load(); loadSmtp(); }, [load, loadSmtp]);

  function openNew()  { setEditing({ ...EMPTY }); setShowForm(true); }
  function openEdit(a: AlertConfig) { setEditing({ ...a }); setShowForm(true); }
  function closeForm() { setShowForm(false); setEditing(null); }

  async function handleDelete(id: number) {
    if (!confirm("ลบ alert นี้?")) return;
    await api.delete(`/api/alerts/${id}`);
    load();
  }

  async function toggleActive(a: AlertConfig) {
    await api.patch(`/api/alerts/${a.id}`, { ...a, is_active: !a.is_active });
    load();
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Alert Configuration</h1>
          <p className="text-sm font-medium text-gray-500 mt-0.5">
            ตั้งค่าการแจ้งเตือนทาง Email เมื่อมีโพสต์ตรงเงื่อนไข
          </p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white
                     text-sm font-bold px-5 py-2.5 rounded-xl transition-colors"
        >
          <Plus size={15} /> เพิ่ม Alert
        </button>
      </div>

      {/* SMTP status — live check against backend env vars */}
      {smtp === null ? (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-xs font-medium text-gray-500">
          กำลังตรวจสอบสถานะ SMTP…
        </div>
      ) : smtp.configured ? (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex gap-3 items-start">
          <Check size={16} className="text-green-600 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-bold text-green-900">SMTP พร้อมใช้งาน — ระบบส่ง email ได้แล้ว</p>
            <p className="text-xs font-medium text-green-700 mt-0.5">
              ส่งจาก <code className="bg-green-100 px-1 rounded">{smtp.smtp_user}</code>
              {" · "}{smtp.smtp_host}:{smtp.smtp_port}
            </p>
            {testMsg && (
              <p className="text-xs font-bold text-green-800 mt-1.5">{testMsg}</p>
            )}
          </div>
          <button onClick={sendTestEmail} disabled={testing}
            className="shrink-0 text-xs font-bold px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-700
                       text-white transition-colors disabled:opacity-50">
            {testing ? "กำลังส่ง…" : "ส่งอีเมลทดสอบ"}
          </button>
        </div>
      ) : (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
          <Mail size={16} className="text-amber-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-bold text-amber-900">
              ยังส่ง email ไม่ได้ — ต้องตั้งค่า SMTP ใน Vercel ก่อน
            </p>
            <p className="text-xs font-medium text-amber-700 mt-1">
              ไปที่ Vercel → โปรเจกต์ backend → Settings → Environment Variables แล้วเพิ่ม 4 ตัวนี้:
            </p>
            <div className="mt-2 space-y-0.5 text-xs font-mono text-amber-800">
              <div><span className="bg-amber-100 px-1.5 py-0.5 rounded">SMTP_HOST</span> = smtp.gmail.com</div>
              <div><span className="bg-amber-100 px-1.5 py-0.5 rounded">SMTP_PORT</span> = 587</div>
              <div><span className="bg-amber-100 px-1.5 py-0.5 rounded">SMTP_USER</span> = อีเมล Gmail ของคุณ</div>
              <div><span className="bg-amber-100 px-1.5 py-0.5 rounded">SMTP_PASS</span> = App Password 16 หลัก</div>
            </div>
            <p className="text-xs font-semibold text-amber-800 mt-2">
              สถานะตอนนี้: SMTP_USER {smtp.smtp_user === "(not set)" ? "❌ ยังไม่ได้ตั้ง" : "✅ ตั้งแล้ว"}
              {" · "}SMTP_PASS {smtp.smtp_pass_set ? "✅ ตั้งแล้ว" : "❌ ยังไม่ได้ตั้ง"}
            </p>
            <p className="text-xs font-medium text-amber-600 mt-1">
              หลังเพิ่มแล้วต้องกด Redeploy ที่ Vercel ด้วย ค่าถึงจะมีผล
            </p>
          </div>
        </div>
      )}

      {/* Alert list */}
      {loading ? (
        <div className="text-center py-16 text-gray-400 text-sm font-medium">กำลังโหลด…</div>
      ) : alerts.length === 0 ? (
        <div className="bg-white rounded-xl border-2 border-dashed border-gray-200 p-12 text-center">
          <Bell size={32} className="text-gray-300 mx-auto mb-3" />
          <p className="text-sm font-semibold text-gray-500">ยังไม่มี Alert — กด &quot;เพิ่ม Alert&quot; เพื่อเริ่ม</p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((a) => (
            <AlertCard
              key={a.id}
              alert={a}
              onEdit={() => openEdit(a)}
              onDelete={() => handleDelete(a.id!)}
              onToggle={() => toggleActive(a)}
            />
          ))}
        </div>
      )}

      {/* Form modal */}
      {showForm && editing && (
        <AlertForm initial={editing} onClose={closeForm} onSaved={load} />
      )}
    </div>
  );
}

// ─── Alert Card ───────────────────────────────────────────────────────────

function AlertCard({ alert, onEdit, onDelete, onToggle }: {
  alert: AlertConfig;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
}) {
  const [expanded, setExpanded]   = useState(false);
  const [showLogs, setShowLogs]   = useState(false);
  const [logs, setLogs]           = useState<AlertLog[]>([]);
  const [logTotal, setLogTotal]   = useState<number | null>(null);
  const [logsLoading, setLogsLoading] = useState(false);

  const ct = CONDITION_TYPES.find((c) => c.value === alert.condition_type);
  const Icon = ct?.icon || Bell;
  const iconColor = COND_ICON_COLOR[alert.condition_type] || "bg-gray-100 text-gray-600";

  async function loadLogs() {
    if (logsLoading) return;
    setLogsLoading(true);
    try {
      const { data } = await api.get(`/api/alerts/${alert.id}/logs?limit=20`);
      setLogs(data.logs ?? []);
      setLogTotal(data.total ?? 0);
    } catch {
      // ignore
    } finally {
      setLogsLoading(false);
    }
  }

  function toggleLogs() {
    if (!showLogs && logTotal === null) loadLogs();
    setShowLogs((v) => !v);
  }

  function riskColor(score: number | null) {
    if (!score) return "text-gray-400";
    if (score >= 80) return "text-red-600 font-extrabold";
    if (score >= 60) return "text-orange-500 font-bold";
    return "text-yellow-600 font-bold";
  }

  function fmt(iso: string) {
    const d = new Date(iso);
    return d.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" })
      + " " + d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
  }

  return (
    <div className={`bg-white rounded-xl border-2 transition-all ${alert.is_active ? "border-gray-200" : "border-gray-100 opacity-60"}`}>
      <div className="flex items-center gap-4 p-4">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${iconColor}`}>
          <Icon size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-extrabold text-gray-900 truncate">{alert.name}</p>
          <p className="text-xs font-semibold text-gray-500 mt-0.5">
            {ct?.label}
            {alert.condition_type === "risk_score" && ` ≥ ${alert.threshold ?? 60}`}
            {" · "}
            <span className="text-blue-600">
              {alert.email_recipients.length} recipient{alert.email_recipients.length !== 1 ? "s" : ""}
            </span>
            {logTotal !== null && (
              <>
                {" · "}
                <span className={`${logTotal > 0 ? "text-green-600" : "text-gray-400"}`}>
                  ส่งแล้ว {logTotal} ครั้ง
                </span>
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onToggle}
            className={`w-10 h-5 rounded-full relative transition-colors ${alert.is_active ? "bg-green-500" : "bg-gray-200"}`}
          >
            <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${alert.is_active ? "left-5" : "left-0.5"}`} />
          </button>
          <button onClick={toggleLogs} title="ประวัติการส่ง"
            className={`p-1.5 transition-colors ${showLogs ? "text-indigo-600" : "text-gray-400 hover:text-indigo-500"}`}>
            <History size={14} />
          </button>
          <button onClick={() => setExpanded((v) => !v)} className="p-1.5 text-gray-400 hover:text-gray-600">
            {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
          <button onClick={onEdit} className="p-1.5 text-gray-400 hover:text-blue-600 transition-colors">
            <Pencil size={14} />
          </button>
          <button onClick={onDelete} className="p-1.5 text-gray-400 hover:text-red-500 transition-colors">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Config detail */}
      {expanded && (
        <div className="px-4 pb-4 space-y-2 border-t border-gray-100 pt-3 text-xs">
          <DetailRow label="เงื่อนไข" value={ct?.desc || alert.condition_type} />
          {alert.condition_type === "risk_score" && (
            <DetailRow label="Threshold" value={`Risk Score ≥ ${alert.threshold ?? 60}`} />
          )}
          {alert.keywords.length > 0 && (
            <DetailRow label="Keywords" value={alert.keywords.join(", ")} />
          )}
          {alert.category_filter.length > 0 && (
            <DetailRow
              label="Categories"
              value={alert.category_filter.map((c) => CATEGORIES.find((x) => x.value === c)?.label || c).join(", ")}
            />
          )}
          {alert.channels.length > 0 && (
            <DetailRow label="Channels" value={alert.channels.join(", ")} />
          )}
          <DetailRow label="Recipients" value={alert.email_recipients.join(" · ") || "—"} />
        </div>
      )}

      {/* History log panel */}
      {showLogs && (
        <div className="border-t border-indigo-100 bg-indigo-50/40">
          <div className="flex items-center justify-between px-4 py-2.5">
            <div className="flex items-center gap-2">
              <History size={13} className="text-indigo-500" />
              <span className="text-xs font-extrabold text-indigo-700 uppercase tracking-wide">
                ประวัติการส่ง
              </span>
              {logTotal !== null && (
                <span className="bg-indigo-100 text-indigo-600 text-xs font-extrabold px-2 py-0.5 rounded-full">
                  {logTotal} ครั้ง
                </span>
              )}
            </div>
            <button onClick={loadLogs} className="text-xs font-bold text-indigo-400 hover:text-indigo-600 transition-colors">
              รีเฟรช
            </button>
          </div>

          {logsLoading ? (
            <div className="px-4 pb-4 text-xs text-gray-400 font-medium">กำลังโหลด…</div>
          ) : logs.length === 0 ? (
            <div className="px-4 pb-4 text-xs text-gray-400 font-medium italic">
              ยังไม่เคยส่ง — รอให้มีโพสต์ตรงเงื่อนไข
            </div>
          ) : (
            <div className="divide-y divide-indigo-100/60 max-h-80 overflow-y-auto">
              {logs.map((log) => (
                <div key={log.id} className="px-4 py-3 text-xs space-y-1.5">
                  {/* Row 1: time + channel + risk */}
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 text-gray-500">
                      <Clock size={10} />
                      <span className="font-semibold">{fmt(log.sent_at)}</span>
                    </div>
                    {log.channel && (
                      <span className="bg-blue-100 text-blue-700 text-xs font-bold px-1.5 py-0.5 rounded">
                        {log.channel}
                      </span>
                    )}
                    {log.risk_score !== null && (
                      <div className="flex items-center gap-1 ml-auto">
                        <Zap size={10} className="text-orange-400" />
                        <span className={`text-xs ${riskColor(log.risk_score)}`}>
                          Risk {Math.round(log.risk_score)}
                        </span>
                      </div>
                    )}
                  </div>
                  {/* Row 2: author + keywords */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {log.author && (
                      <div className="flex items-center gap-1 text-gray-500">
                        <User size={10} />
                        <span className="font-semibold">{log.author}</span>
                      </div>
                    )}
                    {log.matched_keywords?.length > 0 && (
                      <div className="flex gap-1 flex-wrap">
                        {log.matched_keywords.map((kw) => (
                          <span key={kw}
                            className="bg-orange-100 text-orange-700 font-bold px-1.5 py-0.5 rounded text-xs">
                            {kw}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  {/* Row 3: content preview */}
                  {log.content_preview && (
                    <p className="text-gray-600 font-medium leading-relaxed line-clamp-2 bg-white/70 rounded-lg px-2 py-1.5">
                      {log.content_preview}
                    </p>
                  )}
                  {/* Row 4: link */}
                  {log.mention_url && (
                    <a href={log.mention_url} target="_blank" rel="noreferrer"
                      className="text-blue-500 hover:text-blue-700 font-semibold underline truncate block">
                      ดูโพสต์ต้นฉบับ →
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <span className="font-bold text-gray-500 w-20 shrink-0">{label}</span>
      <span className="font-medium text-gray-700">{value}</span>
    </div>
  );
}

// ─── Alert Form modal ─────────────────────────────────────────────────────

interface KeywordOption { id: number; word: string; category: string; is_negative: boolean; }

function AlertForm({ initial, onClose, onSaved }: {
  initial: AlertConfig;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm]             = useState<AlertConfig>(initial);
  const [emailInput, setEmailInput] = useState("");
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState("");
  const [kwOptions, setKwOptions]   = useState<KeywordOption[]>([]);

  useEffect(() => {
    api.get("/api/keywords")
      .then(({ data }) => setKwOptions(Array.isArray(data) ? data : data.keywords ?? []))
      .catch(() => {});
  }, []);

  function set<K extends keyof AlertConfig>(k: K, v: AlertConfig[K]) {
    setForm((prev) => ({ ...prev, [k]: v }));
  }

  function addEmail() {
    const v = emailInput.trim().toLowerCase();
    if (!v || !v.includes("@")) return;
    if (!form.email_recipients.includes(v))
      set("email_recipients", [...form.email_recipients, v]);
    setEmailInput("");
  }

  function toggleKw(word: string) {
    const arr = form.keywords;
    set("keywords", arr.includes(word) ? arr.filter((x) => x !== word) : [...arr, word]);
  }

  function toggleCat(v: string) {
    const arr = form.category_filter;
    set("category_filter", arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  }

  function toggleCh(v: string) {
    const arr = form.channels;
    set("channels", arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  }

  async function handleSave() {
    if (!form.name.trim()) { setError("กรุณาใส่ชื่อ Alert"); return; }
    if (!form.email_recipients.length) { setError("กรุณาใส่อีเมลอย่างน้อย 1 ที่อยู่"); return; }
    setSaving(true); setError("");
    try {
      if (form.id) {
        await api.patch(`/api/alerts/${form.id}`, form);
      } else {
        await api.post("/api/alerts", form);
      }
      onSaved(); onClose();
    } catch (e: unknown) {
      const msg = (e as {response?: {data?: {detail?: string}}})?.response?.data?.detail;
      setError(msg || (e instanceof Error ? e.message : "เกิดข้อผิดพลาด"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Modal header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="text-base font-extrabold text-gray-900">
            {form.id ? "แก้ไข Alert" : "เพิ่ม Alert ใหม่"}
          </h2>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Name */}
          <Field label="ชื่อ Alert" required>
            <input
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="เช่น แจ้งเตือนโพสต์ฝาก-ถอน"
              className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm font-semibold
                         focus:outline-none focus:border-blue-400 transition-colors"
            />
          </Field>

          {/* Condition type */}
          <Field label="เงื่อนไขการแจ้งเตือน" required>
            <div className="grid grid-cols-2 gap-2">
              {CONDITION_TYPES.map((c) => {
                const Ic = c.icon;
                const active = form.condition_type === c.value;
                return (
                  <button
                    key={c.value}
                    onClick={() => set("condition_type", c.value)}
                    className={`flex items-start gap-2 p-3 rounded-xl border-2 text-left transition-colors ${
                      active ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <Ic size={14} className={`mt-0.5 shrink-0 ${active ? "text-blue-600" : "text-gray-400"}`} />
                    <div>
                      <p className={`text-xs font-bold ${active ? "text-blue-900" : "text-gray-700"}`}>{c.label}</p>
                      <p className="text-xs font-medium text-gray-400 mt-0.5 leading-tight">{c.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </Field>

          {/* risk_score threshold */}
          {form.condition_type === "risk_score" && (
            <Field label={`Risk Score Threshold (≥ ${form.threshold ?? 60})`}>
              <input
                type="range" min={10} max={100} step={5}
                value={form.threshold ?? 60}
                onChange={(e) => set("threshold", Number(e.target.value))}
                className="w-full accent-blue-600"
              />
              <div className="flex justify-between text-xs font-semibold text-gray-400 mt-1">
                <span>10 ต่ำ</span><span>55</span><span>100 สูงสุด</span>
              </div>
            </Field>
          )}

          {/* keyword_match keywords */}
          {form.condition_type === "keyword_match" && (
            <Field label="Keywords ที่ติดตาม (ว่าง = ทุก keyword)">
              {kwOptions.length === 0 ? (
                <p className="text-xs text-gray-400 italic">โหลด keywords…</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {kwOptions.map((kw) => {
                    const sel = form.keywords.includes(kw.word);
                    return (
                      <button
                        key={kw.id}
                        onClick={() => toggleKw(kw.word)}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold border-2 transition-colors ${
                          sel
                            ? kw.is_negative
                              ? "bg-red-50 text-red-700 border-red-400"
                              : "bg-orange-50 text-orange-700 border-orange-400"
                            : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        {sel && <Check size={9} />}
                        {kw.word}
                        {kw.is_negative && (
                          <span className="ml-1 text-red-400 font-black">⚠</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
              {form.keywords.length > 0 && (
                <p className="text-xs text-gray-400 mt-2">
                  เลือก {form.keywords.length} keyword — ว่างทั้งหมด = แจ้งเตือนทุก keyword
                </p>
              )}
            </Field>
          )}

          {/* category filter */}
          {form.condition_type === "category" && (
            <Field label="Category ที่แจ้งเตือน">
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((c) => {
                  const sel = form.category_filter.includes(c.value);
                  return (
                    <button
                      key={c.value}
                      onClick={() => toggleCat(c.value)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold
                                  border-2 transition-colors ${sel ? c.color : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"}`}
                    >
                      {sel && <Check size={10} />}{c.label}
                    </button>
                  );
                })}
              </div>
            </Field>
          )}

          {/* Channel filter */}
          <Field label="Channel filter (ว่าง = ทุก channel)">
            <div className="flex flex-wrap gap-2">
              {CHANNELS_LIST.map((ch) => {
                const sel = form.channels.includes(ch);
                return (
                  <button key={ch} onClick={() => toggleCh(ch)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border-2 transition-colors ${
                      sel ? "bg-blue-50 text-blue-700 border-blue-400" : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    {sel && <Check size={9} className="inline mr-1" />}{ch}
                  </button>
                );
              })}
            </div>
          </Field>

          {/* Email recipients */}
          <Field label="ผู้รับอีเมล" required>
            <div className="flex gap-2 mb-2">
              <input
                type="email" value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addEmail())}
                placeholder="email@example.com แล้ว Enter"
                className="flex-1 border-2 border-gray-200 rounded-xl px-3 py-2 text-sm font-semibold
                           focus:outline-none focus:border-blue-400 transition-colors"
              />
              <button onClick={addEmail} className="px-3 bg-gray-100 hover:bg-gray-200 rounded-xl text-sm font-bold transition-colors">
                เพิ่ม
              </button>
            </div>
            <div className="space-y-1.5">
              {form.email_recipients.map((e) => (
                <div key={e} className="flex items-center justify-between bg-gray-50 border border-gray-200
                                        rounded-lg px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Mail size={12} className="text-gray-400" />
                    <span className="text-xs font-semibold text-gray-700">{e}</span>
                  </div>
                  <button
                    onClick={() => set("email_recipients", form.email_recipients.filter((x) => x !== e))}
                    className="text-gray-400 hover:text-red-500"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          </Field>

          {/* Active toggle */}
          <div className="flex items-center justify-between py-3 px-4 bg-gray-50 rounded-xl">
            <div>
              <p className="text-sm font-bold text-gray-900">เปิดใช้งาน</p>
              <p className="text-xs font-medium text-gray-500 mt-0.5">ปิดชั่วคราวได้โดยไม่ต้องลบ</p>
            </div>
            <button
              onClick={() => set("is_active", !form.is_active)}
              className={`w-11 h-6 rounded-full relative transition-colors ${form.is_active ? "bg-green-500" : "bg-gray-300"}`}
            >
              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${form.is_active ? "left-6" : "left-1"}`} />
            </button>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-xs font-bold text-red-600">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-5 border-t border-gray-100">
          <button onClick={onClose}
            className="flex-1 py-2.5 text-sm font-bold rounded-xl border-2 border-gray-200
                       text-gray-700 hover:bg-gray-50 transition-colors">
            ยกเลิก
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2.5 text-sm font-bold rounded-xl bg-blue-600 hover:bg-blue-700
                       text-white transition-colors disabled:opacity-50">
            {saving ? "กำลังบันทึก…" : form.id ? "บันทึกการแก้ไข" : "สร้าง Alert"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, required, children }: {
  label: string; required?: boolean; children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">
        {label}{required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {children}
    </div>
  );
}
