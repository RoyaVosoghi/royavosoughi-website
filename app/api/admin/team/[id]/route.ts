import { NextResponse } from "next/server";
import { z } from "zod";

import { requireRole } from "@/lib/admin/auth";
import { deleteAdminUser, getAdminUsers, resetAdminUserPassword, updateAdminUserRole, writeAuditLog } from "@/lib/admin/queries";

const PatchSchema = z.object({
  role: z.enum(["owner", "admin", "editor", "operator", "viewer"]).optional(),
  password: z.string().min(8).max(200).optional(),
});

async function ownerCount(): Promise<number> {
  const users = await getAdminUsers();
  return users.filter((u) => u.role === "owner").length;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireRole("owner");
  if (!gate.ok) {
    return NextResponse.json({ error: "unauthorized" }, { status: gate.status });
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success || (!parsed.data.role && !parsed.data.password)) {
    return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  }

  try {
    if (parsed.data.role) {
      if (id === gate.admin.id && parsed.data.role !== "owner" && (await ownerCount()) <= 1) {
        return NextResponse.json({ error: "last_owner" }, { status: 400 });
      }
      await updateAdminUserRole(id, parsed.data.role);
      await writeAuditLog("team.role_update", `${id} -> ${parsed.data.role}`);
    }
    if (parsed.data.password) {
      await resetAdminUserPassword(id, parsed.data.password);
      await writeAuditLog("team.password_reset", id);
    }
  } catch (err) {
    console.error("[admin/team] update failed:", err);
    return NextResponse.json({ error: "storage_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireRole("owner");
  if (!gate.ok) {
    return NextResponse.json({ error: "unauthorized" }, { status: gate.status });
  }

  const { id } = await params;

  if (id === gate.admin.id) {
    return NextResponse.json({ error: "cannot_delete_self" }, { status: 400 });
  }

  try {
    const users = await getAdminUsers();
    const target = users.find((u) => u.id === id);
    if (target?.role === "owner" && (await ownerCount()) <= 1) {
      return NextResponse.json({ error: "last_owner" }, { status: 400 });
    }
    await deleteAdminUser(id);
    await writeAuditLog("team.delete", id);
  } catch (err) {
    console.error("[admin/team] delete failed:", err);
    return NextResponse.json({ error: "storage_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
