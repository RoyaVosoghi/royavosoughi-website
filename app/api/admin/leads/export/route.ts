import { NextResponse } from "next/server";

import { requireRole } from "@/lib/admin/auth";
import { getLeads } from "@/lib/admin/queries";

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export async function GET() {
  const gate = await requireRole("viewer");
  if (!gate.ok) {
    return NextResponse.json({ error: "unauthorized" }, { status: gate.status });
  }

  const leads = await getLeads(1000);

  const header = ["Name", "Email", "Interest", "Source", "Locale", "Status", "Notes", "Created at"];
  const rows = leads.map((l) =>
    [l.name, l.email, l.interest ?? "", l.source ?? "", l.locale, l.status, l.notes ?? "", l.createdAt].map((v) =>
      csvEscape(String(v)),
    ),
  );
  const csv = [header, ...rows].map((r) => r.join(",")).join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="leads-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
