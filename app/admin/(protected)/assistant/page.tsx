import { AssistantChat } from "@/components/admin/crm/AssistantChat";
import { getAdminTranslator } from "@/lib/admin/i18n/server";

export const metadata = { title: "Assistant · Admin" };

export default async function AdminAssistantPage() {
  const t = await getAdminTranslator("assistant");
  return (
    <div>
      <p className="label-eyebrow text-cobalt">{t("eyebrow")}</p>
      <h1 className="text-section mt-3 text-ink">{t("title")}</h1>
      <p className="mt-3 max-w-3xl text-ink/70">{t("subtitle")}</p>
      <div className="mt-8 max-w-4xl">
        <AssistantChat />
      </div>
    </div>
  );
}
