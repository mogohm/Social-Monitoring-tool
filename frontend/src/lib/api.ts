import axios from "axios";
import { DateRange, rangeQuery } from "./dateRange";

/** Accepts a plain day count (legacy callers) or a DateRange. */
type Range = number | DateRange;
const qs = (r: Range) => rangeQuery(typeof r === "number" ? { days: r } : r);

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== "undefined" && window.location.hostname !== "localhost"
    ? "https://socialeye-api.vercel.app"
    : "http://localhost:8000");

export const api = axios.create({ baseURL: API_URL });

export async function fetchStats(range: Range = 7) {
  const { data } = await api.get(`/api/mentions/stats?${qs(range)}`);
  return data;
}

export async function fetchMentions(params: Record<string, string | number> = {}) {
  const { data } = await api.get("/api/mentions", { params });
  return data;
}

export async function fetchTrend(range: Range = 7) {
  const { data } = await api.get(`/api/mentions/trend?${qs(range)}`);
  return data;
}

export async function fetchQCScoreboard(range: Range = 7) {
  const { data } = await api.get(`/api/qc/scoreboard?${qs(range)}`);
  return data;
}

export async function createMention(payload: Record<string, unknown>) {
  const { data } = await api.post("/api/mentions", payload);
  return data;
}

export async function fetchKeywords(activeOnly = false) {
  const { data } = await api.get("/api/keywords", { params: activeOnly ? { active_only: true } : {} });
  return data;
}

export async function fetchKeywordStats() {
  const { data } = await api.get("/api/keywords/stats");
  return data;
}

export async function createKeyword(payload: { word: string; category?: string; is_negative?: boolean }) {
  const { data } = await api.post("/api/keywords", payload);
  return data;
}

export async function deleteKeyword(id: number) {
  await api.delete(`/api/keywords/${id}`);
}

export async function fetchChannels() {
  const { data } = await api.get("/api/channels");
  return data;
}

export async function updateChannel(id: number, payload: Record<string, unknown>) {
  const { data } = await api.patch(`/api/channels/${id}`, payload);
  return data;
}

export async function retagKeywords() {
  const { data } = await api.post("/api/mentions/retag-keywords");
  return data;
}

export async function fetchMentionDetail(id: number) {
  const { data } = await api.get(`/api/mentions/${id}`);
  return data;
}

export async function fetchTopics(range: Range = 30) {
  const { data } = await api.get(`/api/mentions/topics?${qs(range)}`);
  return data;
}

export async function fetchCompetitors(range: Range = 30) {
  const { data } = await api.get(`/api/mentions/competitors?${qs(range)}`);
  return data;
}

export async function fetchUsers(range: Range = 30) {
  const { data } = await api.get(`/api/mentions/users?${qs(range)}`);
  return data;
}
