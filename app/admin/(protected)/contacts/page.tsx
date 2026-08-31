import Link from "next/link";

import { AddContactForm } from "@/components/admin/AddContactForm";
import { ContactStatusSelect } from "@/components/admin/ContactStatusSelect";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { EmptyState } from "@/components/admin/EmptyState";
import { getAdminTranslator } from "@/lib/admin/i18n/server";
import { getContacts, type Contact } from "@/lib/admin/queries";
import { isSupabaseServiceConfigured } from "@/lib/supabase-admin";

export const metadata = { title: "Contacts · Admin" };

function buildColumns(t: Awaited<ReturnType<typeof getAdminTranslator<"contacts">>>): Column<Contact>[] {
  return [
    {
      header: t("columnName"),
      cell: (row) => (
        <Link href={`/admin/contacts/${row.id}`} className="font-medium text-forest hover:underline">
          {row.name}
        </Link>
      ),
    },
    { header: t("columnEmail"), cell: (row) => row.email },
    { header: t("columnCompany"), cell: (row) => row.companyName ?? "—" },
    { header: t("columnStatus"), cell: (row) => <ContactStatusSelect id={row.id} status={row.status} /> },
    {
      header: t("columnCreated"),
      numeric: true,
      cell: (row) => new Date(row.createdAt).toLocaleString(),
    },
  ];
}

export default async function AdminContactsPage() {
  const t = await getAdminTranslator("contacts");

  if (!isSupabaseServiceConfigured()) {
    return <EmptyState title={t("notConfiguredTitle")} body={t("notConfiguredBody")} />;
  }

  const contacts = await getContacts();
  const columns = buildColumns(t);

  return (
    <div>
      <p className="label-eyebrow text-emerald">{t("eyebrow")}</p>
      <h1 className="text-section mt-3 text-forest">{t("title")}</h1>
      <p className="mt-3 text-ink/70">{t("subtitle")}</p>

      <div className="mt-8 flex flex-col gap-6">
        <AddContactForm />
        {contacts.length === 0 ? (
          <EmptyState title={t("emptyTitle")} body={t("emptyBody")} />
        ) : (
          <DataTable columns={columns} rows={contacts} />
        )}
      </div>
    </div>
  );
}
