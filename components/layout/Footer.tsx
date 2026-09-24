import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { Wordmark } from "@/components/ui/Logo";
import { site } from "@/lib/site";

export async function Footer() {
  const t = await getTranslations("footer");
  const nav = await getTranslations("nav");
  const year = new Date().getFullYear();

  const links = [
    { label: "LinkedIn", href: site.social.linkedin },
    { label: "GitHub", href: site.social.github },
    { label: "Instagram", href: site.social.instagram },
  ];

  return (
    <footer className="bg-navy text-canvas">
      <div className="container-page py-16 md:py-20">
        <div className="flex flex-col gap-12 md:flex-row md:items-start md:justify-between">
          <div className="max-w-sm">
            <Wordmark className="text-canvas" />
            <p className="mt-5 text-lg text-mist">{t("tagline")}</p>
            <a
              href={`mailto:${site.email}`}
              className="mt-6 inline-block text-fog underline underline-offset-4 transition-colors hover:text-coral"
            >
              {site.email}
            </a>
          </div>

          <div className="flex flex-col gap-10 sm:flex-row sm:gap-16">
            <nav aria-label={t("siteLinks")}>
              <h2 className="label-eyebrow text-fog">{t("siteLinks")}</h2>
              <ul className="mt-5 space-y-3">
                {(["services", "process", "projects", "about", "contact"] as const).map(
                  (key) => (
                    <li key={key}>
                      <Link
                        href={key === "about" ? "/about" : `/#${key}`}
                        className="text-mist transition-colors hover:text-coral"
                      >
                        {nav(key)}
                      </Link>
                    </li>
                  ),
                )}
              </ul>
            </nav>

            <nav aria-label={t("elsewhere")}>
              <h2 className="label-eyebrow text-fog">{t("elsewhere")}</h2>
              <ul className="mt-5 space-y-3">
                {links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="text-mist transition-colors hover:text-coral"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </div>

        <p className="mt-14 border-t border-fog/20 pt-8 text-sm text-fog">
          © {year} {site.name} · {site.founder}. {t("rights")}
        </p>
      </div>
    </footer>
  );
}
