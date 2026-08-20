"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Shield, RefreshCw, Play, Pause, Clock, Activity,
  BarChart2, AlertCircle, LogOut,
} from "lucide-react";
import { getAdminToken, setAdminToken, clearAdminToken, onAdminTokenChange } from "@/lib/adminToken";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface ScraperConfig {
  id: number;
  name: string;
  enabled: boolean;
  interval_minutes: number;
  last_run_at: string | null;
  last_posts_count: number;
  last_duration_seconds: number;
  last_status: string | null;
  last_error: string | null;
  run_requested_at: string | null;
  stale_after_seconds: number;
  // Computed by the API, not here: whether the scraper is actually alive is
  // one question that must have one answer, and the server owns it.
  state: "running" | "paused" | "down" | "needs_login" | "never_reported";
  stale: boolean;
  seconds_since_last_run: number | null;
  updated_at: string | null;
}

// `enabled` is only what an operator asked for. A scraper that died still has
// enabled=true, so showing that as "Running" is green-lighting the exact
// outage this page exists to reveal. Everything below keys off `state`.
const STATE_UI: Record<
  ScraperConfig["state"],
  { label: string; dot: string; text: string; box: string; note: string }
> = {
  running: {
    label: "Running", dot: "bg-green-500", text: "text-green-700",
    box: "border-gray-200",
    note: "Reporting in on schedule.",
  },
  paused: {
    label: "Paused", dot: "bg-amber-500", text: "text-amber-700",
    box: "border-amber-300",
    note: "Alive, but told not to collect.",
  },
  needs_login: {
    label: "Needs login", dot: "bg-amber-500", text: "text-amber-700",
    box: "border-amber-300",
    note: "Running but signed out of Facebook — needs a person at a browser.",
  },
  down: {
    label: "Down", dot: "bg-red-500", text: "text-red-700",
    box: "border-red-300",
    note: "No heartbeat for longer than a cycle allows. The process is not running.",
  },
  never_reported: {
    label: "No data", dot: "bg-gray-400", text: "text-gray-600",
    box: "border-gray-200",
    note: "Never reported. Check ADMIN_TOKEN is set on both the API and the scraper.",
  },
};

