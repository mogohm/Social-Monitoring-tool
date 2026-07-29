"use client";
import { useState, useEffect, useCallback } from "react";
import {
  Bell, Plus, Trash2, Pencil, X, Check,
  Mail, AlertTriangle, Tag, Layers, Globe,
  ChevronDown, ChevronUp,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ─── Types ────────────────────────────────────────────────────────────────

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

export default function AlertsPage() {
  const [alerts, setAlerts]     = useState<AlertConfig[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing]   = useState<AlertConfig | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API_URL}/api/alerts`);
      if (r.ok) setAlerts(await r.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function openNew()  { setEditing({ ...EMPTY }); setShowForm(true); }
  function openEdit(a: AlertConfig) { setEditing({ ...a }); setShowForm(true); }
  function closeForm() { setShowForm(false); setEditing(null); }

  async function handleDelete(id: number) {
    if (!confirm("ลบ alert นี้?")) return;
    await fetch(`${API_URL}/api/alerts/${id}`, { method: "DELETE" });
    load();
  }

  async function toggleActive(a: AlertConfig) {
    await fetch(`${API_URL}/api/alerts/${a.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...a, is_active: !a.is_active }),
    });
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

      {/* SMTP hint */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
        <Mail size={16} className="text-amber-600 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-bold text-amber-900">ต้องตั้งค่า SMTP ก่อนใช้งาน</p>
          <p className="text-xs font-medium text-amber-700 mt-0.5">
            เพิ่ม env vars ใน Vercel backend:{" "}
            <code className="bg-amber-100 px-1 rounded">SMTP_HOST</code>{" "}
            <code className="bg-amber-100 px-1 rounded">SMTP_PORT</code>{" "}
            <code className="bg-amber-100 px-1 rounded">SMTP_USER</code>{" "}
            <code className="bg-amber-100 px-1 rounded">SMTP_PASS</code>
            {" "}— ใช้ Gmail + App Password ได้เลย
          </p>
        </div>
      </div>

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
  const [expanded, setExpanded] = useState(false);
  const ct = CONDITION_TYPES.find((c) => c.value === alert.condition_type);
  const Icon = ct?.icon || Bell;
  const iconColor = COND_ICON_COLOR[alert.condition_type] || "bg-gray-100 text-gray-600";

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
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onToggle}
            className={`w-10 h-5 rounded-full relative transition-colors ${alert.is_active ? "bg-green-500" : "bg-gray-200"}`}
          >
            <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${alert.is_active ? "left-5" : "left-0.5"}`} />
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

function AlertForm({ initial, onClose, onSaved }: {
  initial: AlertConfig;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm]         = useState<AlertConfig>(initial);
  const [emailInput, setEmailInput] = useState("");
  const [kwInput, setKwInput]   = useState("");
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState("");

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

  function addKw() {
    const v = kwInput.trim();
    if (!v || form.keywords.includes(v)) return;
    set("keywords", [...form.keywords, v]);
    setKwInput("");
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
      const url    = form.id ? `${API_URL}/api/alerts/${form.id}` : `${API_URL}/api/alerts`;
      const method = form.id ? "PATCH" : "POST";
      const r = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!r.ok) throw new Error(await r.text());
      onSaved(); onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
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
              <div className="flex gap-2 mb-2">
                <input
                  value={kwInput}
                  onChange={(e) => setKwInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addKw())}
                  placeholder="keyword แล้ว Enter"
                  className="flex-1 border-2 border-gray-200 rounded-xl px-3 py-2 text-sm font-semibold
                             focus:outline-none focus:border-blue-400"
                />
                <button onClick={addKw} className="px-3 bg-gray-100 hover:bg-gray-200 rounded-xl text-sm font-bold transition-colors">
                  เพิ่ม
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {form.keywords.map((k) => (
                  <span key={k} className="flex items-center gap-1 bg-orange-50 text-orange-700
                                           border border-orange-200 px-2.5 py-1 rounded-lg text-xs font-bold">
                    {k}
                    <button onClick={() => set("keywords", form.keywords.filter((x) => x !== k))}>
                      <X size={10} />
                    </button>
                  </span>
                ))}
              </div>
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
