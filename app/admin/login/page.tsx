import { AdminLocaleSwitcher } from "@/components/admin/AdminLocaleSwitcher";
import { LoginForm } from "@/components/admin/LoginForm";
import { isAdminConfigured } from "@/lib/admin/auth";
import { getAdminTranslator } from "@/lib/admin/i18n/server";

export default async function AdminLoginPage() {
  const t = await getAdminTranslator("login");

  if (!isAdminConfigured()) {
    return (
      <main className="flex min-h-dvh items-center justify-center p-6">
        <div className="max-w-sm rounded-3xl border-2 border-dashed border-navy/20 bg-mist/50 p-8 text-center">
          <p className="font-display text-lg font-bold text-navy">{t("notConfiguredTitle")}</p>
          <p className="mt-2 text-navy/70">{t("notConfiguredBody")}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-between gap-3">
          <p className="label-eyebrow text-coral-deep">{t("eyebrow")}</p>
          <AdminLocaleSwitcher className="rounded-full border-2 border-navy/15 px-3 py-1 text-xs font-medium text-navy transition-colors hover:border-coral hover:text-coral-deep" />
        </div>
        <h1 className="text-section mt-3 text-navy">{t("title")}</h1>
        <p className="mt-3 text-navy/70">{t("subtitle")}</p>
        <div className="mt-8">
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
