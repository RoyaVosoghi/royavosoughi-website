"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const COLORS = ["#00e5ff", "#9d4edd", "#f5b942", "#c79bf2", "#5ce1f0", "#aaa5d4"];

export function ChannelBreakdownChart({ sessionsByChannel }: { sessionsByChannel: Record<string, number> }) {
  const data = Object.entries(sessionsByChannel).map(([channel, count]) => ({ channel, count }));

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: -16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f8f9fa1f" vertical={false} />
          <XAxis dataKey="channel" tick={{ fontSize: 12, fill: "#aaa5d4" }} tickLine={false} axisLine={{ stroke: "#f8f9fa1f" }} />
          <YAxis tick={{ fontSize: 12, fill: "#aaa5d4" }} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip
            contentStyle={{ borderRadius: 12, border: "1px solid #9d4edd55", background: "#1a1640", color: "#f8f9fa", fontSize: 13 }}
            cursor={{ fill: "#9d4edd1a" }}
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
          <CartesianGrid strokeDasharray="3 3" stroke="#f8f9fa1f" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 12, fill: "#aaa5d4" }} tickLine={false} axisLine={{ stroke: "#f8f9fa1f" }} tickFormatter={(v) => `$${v.toFixed(2)}`} />
          <YAxis type="category" dataKey="model" width={160} tick={{ fontSize: 11, fill: "#aaa5d4" }} tickLine={false} axisLine={false} />
          <Tooltip
            formatter={(value) => [`$${Number(value).toFixed(4)}`, "Est. cost"]}
            contentStyle={{ borderRadius: 12, border: "1px solid #9d4edd55", background: "#1a1640", color: "#f8f9fa", fontSize: 13 }}
            cursor={{ fill: "#9d4edd1a" }}
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
