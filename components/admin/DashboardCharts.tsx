"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const COLORS = ["#1e1e1e", "#0047ab", "#6b6b6b", "#e3a72f", "#7fa6e8", "#b8b0a6"];

export function ChannelBreakdownChart({ sessionsByChannel }: { sessionsByChannel: Record<string, number> }) {
  const data = Object.entries(sessionsByChannel).map(([channel, count]) => ({ channel, count }));

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: -16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e1e1e1f" vertical={false} />
          <XAxis dataKey="channel" tick={{ fontSize: 12, fill: "#1e1e1e" }} tickLine={false} axisLine={{ stroke: "#1e1e1e1f" }} />
          <YAxis tick={{ fontSize: 12, fill: "#1e1e1e" }} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip
            contentStyle={{ borderRadius: 12, border: "1px solid #1e1e1e22", background: "#ffffff", color: "#1e1e1e", fontSize: 13 }}
            cursor={{ fill: "#ebdfd1" }}
          />
          <Bar dataKey="count" radius={[8, 8, 0, 0]}>
            {data.map((entry, i) => (
              <Cell key={entry.channel} fill={COLORS[i % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CostByModelChart({ byModel }: { byModel: Array<{ model: string; costUsd: number }> }) {
  if (byModel.length === 0) {
    return <p className="text-sm text-soft/60">No model usage recorded yet this month.</p>;
  }

  const data = [...byModel].sort((a, b) => b.costUsd - a.costUsd).slice(0, 8);

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 8, right: 24, bottom: 8, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e1e1e1f" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 12, fill: "#1e1e1e" }} tickLine={false} axisLine={{ stroke: "#1e1e1e1f" }} tickFormatter={(v) => `$${v.toFixed(2)}`} />
          <YAxis type="category" dataKey="model" width={160} tick={{ fontSize: 11, fill: "#1e1e1e" }} tickLine={false} axisLine={false} />
          <Tooltip
            formatter={(value) => [`$${Number(value).toFixed(4)}`, "Est. cost"]}
            contentStyle={{ borderRadius: 12, border: "1px solid #1e1e1e22", background: "#ffffff", color: "#1e1e1e", fontSize: 13 }}
            cursor={{ fill: "#ebdfd1" }}
          />
          <Bar dataKey="costUsd" radius={[0, 8, 8, 0]}>
            {data.map((entry, i) => (
              <Cell key={entry.model} fill={COLORS[i % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
