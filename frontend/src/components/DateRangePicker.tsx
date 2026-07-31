"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarDays, RefreshCw, Check, X } from "lucide-react";
import {
  DateRange, PRESETS, isCustom, rangeLabel, resolvedSpan, todayISO, daysAgoISO,
} from "@/lib/dateRange";

interface Props {
  value: DateRange;
  onChange: (r: DateRange) => void;
  onRefresh?: () => void;
  /** Presets to offer; defaults to 7/14/30/90. */
  presets?: readonly { days: number; label: string }[];
}

/**
 * Preset buttons plus a calendar popover for an explicit start–end span.
 * The resolved dates are always spelled out under the control, because the
 * feedback on the old fixed buttons was that you couldn't tell what window
 * you were actually looking at.
 */
export default function DateRangePicker({ value, onChange, onRefresh, presets = PRESETS }: Props) {
  const [open, setOpen] = useState(false);
  const [draftFrom, setDraftFrom] = useState("");
  const [draftTo, setDraftTo] = useState("");
  const [err, setErr] = useState("");
  const boxRef = useRef<HTMLDivElement>(null);

  const custom = isCustom(value);
  const span = resolvedSpan(value);

  useEffect(() => {
    if (!open) return;
    setDraftFrom(value.from ?? span.from);
    setDraftTo(value.to ?? span.to);
    setErr("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Close on outside click / Escape
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function apply() {
    if (!draftFrom || !draftTo) { setErr("เลือกทั้งวันเริ่มต้นและวันสิ้นสุด"); return; }
    if (draftFrom > draftTo)   { setErr("วันเริ่มต้นต้องไม่เกินวันสิ้นสุด"); return; }
    onChange({ from: draftFrom, to: draftTo });
    setOpen(false);
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <div className="flex rounded-xl border-2 border-gray-200 overflow-hidden">
          {presets.map((p) => {
            const active = !custom && value.days === p.days;
            return (
              <button
                key={p.days}
                onClick={() => onChange({ days: p.days })}
                className={`px-3 py-1.5 text-xs font-bold transition-colors ${
                  active ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                {p.days}d
              </button>
            );
          })}

          <div className="relative" ref={boxRef}>
            <button
              onClick={() => setOpen((v) => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold border-l-2 border-gray-200 transition-colors ${
                custom ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              <CalendarDays size={13} />
              กำหนดเอง
            </button>

            {open && (
              <div className="absolute right-0 top-full mt-2 z-50 w-72 rounded-xl border-2 border-gray-200 bg-white p-4 shadow-xl">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-extrabold text-gray-800 uppercase tracking-wide">
                    เลือกช่วงวันที่
                  </span>
                  <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
                    <X size={14} />
                  </button>
                </div>

                <label className="block text-xs font-bold text-gray-600 mb-1">วันเริ่มต้น</label>
                <input
                  type="date" value={draftFrom} max={draftTo || todayISO()}
                  onChange={(e) => { setDraftFrom(e.target.value); setErr(""); }}
                  className="w-full mb-3 rounded-lg border-2 border-gray-200 px-3 py-1.5 text-sm font-semibold
                             focus:outline-none focus:border-blue-400"
                />

                <label className="block text-xs font-bold text-gray-600 mb-1">วันสิ้นสุด</label>
                <input
                  type="date" value={draftTo} min={draftFrom} max={todayISO()}
                  onChange={(e) => { setDraftTo(e.target.value); setErr(""); }}
                  className="w-full rounded-lg border-2 border-gray-200 px-3 py-1.5 text-sm font-semibold
                             focus:outline-none focus:border-blue-400"
                />

                <div className="flex flex-wrap gap-1.5 mt-3">
                  {[
                    { label: "เดือนนี้", from: `${todayISO().slice(0, 7)}-01`, to: todayISO() },
                    { label: "7 วันก่อน", from: daysAgoISO(6), to: todayISO() },
                    { label: "เมื่อวาน", from: daysAgoISO(1), to: daysAgoISO(1) },
                  ].map((s) => (
                    <button
                      key={s.label}
                      onClick={() => { setDraftFrom(s.from); setDraftTo(s.to); setErr(""); }}
                      className="px-2 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-xs font-bold text-gray-600"
                    >
                      {s.label}
                    </button>
                  ))}
                </div>

                {err && <p className="mt-2 text-xs font-bold text-red-600">{err}</p>}

                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => { onChange({ days: 30 }); setOpen(false); }}
                    className="flex-1 py-1.5 rounded-lg border-2 border-gray-200 text-xs font-bold
                               text-gray-600 hover:bg-gray-50"
                  >
                    ล้าง
                  </button>
                  <button
                    onClick={apply}
                    className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg
                               bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold"
                  >
                    <Check size={12} /> ใช้ช่วงนี้
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {onRefresh && (
          <button
            onClick={onRefresh}
            title="รีเฟรช"
            className="p-2 rounded-xl border-2 border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
          >
            <RefreshCw size={13} />
          </button>
        )}
      </div>

      <span className="text-xs font-semibold text-gray-500">
        {rangeLabel(value)}
        {!custom && <span className="text-gray-400"> · {span.from} ถึง {span.to}</span>}
      </span>
    </div>
  );
}
