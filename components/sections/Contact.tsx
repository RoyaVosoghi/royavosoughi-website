import { getTranslations } from "next-intl/server";

import { Section, SectionHeading } from "@/components/ui/Section";
import { isSupabaseConfigured } from "@/lib/supabase";
import { site } from "@/lib/site";
import { ContactForm } from "./ContactForm";

export async function Contact() {
  const t = await getTranslations("contact");

  return (
    <Section id="contact" tone="light">
      <div className="grid gap-12 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1fr)] lg:gap-20">
        <div>
          <SectionHeading
            eyebrow={t("eyebrow")}
            title={t("title")}
            intro={t("intro")}
          />

          <dl className="mt-10 space-y-6">
            <div>
              <dt className="label-eyebrow text-emerald">{t("emailLabel")}</dt>
              <dd className="mt-2">
                <a
                  href={`mailto:${site.email}`}
                  dir="ltr"
                  className="text-lg text-forest underline underline-offset-4 hover:text-emerald"
                >
                  {site.email}
                </a>
              </dd>
            </div>
            <div>
              <dt className="label-eyebrow text-emerald">LinkedIn</dt>
              <dd className="mt-2">
                <a
                  href={site.social.linkedin}
                  target="_blank"
                  rel="noreferrer noopener"
                  dir="ltr"
                  className="text-lg text-forest underline underline-offset-4 hover:text-emerald"
                >
                  /in/royavosoughi
                </a>
              </dd>
            </div>
            <div>
              <dt className="label-eyebrow text-emerald">{t("responseLabel")}</dt>
              <dd className="mt-2 text-lg text-ink/75">{t("responseValue")}</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-3xl bg-mint/40 p-6 md:p-8">
          <ContactForm configured={isSupabaseConfigured()} email={site.email} />
        </div>
      </div>
    </Section>
  );
}
