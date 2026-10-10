"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import type { LeadStatus, MonthlyRevenue, PipelineValueByStage } from "@/lib/admin/queries";

const COLORS = ["#1e1e1e", "#0047ab", "#6b6b6b", "#e3a72f", "#7fa6e8", "#b8b0a6"];

export function LeadFunnelChart({ stats }: { stats: Record<LeadStatus, number> }) {
  const data = (["new", "contacted", "qualified", "converted", "lost"] as LeadStatus[]).map((status) => ({
    status,
    count: stats[status],
  }));

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: -16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e1e1e1f" vertical={false} />
          <XAxis dataKey="status" tick={{ fontSize: 12, fill: "#1e1e1e" }} tickLine={false} axisLine={{ stroke: "#1e1e1e1f" }} />
          <YAxis tick={{ fontSize: 12, fill: "#1e1e1e" }} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #1e1e1e22", background: "#ffffff", color: "#1e1e1e", fontSize: 13 }} cursor={{ fill: "#ebdfd1" }} />
          <Bar dataKey="count" radius={[8, 8, 0, 0]}>
            {data.map((entry, i) => (
              <Cell key={entry.status} fill={COLORS[i % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function PipelineValueChart({ stages, noDataLabel }: { stages: PipelineValueByStage[]; noDataLabel: string }) {
  if (stages.length === 0) return <p className="text-sm text-soft/60">{noDataLabel}</p>;
  const data = stages.map((s) => ({ stage: s.stageName, valueUsd: s.totalAmountCents / 100 }));

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 8, right: 24, bottom: 8, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e1e1e1f" horizontal={false} />
          <XAxis
            type="number"
            tick={{ fontSize: 12, fill: "#1e1e1e" }}
            tickLine={false}
            axisLine={{ stroke: "#1e1e1e1f" }}
            tickFormatter={(v) => `$${v}`}
          />
          <YAxis type="category" dataKey="stage" width={120} tick={{ fontSize: 11, fill: "#1e1e1e" }} tickLine={false} axisLine={false} />
          <Tooltip
            formatter={(value) => [`$${Number(value).toFixed(2)}`, "Value"]}
            contentStyle={{ borderRadius: 12, border: "1px solid #1e1e1e22", background: "#ffffff", color: "#1e1e1e", fontSize: 13 }}
            cursor={{ fill: "#ebdfd1" }}
          />
          <Bar dataKey="valueUsd" radius={[0, 8, 8, 0]}>
            {data.map((entry, i) => (
              <Cell key={entry.stage} fill={COLORS[i % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function MonthlyRevenueChart({ months, noDataLabel }: { months: MonthlyRevenue[]; noDataLabel: string }) {
  if (months.length === 0) return <p className="text-sm text-soft/60">{noDataLabel}</p>;

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={months} margin={{ top: 8, right: 8, bottom: 8, left: -16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e1e1e1f" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#1e1e1e" }} tickLine={false} axisLine={{ stroke: "#1e1e1e1f" }} />
          <YAxis tick={{ fontSize: 12, fill: "#1e1e1e" }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
          <Tooltip
            formatter={(value) => [`$${Number(value).toFixed(2)}`, "Revenue"]}
            contentStyle={{ borderRadius: 12, border: "1px solid #1e1e1e22", background: "#ffffff", color: "#1e1e1e", fontSize: 13 }}
            cursor={{ fill: "#ebdfd1" }}
          />
          <Bar dataKey="amountUsd" radius={[8, 8, 0, 0]} fill={COLORS[0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
