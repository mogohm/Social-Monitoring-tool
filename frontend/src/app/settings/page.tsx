"use client";

import { useState } from "react";
import { CheckCircle2, XCircle, Bell, Shield, Database, Sliders } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const roles = [
  { role: "Super Admin",  perms: "Full access — all features, user management, settings" },
  { role: "Manager",      perms: "View all dashboards, export reports, assign cases" },
  { role: "QC Lead",      perms: "Review admin conversations and QC scoring" },
  { role: "Analyst",      perms: "View mentions, sentiment, trends — read only" },
  { role: "Admin Agent",  perms: "View assigned cases only" },
  { role: "Executive",    perms: "Summary dashboards only — read-only" },
  { role: "PR / Legal",   perms: "Crisis cases and escalation management" },
];

interface Env {
  key: string;
  label: string;
  hint: string;
  set: boolean;
}

const envStatus: Env[] = [
  { key: "DATABASE_URL",       label: "Database URL",      hint: "Neon PostgreSQL connection string",   set: true },
  { key: "NEXT_PUBLIC_API_URL", label: "API URL (frontend)", hint: "Backend base URL for frontend",      set: !!process.env.NEXT_PUBLIC_API_URL },
  { key: "OPENAI_API_KEY",     label: "OpenAI API Key",    hint: "Required for AI sentiment analysis",  set: false },
];

export default function SettingsPage() {
  const [negThreshold, setNegThreshold] = useState(20);
  const [riskThreshold, setRiskThreshold] = useState(7);
  const [alertsEnabled, setAlertsEnabled] = useState(true);
  const [saved, setSaved] = useState(false);

  function handleSave() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm font-medium text-gray-500 mt-0.5">System configuration and preferences</p>
      </div>

      {/* API Configuration */}
      <div className="bg-white rounded-xl border-2 border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-5">
          <Database size={16} className="text-blue-600" />
          <h2 className="text-base font-extrabold text-gray-900">API Configuration</h2>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5">Backend API URL</label>
            <input
              readOnly
              defaultValue={API_URL}
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-800 bg-gray-50 focus:outline-none"
            />
            <p className="text-xs font-semibold text-gray-400 mt-1">Set via <code className="bg-gray-100 px-1 rounded">NEXT_PUBLIC_API_URL</code> environment variable</p>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5">OpenAI API Key</label>
            <input
              type="password"
              placeholder="sk-… (set in backend/.env)"
              readOnly
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-400 bg-gray-50 focus:outline-none"
            />
            <p className="text-xs font-semibold text-gray-400 mt-1">Set in <code className="bg-gray-100 px-1 rounded">backend/.env</code> — enables AI sentiment analysis and summaries</p>
          </div>
        </div>
      </div>

      {/* Environment status */}
      <div className="bg-white rounded-xl border-2 border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-5">
          <Sliders size={16} className="text-purple-600" />
          <h2 className="text-base font-extrabold text-gray-900">Environment Status</h2>
        </div>
        <div className="space-y-2">
          {envStatus.map((e) => (
            <div key={e.key} className="flex items-center justify-between py-3 px-4 bg-gray-50 rounded-xl border border-gray-200">
              <div>
                <p className="text-sm font-extrabold text-gray-900">{e.label}</p>
                <p className="text-xs font-semibold text-gray-500 mt-0.5">{e.hint}</p>
              </div>
              <div className="flex items-center gap-1.5">
                {e.set ? (
                  <>
                    <CheckCircle2 size={16} className="text-green-600" />
                    <span className="text-xs font-bold text-green-700">Configured</span>
                  </>
                ) : (
                  <>
                    <XCircle size={16} className="text-red-500" />
                    <span className="text-xs font-bold text-red-600">Not set</span>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Alert thresholds */}
      <div className="bg-white rounded-xl border-2 border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-5">
          <Bell size={16} className="text-amber-500" />
          <h2 className="text-base font-extrabold text-gray-900">Alert Thresholds</h2>
        </div>
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-extrabold text-gray-900">Enable alerts</p>
              <p className="text-xs font-semibold text-gray-500 mt-0.5">Trigger notifications when thresholds are exceeded</p>
            </div>
            <button
              onClick={() => setAlertsEnabled(!alertsEnabled)}
              className={`relative w-12 h-6 rounded-full transition-colors duration-200 ${alertsEnabled ? "bg-blue-600" : "bg-gray-300"}`}
            >
              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${alertsEnabled ? "translate-x-7" : "translate-x-1"}`} />
            </button>
          </div>

          <div>
            <div className="flex justify-between text-xs font-bold text-gray-700 mb-2">
              <span>Negative mention spike threshold</span>
              <span className="text-red-700">{negThreshold}%</span>
            </div>
            <input
              type="range" min={5} max={50} step={5}
              value={negThreshold}
              onChange={(e) => setNegThreshold(Number(e.target.value))}
              className="w-full accent-red-600"
            />
            <p className="text-xs font-semibold text-gray-400 mt-1">Alert when negative% exceeds this within any 24-hour window</p>
          </div>

          <div>
            <div className="flex justify-between text-xs font-bold text-gray-700 mb-2">
              <span>Risk score alert threshold</span>
              <span className="text-amber-700">{riskThreshold}/10</span>
            </div>
            <input
              type="range" min={1} max={10} step={1}
              value={riskThreshold}
              onChange={(e) => setRiskThreshold(Number(e.target.value))}
              className="w-full accent-amber-500"
            />
            <p className="text-xs font-semibold text-gray-400 mt-1">Alert when a mention&apos;s risk score reaches this level</p>
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleSave}
              className={`px-5 py-2 text-sm font-bold rounded-xl transition-all duration-200 ${saved ? "bg-green-600 text-white" : "bg-blue-600 hover:bg-blue-700 text-white"}`}
            >
              {saved ? "Saved!" : "Save Settings"}
            </button>
          </div>
        </div>
      </div>

      {/* Roles */}
      <div className="bg-white rounded-xl border-2 border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-5">
          <Shield size={16} className="text-green-600" />
          <h2 className="text-base font-extrabold text-gray-900">Roles &amp; Permissions</h2>
        </div>
        <div className="space-y-2">
          {roles.map((r) => (
            <div key={r.role} className="flex items-center justify-between py-2.5 px-4 bg-gray-50 rounded-xl border border-gray-200">
              <span className="text-sm font-extrabold text-gray-900">{r.role}</span>
              <span className="text-xs font-semibold text-gray-500 text-right max-w-xs">{r.perms}</span>
            </div>
          ))}
        </div>
        <p className="text-xs font-semibold text-gray-400 mt-3">User role assignment is managed server-side. Contact your administrator to change roles.</p>
      </div>
    </div>
  );
}
