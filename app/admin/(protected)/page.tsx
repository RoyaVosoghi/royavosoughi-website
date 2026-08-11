import { EmptyState } from "@/components/admin/EmptyState";
import { StatCard } from "@/components/admin/StatCard";
import { getDashboardStats } from "@/lib/admin/queries";
import { isSupabaseServiceConfigured } from "@/lib/supabase-admin";

export const metadata = { title: "Overview · Admin" };

export default async function AdminOverviewPage() {
  if (!isSupabaseServiceConfigured()) {
    return (
      <EmptyState
        title="Supabase isn't configured"
        body="Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to see live data here."
      />
    );
  }

  const stats = await getDashboardStats();
  const totalSessions =
    stats.sessionsByChannel.web + stats.sessionsByChannel.telegram + stats.sessionsByChannel.widget;

  return (
    <div>
      <p className="label-eyebrow text-emerald">Dashboard</p>
      <h1 className="text-section mt-3 text-forest">Overview</h1>

      <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Leads" value={stats.leadsCount} />
        <StatCard label="Registrations" value={stats.registrationsCount} />
        <StatCard label="KB chunks" value={stats.kbChunksCount} hint="Ingested RAG context" />
        <StatCard label="Conversations" value={totalSessions} />
      </div>

      <h2 className="mt-12 font-display text-xl font-bold text-forest">Conversations by channel</h2>
      <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-3">
        <StatCard label="Web" value={stats.sessionsByChannel.web} />
        <StatCard label="Telegram" value={stats.sessionsByChannel.telegram} />
        <StatCard label="Widget" value={stats.sessionsByChannel.widget} />
      </div>
    </div>
  );
}
