import { LoginForm } from "@/components/admin/LoginForm";
import { isAdminConfigured } from "@/lib/admin/auth";

export default function AdminLoginPage() {
  if (!isAdminConfigured()) {
    return (
      <main className="flex min-h-dvh items-center justify-center p-6">
        <div className="max-w-sm rounded-3xl border-2 border-dashed border-forest/20 bg-mint/50 p-8 text-center">
          <p className="font-display text-lg font-bold text-forest">Admin not configured</p>
          <p className="mt-2 text-ink/70">
            Set ADMIN_PASSWORD and ADMIN_SESSION_SECRET in the environment to enable this panel.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <p className="label-eyebrow text-emerald">Roya.Admin</p>
        <h1 className="text-section mt-3 text-forest">Sign in</h1>
        <p className="mt-3 text-ink/70">Internal dashboard — leads, registrations, conversations.</p>
        <div className="mt-8">
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
