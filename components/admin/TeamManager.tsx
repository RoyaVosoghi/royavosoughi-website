"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";

import type { AdminRole } from "@/lib/admin/auth";
import type { AdminUserRow } from "@/lib/admin/queries";

const ROLES: AdminRole[] = ["owner", "admin", "editor", "operator", "viewer"];

export function TeamManager({ initial, currentAdminId }: { initial: AdminUserRow[]; currentAdminId: string }) {
  const t = useTranslations("team.manager");
  const router = useRouter();
  const [users, setUsers] = useState(initial);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<AdminRole>("viewer");
  const [status, setStatus] = useState<"idle" | "submitting" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const ROLE_HINT: Record<AdminRole, string> = {
    owner: t("roleHintOwner"),
    admin: t("roleHintAdmin"),
    editor: t("roleHintEditor"),
    operator: t("roleHintOperator"),
    viewer: t("roleHintViewer"),
  };
  const ROLE_LABEL: Record<AdminRole, string> = {
    owner: t("roleLabelOwner"),
    admin: t("roleLabelAdmin"),
    editor: t("roleLabelEditor"),
    operator: t("roleLabelOperator"),
    viewer: t("roleLabelViewer"),
  };

  async function createUser() {
    setStatus("submitting");
    setError(null);
    const response = await fetch("/api/admin/team", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, role }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setError(body.error === "storage_failed" ? t("errorStorageFailed") : t("errorGeneric"));
      setStatus("error");
      return;
    }
    setEmail("");
    setPassword("");
    setRole("viewer");
    setStatus("idle");
    router.refresh();
  }

  async function changeRole(id: string, newRole: AdminRole) {
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, role: newRole } : u)));
    const response = await fetch(`/api/admin/team/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: newRole }),
    });
    if (!response.ok) router.refresh();
  }

  async function removeUser(id: string) {
    if (!confirm(t("confirmRemove"))) return;
    const response = await fetch(`/api/admin/team/${id}`, { method: "DELETE" });
    if (response.ok) {
      setUsers((prev) => prev.filter((u) => u.id !== id));
    } else {
      const body = await response.json().catch(() => ({}));
      alert(body.error === "last_owner" ? t("errorLastOwner") : t("errorRemoveFailed"));
    }
  }

  async function resetPassword(id: string) {
    const newPassword = prompt(t("promptNewPassword"));
    if (!newPassword) return;
    const response = await fetch(`/api/admin/team/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: newPassword }),
    });
    if (!response.ok) alert(t("errorResetFailed"));
    else {
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, hasPassword: true } : u)));
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-3xl border-2 border-forest/10 bg-offwhite p-6">
        <h2 className="font-display text-lg font-bold text-forest">{t("adminsTitle")}</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <thead>
              <tr className="border-b-2 border-forest/10 text-start">
                <th className="px-4 py-2 font-display text-xs font-bold tracking-wide text-forest/70 uppercase">{t("colEmail")}</th>
                <th className="px-4 py-2 font-display text-xs font-bold tracking-wide text-forest/70 uppercase">{t("colRole")}</th>
                <th className="px-4 py-2 font-display text-xs font-bold tracking-wide text-forest/70 uppercase">{t("colPassword")}</th>
                <th className="px-4 py-2 font-display text-xs font-bold tracking-wide text-forest/70 uppercase">{t("colActions")}</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-forest/5 last:border-0">
                  <td className="px-4 py-3 text-ink/85">
                    {u.email}
                    {u.id === currentAdminId ? <span className="ms-2 text-xs text-emerald">{t("youSuffix")}</span> : null}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={u.role}
                      onChange={(e) => changeRole(u.id, e.target.value as AdminRole)}
                      className="rounded-lg border-2 border-forest/15 bg-offwhite px-2 py-1 text-sm"
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABEL[r]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-ink/70">{u.hasPassword ? t("passwordSet") : t("passwordBootstrap")}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-3">
                      <button type="button" onClick={() => resetPassword(u.id)} className="text-sm font-medium text-emerald hover:underline">
                        {t("resetPassword")}
                      </button>
                      <button type="button" onClick={() => removeUser(u.id)} className="text-sm font-medium text-saffron-deep hover:underline">
                        {t("remove")}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-ink/50">{ROLE_HINT[role]}</p>
      </div>

      <div className="rounded-3xl border-2 border-forest/10 bg-offwhite p-6">
        <h2 className="font-display text-lg font-bold text-forest">{t("addAdminTitle")}</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <input
            type="email"
            placeholder={t("emailPlaceholder")}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-2xl border-2 border-forest/15 bg-offwhite px-4 py-2.5 text-ink focus:border-emerald focus:outline-none"
          />
          <input
            type="text"
            placeholder={t("passwordPlaceholder")}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-2xl border-2 border-forest/15 bg-offwhite px-4 py-2.5 text-ink focus:border-emerald focus:outline-none"
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as AdminRole)}
            className="rounded-2xl border-2 border-forest/15 bg-offwhite px-4 py-2.5 text-ink focus:border-emerald focus:outline-none"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </select>
        </div>
        {error ? <p className="mt-3 text-sm font-medium text-saffron-deep">{error}</p> : null}
        <button
          type="button"
          onClick={createUser}
          disabled={status === "submitting" || !email || password.length < 8}
          className="mt-4 rounded-full bg-emerald px-6 py-2.5 text-sm font-semibold text-offwhite transition-colors hover:bg-forest disabled:opacity-50"
        >
          {status === "submitting" ? t("adding") : t("addAdminButton")}
        </button>
      </div>
    </div>
  );
}
