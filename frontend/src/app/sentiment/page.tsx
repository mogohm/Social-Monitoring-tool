"use client";
import { useEffect, useState } from "react";
import { fetchTrend } from "@/lib/api";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

export default function SentimentPage() {
  const [trend, setTrend] = useState<{ date: string; positive: number; neutral: number; negative: number }[]>([]);

  useEffect(() => { fetchTrend(14).then(setTrend).catch(() => {}); }, []);

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-gray-900">Sentiment Analysis</h1>
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Sentiment Over Time (14 days)</h2>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={trend} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            <Bar dataKey="positive" fill="#22c55e" radius={[3, 3, 0, 0]} />
            <Bar dataKey="neutral" fill="#94a3b8" radius={[3, 3, 0, 0]} />
            <Bar dataKey="negative" fill="#ef4444" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
