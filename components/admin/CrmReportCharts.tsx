"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import type { LeadStatus, MonthlyRevenue, PipelineValueByStage } from "@/lib/admin/queries";

const COLORS = ["#00e5ff", "#9d4edd", "#f5b942", "#c79bf2", "#5ce1f0", "#aaa5d4"];

export function LeadFunnelChart({ stats }: { stats: Record<LeadStatus, number> }) {
  const data = (["new", "contacted", "qualified", "converted", "lost"] as LeadStatus[]).map((status) => ({
    status,
    count: stats[status],
  }));

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: -16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f8f9fa1f" vertical={false} />
          <XAxis dataKey="status" tick={{ fontSize: 12, fill: "#aaa5d4" }} tickLine={false} axisLine={{ stroke: "#f8f9fa1f" }} />
          <YAxis tick={{ fontSize: 12, fill: "#aaa5d4" }} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #9d4edd55", background: "#1a1640", color: "#f8f9fa", fontSize: 13 }} cursor={{ fill: "#9d4edd1a" }} />
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
          <CartesianGrid strokeDasharray="3 3" stroke="#f8f9fa1f" horizontal={false} />
          <XAxis
            type="number"
            tick={{ fontSize: 12, fill: "#aaa5d4" }}
            tickLine={false}
            axisLine={{ stroke: "#f8f9fa1f" }}
            tickFormatter={(v) => `$${v}`}
          />
          <YAxis type="category" dataKey="stage" width={120} tick={{ fontSize: 11, fill: "#aaa5d4" }} tickLine={false} axisLine={false} />
          <Tooltip
            formatter={(value) => [`$${Number(value).toFixed(2)}`, "Value"]}
            contentStyle={{ borderRadius: 12, border: "1px solid #9d4edd55", background: "#1a1640", color: "#f8f9fa", fontSize: 13 }}
            cursor={{ fill: "#9d4edd1a" }}
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
          <CartesianGrid strokeDasharray="3 3" stroke="#f8f9fa1f" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#aaa5d4" }} tickLine={false} axisLine={{ stroke: "#f8f9fa1f" }} />
          <YAxis tick={{ fontSize: 12, fill: "#aaa5d4" }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
          <Tooltip
            formatter={(value) => [`$${Number(value).toFixed(2)}`, "Revenue"]}
            contentStyle={{ borderRadius: 12, border: "1px solid #9d4edd55", background: "#1a1640", color: "#f8f9fa", fontSize: 13 }}
            cursor={{ fill: "#9d4edd1a" }}
          />
          <Bar dataKey="amountUsd" radius={[8, 8, 0, 0]} fill={COLORS[0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