function humanDuration(sec: number | null): string {
  if (sec === null) return "never";
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`;
  return `${Math.floor(sec / 86400)}d ${Math.floor((sec % 86400) / 3600)}h`;
}

function timeAgo(isoStr: string | null): string {
  if (!isoStr) return "Never";
  const diff = Math.floor((Date.now() - new Date(isoStr).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function AdminPage() {
  const [token, setToken] = useState("");
  const [tokenInput, setTokenInput] = useState("");
  const [authError, setAuthError] = useState("");
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const [config, setConfig] = useState<ScraperConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [saveMsg, setSaveMsg] = useState("");

  // Restore token on mount, and follow sign-in/out from other tabs
  useEffect(() => {
    const stored = getAdminToken();
    if (stored) setToken(stored);
    return onAdminTokenChange(setToken);
  }, []);

  const fetchConfig = useCallback(async (tok: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/scraper`, {
        headers: { "X-Admin-Token": tok },
      });
      if (!res.ok) throw new Error(`${res.status}`);
      setConfig(await res.json());
      setLastRefresh(new Date());
    } catch (e) {
      console.error("fetchConfig:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-fetch + auto-refresh every 30s once authenticated
  useEffect(() => {
    if (!token) return;
    fetchConfig(token);
    const timer = setInterval(() => fetchConfig(token), 30_000);
    return () => clearInterval(timer);
  }, [token, fetchConfig]);

  async function handleLogin() {
    if (!tokenInput.trim()) return;
    setIsAuthenticating(true);
    setAuthError("");
    try {
      const res = await fetch(`${API_URL}/api/admin/scraper`, {
        headers: { "X-Admin-Token": tokenInput },
      });
      if (res.ok) {
        setAdminToken(tokenInput);
        setToken(tokenInput);
      } else {
        setAuthError("Invalid token — please try again.");
      }
    } catch {
      setAuthError("Cannot reach API. Check your network or NEXT_PUBLIC_API_URL.");
    } finally {
      setIsAuthenticating(false);
    }
  }

  async function patchConfig(updates: Partial<Pick<ScraperConfig, "enabled" | "interval_minutes">>) {
    if (!token) return;
    setSaving(true);
    setSaveMsg("");
    try {
      const res = await fetch(`${API_URL}/api/admin/scraper`, {
        method: "PATCH",
        headers: { "X-Admin-Token": token, "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        setConfig(await res.json());
        setSaveMsg("Saved");
        setTimeout(() => setSaveMsg(""), 2000);
      }
    } catch (e) {
      console.error("patchConfig:", e);
    } finally {
      setSaving(false);
    }
  }

  async function runNow() {
    if (!token) return;
    setSaving(true);
    setSaveMsg("");
    try {
      const res = await fetch(`${API_URL}/api/admin/scraper/run-now`, {
        method: "POST",
        headers: { "X-Admin-Token": token },
      });
      if (res.ok) {
        setConfig(await res.json());
        setSaveMsg("Requested — starts within ~1 min");
        setTimeout(() => setSaveMsg(""), 4000);
      }
    } catch (e) {
      console.error("runNow:", e);
    } finally {
      setSaving(false);
    }
  }

  function handleSignOut() {
    clearAdminToken();
    setToken("");
    setConfig(null);
  }

  // ── Password gate ──────────────────────────────────────────────────────────
  if (!token) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="bg-white rounded-2xl border-2 border-gray-200 p-8 w-full max-w-sm shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
              <Shield size={20} className="text-amber-600" />
            </div>
            <div>
              <h1 className="text-lg font-extrabold text-gray-900">Admin Access</h1>
              <p className="text-xs font-semibold text-gray-500">Scraper Control Panel</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5">
                Admin Token
              </label>
              <input
                type="password"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                placeholder="Enter admin token…"
                autoFocus
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-800 focus:outline-none focus:border-amber-400 transition-colors"
              />
            </div>

            {authError && (
              <div className="flex items-center gap-2 bg-red-50 rounded-xl p-3 border border-red-200">
                <AlertCircle size={14} className="text-red-500 shrink-0" />
                <p className="text-xs font-semibold text-red-600">{authError}</p>
              </div>
            )}

            <button
              onClick={handleLogin}
              disabled={isAuthenticating || !tokenInput.trim()}
              className="w-full py-2.5 text-sm font-bold rounded-xl bg-amber-600 hover:bg-amber-700 text-white transition-colors disabled:opacity-50"
            >
              {isAuthenticating ? "Checking…" : "Access Dashboard"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Dashboard ──────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Scraper Admin</h1>
          <p className="text-sm font-medium text-gray-500 mt-0.5">
            Facebook group scraper control panel
            {lastRefresh && (
              <span className="text-gray-400"> · refreshed {timeAgo(lastRefresh.toISOString())}</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {saveMsg && (
            <span className="text-xs font-bold text-green-700 bg-green-50 border border-green-200 px-3 py-1 rounded-xl">
              {saveMsg}
            </span>
          )}
          <button
            onClick={() => fetchConfig(token)}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-xl bg-white border-2 border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      {config ? (
        <>
          {/* Alert banner — the page must lead with the bad news, not bury it */}
          {(config.state === "down" || config.state === "needs_login" || config.state === "never_reported") && (
            <div className={`rounded-xl border-2 p-5 ${
              config.state === "down" ? "bg-red-50 border-red-300" : "bg-amber-50 border-amber-300"
            }`}>
              <div className="flex items-start gap-3">
                <AlertCircle
                  size={16}
                  className={`mt-0.5 shrink-0 ${config.state === "down" ? "text-red-600" : "text-amber-600"}`}
                />
                <div>
                  <p className={`text-sm font-extrabold ${
                    config.state === "down" ? "text-red-900" : "text-amber-900"
                  }`}>
                    {config.state === "down" && "Scraper is not running"}
                    {config.state === "needs_login" && "Facebook session expired"}
                    {config.state === "never_reported" && "No heartbeat has ever arrived"}
                  </p>
                  <p className={`text-xs font-semibold mt-1 leading-relaxed ${
                    config.state === "down" ? "text-red-700" : "text-amber-700"
                  }`}>
                    {config.state === "down" && (
                      <>
                        Last heartbeat {humanDuration(config.seconds_since_last_run)} ago — past the{" "}
                        {humanDuration(config.stale_after_seconds)} a {config.interval_minutes} minute
                        cycle allows. Nothing here can restart it: the scraper runs on a Windows
                        machine and this page can only leave instructions for a process that is
                        still alive. Start it there with{" "}
                        <code className="bg-red-100 px-1 rounded">run_scraper_hidden.vbs</code>.
                      </>
                    )}
                    {config.state === "needs_login" && (
                      <>
                        The scraper is alive and reporting, but Facebook has signed it out, so it is
                        collecting nothing. This needs a person at a visible browser on the scraper
                        machine — no button here can clear a checkpoint.
                      </>
                    )}
                    {config.state === "never_reported" && (
                      <>
                        The scraper has never checked in. Usually this means{" "}
                        <code className="bg-amber-100 px-1 rounded">ADMIN_TOKEN</code> is missing or
                        differs between the API and the scraper&apos;s{" "}
                        <code className="bg-amber-100 px-1 rounded">backend/.env</code>.
                      </>
                    )}
                  </p>
                  {config.last_error && (
                    <p className="text-xs font-mono mt-2 text-gray-600 bg-white/60 rounded px-2 py-1 break-all">
                      {config.last_error}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Stat cards */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {/* Status */}
            <div className={`bg-white rounded-xl border-2 p-5 ${STATE_UI[config.state].box}`}>
              <div className="flex items-center gap-2 mb-3">
                <Activity size={13} className="text-gray-400" />
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Status</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${STATE_UI[config.state].dot}`} />
                <span className={`text-lg font-extrabold ${STATE_UI[config.state].text}`}>
                  {STATE_UI[config.state].label}
                </span>
              </div>
              <p className="text-xs font-semibold text-gray-500 mt-1.5 leading-snug">
                {STATE_UI[config.state].note}
              </p>
            </div>

            {/* Last run */}
            <div className="bg-white rounded-xl border-2 border-gray-200 p-5">
              <div className="flex items-center gap-2 mb-3">
                <Clock size={13} className="text-gray-400" />
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Last Run</span>
              </div>
              <p className={`text-lg font-extrabold ${config.stale ? "text-red-700" : "text-gray-900"}`}>
                {config.seconds_since_last_run === null
                  ? "Never"
                  : `${humanDuration(config.seconds_since_last_run)} ago`}
              </p>
              <p className="text-xs font-semibold text-gray-400 mt-0.5">
                {config.last_run_at
                  ? `${new Date(config.last_run_at).toLocaleTimeString()} · down after ${humanDuration(config.stale_after_seconds)}`
                  : "no heartbeat received"}
              </p>
            </div>

            {/* Posts */}
            <div className="bg-white rounded-xl border-2 border-gray-200 p-5">
              <div className="flex items-center gap-2 mb-3">
                <BarChart2 size={13} className="text-gray-400" />
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Posts / Cycle</span>
              </div>
              <p className="text-lg font-extrabold text-gray-900">{config.last_posts_count}</p>
              <p className="text-xs font-semibold text-gray-400 mt-0.5">sent last run</p>
            </div>

            {/* Duration */}
            <div className="bg-white rounded-xl border-2 border-gray-200 p-5">
              <div className="flex items-center gap-2 mb-3">
                <Clock size={13} className="text-gray-400" />
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Duration</span>
              </div>
              <p className="text-lg font-extrabold text-gray-900">
                {config.last_duration_seconds > 0
                  ? `${config.last_duration_seconds.toFixed(1)}s`
                  : "—"}
              </p>
              <p className="text-xs font-semibold text-gray-400 mt-0.5">last cycle time</p>
            </div>
          </div>

          {/* Controls card */}
          <div className="bg-white rounded-xl border-2 border-gray-200 p-6">
            <h2 className="text-base font-extrabold text-gray-900 mb-5">Scraper Controls</h2>
            <div className="space-y-4">
              {/* Toggle enabled */}
              <div className="flex items-center justify-between py-4 px-5 bg-gray-50 rounded-xl border border-gray-200">
                <div>
                  <p className="text-sm font-extrabold text-gray-900">Scraper Active</p>
                  <p className="text-xs font-semibold text-gray-500 mt-0.5">
                    {config.enabled
                      ? "Scraper is running — will scrape on next wake cycle"
                      : "Scraper is paused — local process will poll every 60 s"}
                  </p>
                </div>
                <button
                  onClick={() => patchConfig({ enabled: !config.enabled })}
                  disabled={saving}
                  className={`flex items-center gap-2 px-5 py-2.5 text-sm font-bold rounded-xl transition-colors disabled:opacity-50 ${
                    config.enabled
                      ? "bg-red-100 text-red-700 hover:bg-red-200"
                      : "bg-green-100 text-green-700 hover:bg-green-200"
                  }`}
                >
                  {config.enabled ? <Pause size={14} /> : <Play size={14} />}
                  {saving ? "Saving…" : config.enabled ? "Pause Scraper" : "Start Scraper"}
                </button>
              </div>

              {/* Run now */}
              <div className="flex items-center justify-between py-4 px-5 bg-gray-50 rounded-xl border border-gray-200">
                <div>
                  <p className="text-sm font-extrabold text-gray-900">Run a cycle now</p>
                  <p className="text-xs font-semibold text-gray-500 mt-0.5">
                    {config.run_requested_at
                      ? "Requested — waiting for the scraper to pick it up"
                      : `Skips the rest of the wait. Lands within about a minute, and only while the scraper is alive.`}
                  </p>
                </div>
                <button
                  onClick={runNow}
                  disabled={saving || config.state === "down" || config.state === "never_reported"}
                  className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold rounded-xl bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Play size={14} />
                  {saving ? "Sending…" : "Run now"}
                </button>
              </div>

              {/* Interval */}
              <div className="flex items-center justify-between py-4 px-5 bg-gray-50 rounded-xl border border-gray-200">
                <div>
                  <p className="text-sm font-extrabold text-gray-900">Scrape Interval</p>
                  <p className="text-xs font-semibold text-gray-500 mt-0.5">
                    Current: <strong>{config.interval_minutes} min</strong> — change takes effect after the current cycle completes
                  </p>
                </div>
                <select
                  value={config.interval_minutes}
                  onChange={(e) => patchConfig({ interval_minutes: Number(e.target.value) })}
                  disabled={saving}
                  className="border-2 border-gray-200 rounded-xl px-3 py-2 text-sm font-bold text-gray-800 bg-white focus:outline-none focus:border-amber-400 disabled:opacity-50"
                >
                  {[5, 10, 15, 30, 60].map((m) => (
                    <option key={m} value={m}>{m} minutes</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Info note */}
          <div className="bg-amber-50 rounded-xl border border-amber-200 p-5">
            <div className="flex items-start gap-3">
              <Shield size={15} className="text-amber-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-extrabold text-amber-900">Local Windows Scraper</p>
                <p className="text-xs font-semibold text-amber-700 mt-1 leading-relaxed">
                  The Facebook scraper runs locally on a Windows machine via Playwright (
                  <code className="bg-amber-100 px-1 rounded">fb_group_scraper.py</code>).
                  These controls are stored in the cloud database and polled by that process
                  about <strong>once a minute while it waits</strong>, so a change here lands
                  within roughly a minute rather than at the end of the cycle. Nothing on this
                  page can start a scraper that is not running, or clear a Facebook checkpoint —
                  both need someone at that machine. Auto-refreshes every 30 seconds.
                </p>
              </div>
            </div>
          </div>

          {/* Sign out */}
          <div className="flex justify-end">
            <button
              onClick={handleSignOut}
              className="flex items-center gap-1.5 text-xs font-bold text-gray-400 hover:text-gray-600 transition-colors"
            >
              <LogOut size={12} />
              Sign out of admin
            </button>
          </div>
        </>
      ) : (
        <div className="flex items-center justify-center py-24">
          <div className="text-center">
            <RefreshCw size={24} className="text-gray-400 animate-spin mx-auto mb-3" />
            <p className="text-sm font-semibold text-gray-500">Loading scraper status…</p>
          </div>
        </div>
      )}
    </div>
  );
}
