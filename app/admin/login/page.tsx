import { AdminLocaleSwitcher } from "@/components/admin/AdminLocaleSwitcher";
import { LoginForm } from "@/components/admin/LoginForm";
import { isAdminConfigured } from "@/lib/admin/auth";
import { getAdminTranslator } from "@/lib/admin/i18n/server";

export default async function AdminLoginPage() {
  const t = await getAdminTranslator("login");

  if (!isAdminConfigured()) {
    return (
      <main className="flex min-h-dvh items-center justify-center p-6">
        <div className="max-w-sm rounded-3xl border-2 border-dashed border-soft/20 bg-violet/12 p-8 text-center">
          <p className="font-display text-lg font-bold text-soft">{t("notConfiguredTitle")}</p>
          <p className="mt-2 text-soft/70">{t("notConfiguredBody")}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-between gap-3">
          <p className="label-eyebrow text-cyan">{t("eyebrow")}</p>
          <AdminLocaleSwitcher className="rounded-full border-2 border-soft/15 px-3 py-1 text-xs font-medium text-soft transition-colors hover:border-cyan hover:text-cyan" />
        </div>
        <h1 className="text-section mt-3 text-soft">{t("title")}</h1>
        <p className="mt-3 text-soft/70">{t("subtitle")}</p>
        <div className="mt-8">
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
