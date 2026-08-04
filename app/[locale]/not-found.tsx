import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { buttonStyles } from "@/components/ui/Button";

export default async function LocaleNotFound() {
  const t = await getTranslations("notFound");

  return (
    <div className="container-page flex min-h-[60vh] flex-col items-center justify-center py-24 text-center">
      <p className="font-mono text-6xl font-bold text-spring">404</p>
      <h1 className="text-section mt-6 text-forest">{t("title")}</h1>
      <p className="mt-4 max-w-md text-lg text-ink/70">{t("body")}</p>
      <Link href="/" className={`${buttonStyles("primary")} mt-9`}>
        {t("cta")}
      </Link>
    </div>
  );
}
