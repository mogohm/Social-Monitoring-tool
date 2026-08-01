"use client";
import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import {
  Zap, Save, RotateCcw, Sparkles, Calculator, AlertCircle, Check, Info,
} from "lucide-react";

interface RiskConfig {
  negative_sentiment_pts: number;
  keyword_hit_pts: number;
  keyword_hit_cap: number;
  long_text_pts: number;
  long_text_chars: number;
  user_negative_pts: number;
  user_negative_cap: number;
  critical_at: number;
  high_at: number;
  medium_at: number;
  use_ai: boolean;
  ai_key_present: boolean;
  scoring_mode: "ai" | "rules";
}

interface Preview {
  score: number;
  priority: string;
  sentiment: string;
  matched_keywords: string[];
  breakdown: { label: string; points: number }[];
  note?: string;
}

const DEFAULTS: Partial<RiskConfig> = {
  negative_sentiment_pts: 40, keyword_hit_pts: 10, keyword_hit_cap: 40,
  long_text_pts: 10, long_text_chars: 200,
  user_negative_pts: 35, user_negative_cap: 70,
  critical_at: 80, high_at: 60, medium_at: 40,
};

const PRIORITY_STYLE: Record<string, string> = {
  critical: "bg-red-100 text-red-700 border-red-300",
  high: "bg-orange-100 text-orange-700 border-orange-300",
  medium: "bg-amber-100 text-amber-700 border-amber-300",
  low: "bg-green-100 text-green-700 border-green-300",
};

const SAMPLE = "ถอนไม่ได้มา 3 วันแล้ว ติดต่อแอดมินก็ไม่ตอบ เงินหายไปเฉยๆ แบบนี้เรียกโกงได้ไหมครับ";

