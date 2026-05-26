import axios from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export const api = axios.create({ baseURL: API_URL });

export async function fetchStats(days = 7) {
  const { data } = await api.get(`/api/mentions/stats?days=${days}`);
  return data;
}

export async function fetchMentions(params: Record<string, string | number> = {}) {
  const { data } = await api.get("/api/mentions", { params });
  return data;
}

export async function fetchTrend(days = 7) {
  const { data } = await api.get(`/api/mentions/trend?days=${days}`);
  return data;
}

export async function fetchQCScoreboard(days = 7) {
  const { data } = await api.get(`/api/qc/scoreboard?days=${days}`);
  return data;
}

export async function createMention(payload: Record<string, unknown>) {
  const { data } = await api.post("/api/mentions", payload);
  return data;
}