export default function RiskSettingsPage() {
  const [cfg, setCfg]         = useState<RiskConfig | null>(null);
  const [saving, setSaving]   = useState(false);
  const [msg, setMsg]         = useState("");
  const [err, setErr]         = useState("");
  const [sample, setSample]   = useState(SAMPLE);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewing, setPreviewing] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/api/risk-config");
      setCfg(data);
    } catch {
      setErr("โหลดค่าไม่สำเร็จ — ตรวจสอบการเชื่อมต่อ backend");
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function set<K extends keyof RiskConfig>(k: K, v: RiskConfig[K]) {
    setCfg((c) => (c ? { ...c, [k]: v } : c));
    setMsg("");
  }

  const runPreview = useCallback(async () => {
    if (!sample.trim()) return;
    setPreviewing(true);
    try {
      const { data } = await api.post("/api/risk-config/preview", { text: sample });
      setPreview(data);
    } catch {
      setPreview(null);
    } finally {
      setPreviewing(false);
    }
  }, [sample]);

  async function save() {
    if (!cfg) return;
    setSaving(true); setErr(""); setMsg("");
    try {
      const { data } = await api.patch("/api/risk-config", {
        negative_sentiment_pts: cfg.negative_sentiment_pts,
        keyword_hit_pts: cfg.keyword_hit_pts,
        keyword_hit_cap: cfg.keyword_hit_cap,
        long_text_pts: cfg.long_text_pts,
        long_text_chars: cfg.long_text_chars,
        user_negative_pts: cfg.user_negative_pts,
        user_negative_cap: cfg.user_negative_cap,
        critical_at: cfg.critical_at,
        high_at: cfg.high_at,
        medium_at: cfg.medium_at,
        use_ai: cfg.use_ai,
      });
      setCfg(data);
      setMsg("บันทึกแล้ว — มีผลกับโพสต์ที่เก็บเข้ามาใหม่ทันที");
      // Awaited: firing it unawaited left the preview showing the previous
      // config's score, so a change looked like it had done nothing.
      await runPreview();
    } catch (e: unknown) {
      const d = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setErr(d || "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (cfg) runPreview(); }, [cfg !== null]);

  if (!cfg) {
    return <div className="text-center py-20 text-gray-500 font-semibold">กำลังโหลด…</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
            <Zap className="text-red-600" size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Risk Settings</h1>
            <p className="text-sm font-medium text-gray-600">
              ปรับน้ำหนักการให้คะแนนความเสี่ยงได้เอง ไม่ต้องแก้โค้ด
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setCfg({ ...cfg, ...DEFAULTS } as RiskConfig); setMsg("คืนค่าเริ่มต้นแล้ว — กดบันทึกเพื่อยืนยัน"); }}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold rounded-xl border-2 border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <RotateCcw size={14} /> ค่าเริ่มต้น
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-1.5 px-5 py-2 text-sm font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-50"
          >
            <Save size={14} /> {saving ? "กำลังบันทึก…" : "บันทึก"}
          </button>
        </div>
      </div>

      {msg && (
        <div className="flex items-center gap-2 bg-green-50 border-2 border-green-200 rounded-xl px-4 py-3">
          <Check size={15} className="text-green-600" />
          <span className="text-sm font-semibold text-green-800">{msg}</span>
        </div>
      )}
      {err && (
        <div className="flex items-center gap-2 bg-red-50 border-2 border-red-200 rounded-xl px-4 py-3">
          <AlertCircle size={15} className="text-red-600" />
          <span className="text-sm font-semibold text-red-700">{err}</span>
        </div>
      )}

      {/* Scoring mode */}
      <div className={`rounded-xl border-2 p-5 ${cfg.scoring_mode === "ai" ? "bg-purple-50 border-purple-200" : "bg-gray-50 border-gray-200"}`}>
        <div className="flex items-start gap-3">
          <Sparkles size={18} className={cfg.scoring_mode === "ai" ? "text-purple-600 mt-0.5" : "text-gray-400 mt-0.5"} />
          <div className="flex-1">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <p className="text-sm font-extrabold text-gray-900">
                ตอนนี้ให้คะแนนด้วย: {cfg.scoring_mode === "ai"
                  ? <span className="text-purple-700">AI (GPT-4o-mini)</span>
                  : <span className="text-gray-700">สูตรนับคำ</span>}
              </p>
              <button
                onClick={() => set("use_ai", !cfg.use_ai)}
                disabled={!cfg.ai_key_present}
                title={cfg.ai_key_present ? "" : "ต้องใส่ OPENAI_API_KEY ใน Vercel ก่อน"}
                className={`w-11 h-6 rounded-full relative transition-colors disabled:opacity-40 ${cfg.use_ai && cfg.ai_key_present ? "bg-purple-600" : "bg-gray-300"}`}
              >
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${cfg.use_ai && cfg.ai_key_present ? "left-6" : "left-1"}`} />
              </button>
            </div>
            {!cfg.ai_key_present && (
              <p className="text-xs font-semibold text-amber-700 mt-2">
                ยังไม่ได้ตั้ง <code className="bg-amber-100 px-1 rounded">OPENAI_API_KEY</code> ใน Vercel
                — สวิตช์นี้จึงยังใช้ไม่ได้ ระบบใช้สูตรนับคำไปก่อน
              </p>
            )}
            <p className="text-xs font-medium text-gray-600 mt-2 leading-relaxed">
              เมื่อเปิด AI: AI จะให้คะแนนพื้นฐานจากบริบทของข้อความ
              แล้ว<strong>น้ำหนัก keyword ที่คุณตั้งเองจะบวกทับอีกที</strong>
              — คำที่คุณระบุว่าอันตรายจึงดันคะแนนขึ้นเสมอ แม้ AI จะมองว่าโพสต์ไม่มีปัญหา
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Weights */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl border-2 border-gray-200 p-5">
            <h2 className="text-sm font-extrabold text-gray-800 uppercase tracking-wide mb-1">
              น้ำหนักคะแนน
            </h2>
            <p className="text-xs font-medium text-gray-500 mb-5">
              ใช้กับสูตรนับคำ · ข้อสุดท้ายใช้กับทั้งสูตรและ AI
            </p>

            <Slider label="sentiment เป็นลบ" value={cfg.negative_sentiment_pts} max={100}
                    onChange={(v) => set("negative_sentiment_pts", v)}
                    hint="โพสต์ที่ระบบตัดสินว่าเป็นเชิงลบ ได้คะแนนนี้ทันที" />
            <Slider label="คำลบของระบบ (ต่อคำ)" value={cfg.keyword_hit_pts} max={50}
                    onChange={(v) => set("keyword_hit_pts", v)}
                    hint="เช่น แย่ / โกง / ถอนไม่ได้ — เป็นลิสต์ที่มากับระบบ" />
            <Slider label="เพดานคำลบของระบบ" value={cfg.keyword_hit_cap} max={100}
                    onChange={(v) => set("keyword_hit_cap", v)}
                    hint="ต่อให้เจอหลายคำ ก็ไม่เกินค่านี้" />
            <Slider label="ข้อความยาว" value={cfg.long_text_pts} max={50}
                    onChange={(v) => set("long_text_pts", v)}
                    hint="โพสต์ยาวมักมีรายละเอียดปัญหา — ตั้ง 0 ถ้าไม่ต้องการ" />
            <NumberField label="นับว่า “ยาว” เมื่อเกินกี่ตัวอักษร" value={cfg.long_text_chars}
                         onChange={(v) => set("long_text_chars", v)} min={1} max={5000} />

            <div className="mt-5 pt-5 border-t-2 border-dashed border-gray-200">
              <div className="flex items-center gap-1.5 mb-3">
                <Info size={12} className="text-blue-500" />
                <span className="text-xs font-bold text-blue-700">
                  ข้อนี้บวกทับเสมอ ทั้งตอนใช้สูตรและตอนใช้ AI
                </span>
              </div>
              <Slider label="keyword ที่คุณติ๊ก Negative (ต่อคำ)" value={cfg.user_negative_pts} max={100}
                      onChange={(v) => set("user_negative_pts", v)}
                      hint="ตั้งน้ำหนักเฉพาะรายคำได้ที่หน้า Keywords" />
              <Slider label="เพดานรวมของข้อนี้" value={cfg.user_negative_cap} max={100}
                      onChange={(v) => set("user_negative_cap", v)} />
            </div>
          </div>

          {/* Thresholds */}
          <div className="bg-white rounded-xl border-2 border-gray-200 p-5">
            <h2 className="text-sm font-extrabold text-gray-800 uppercase tracking-wide mb-1">
              เกณฑ์ระดับความเร่งด่วน
            </h2>
            <p className="text-xs font-medium text-gray-500 mb-5">
              ต้องเรียงจากมากไปน้อย: critical ≥ high ≥ medium
            </p>
            <Slider label="critical เมื่อคะแนนถึง" value={cfg.critical_at} max={100}
                    onChange={(v) => set("critical_at", v)} color="accent-red-600" />
            <Slider label="high เมื่อคะแนนถึง" value={cfg.high_at} max={100}
                    onChange={(v) => set("high_at", v)} color="accent-orange-500" />
            <Slider label="medium เมื่อคะแนนถึง" value={cfg.medium_at} max={100}
                    onChange={(v) => set("medium_at", v)} color="accent-amber-500" />

            <div className="flex h-7 rounded-lg overflow-hidden mt-4 text-xs font-extrabold text-white">
              <div className="bg-green-500 flex items-center justify-center" style={{ width: `${cfg.medium_at}%` }}>
                {cfg.medium_at > 12 && "low"}
              </div>
              <div className="bg-amber-500 flex items-center justify-center" style={{ width: `${Math.max(0, cfg.high_at - cfg.medium_at)}%` }}>
                {cfg.high_at - cfg.medium_at > 12 && "medium"}
              </div>
              <div className="bg-orange-500 flex items-center justify-center" style={{ width: `${Math.max(0, cfg.critical_at - cfg.high_at)}%` }}>
                {cfg.critical_at - cfg.high_at > 12 && "high"}
              </div>
              <div className="bg-red-600 flex items-center justify-center" style={{ width: `${Math.max(0, 100 - cfg.critical_at)}%` }}>
                {100 - cfg.critical_at > 12 && "critical"}
              </div>
            </div>
          </div>
        </div>

        {/* Live preview */}
        <div className="bg-white rounded-xl border-2 border-gray-200 p-5 h-fit xl:sticky xl:top-6">
          <div className="flex items-center gap-2 mb-1">
            <Calculator size={15} className="text-blue-600" />
            <h2 className="text-sm font-extrabold text-gray-800 uppercase tracking-wide">
              ทดลองคำนวณ
            </h2>
          </div>
          <p className="text-xs font-medium text-gray-500 mb-4">
            พิมพ์ข้อความแล้วดูว่าได้คะแนนเท่าไหร่ มาจากข้อไหนบ้าง
          </p>

          <textarea
            value={sample}
            onChange={(e) => setSample(e.target.value)}
            rows={4}
            className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm font-medium
                       focus:outline-none focus:border-blue-400 resize-none"
            placeholder="วางข้อความโพสต์ที่อยากทดสอบ…"
          />
          <button
            onClick={runPreview}
            disabled={previewing || !sample.trim()}
            className="mt-2 w-full py-2 rounded-xl bg-gray-900 hover:bg-gray-800 text-white text-sm font-bold transition-colors disabled:opacity-50"
          >
            {previewing ? "กำลังคำนวณ…" : "คำนวณด้วยค่าที่บันทึกไว้"}
          </button>

          {preview && (
            <div className="mt-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="text-4xl font-extrabold text-gray-900">{preview.score}</div>
                <div className="text-sm font-bold text-gray-400">/100</div>
                <span className={`ml-auto text-xs font-extrabold px-3 py-1.5 rounded-lg border-2 ${PRIORITY_STYLE[preview.priority]}`}>
                  {preview.priority}
                </span>
              </div>

              <div className="space-y-1.5">
                {preview.breakdown.length === 0 ? (
                  <p className="text-xs font-medium text-gray-400 italic">ไม่เข้าเงื่อนไขข้อไหนเลย — ได้ 0</p>
                ) : preview.breakdown.map((b, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 bg-gray-50 rounded-lg px-3 py-2">
                    <span className="text-xs font-semibold text-gray-700">{b.label}</span>
                    <span className="text-xs font-extrabold text-blue-700 shrink-0">+{b.points}</span>
                  </div>
                ))}
              </div>

              <div className="mt-4 pt-4 border-t border-gray-100 space-y-1 text-xs font-medium text-gray-500">
                <p>sentiment ที่ตรวจได้: <strong className="text-gray-700">{preview.sentiment}</strong></p>
                {preview.matched_keywords.length > 0 && (
                  <p>keyword ที่ match: {preview.matched_keywords.map((k) => (
                    <span key={k} className="inline-block bg-orange-100 text-orange-700 font-bold px-1.5 py-0.5 rounded mr-1">{k}</span>
                  ))}</p>
                )}
                {preview.note && <p className="text-gray-400 italic pt-1">{preview.note}</p>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Slider({ label, value, max, onChange, hint, color = "accent-blue-600" }: {
  label: string; value: number; max: number; onChange: (v: number) => void; hint?: string; color?: string;
}) {
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs font-bold text-gray-700">{label}</label>
        <span className="text-sm font-extrabold text-blue-700 tabular-nums">{value}</span>
      </div>
      <input
        type="range" min={0} max={max} step={1} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={`w-full ${color}`}
      />
      {hint && <p className="text-xs font-medium text-gray-400 mt-0.5">{hint}</p>}
    </div>
  );
}

function NumberField({ label, value, onChange, min, max }: {
  label: string; value: number; onChange: (v: number) => void; min: number; max: number;
}) {
  return (
    <div className="flex items-center justify-between gap-3 mb-1">
      <label className="text-xs font-bold text-gray-700">{label}</label>
      <input
        type="number" min={min} max={max} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-24 border-2 border-gray-200 rounded-lg px-2 py-1 text-sm font-bold text-right
                   focus:outline-none focus:border-blue-400 tabular-nums"
      />
    </div>
  );
}
