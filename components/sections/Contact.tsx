import { getTranslations } from "next-intl/server";

import { Section, SectionHeading } from "@/components/ui/Section";
import { Reveal } from "@/components/ui/Reveal";
import { isSupabaseConfigured } from "@/lib/supabase";
import { site } from "@/lib/site";
import { ContactForm } from "./ContactForm";

/** The consultation form. Rendered as its own page at /[locale]/contact. */
export async function Contact() {
  const t = await getTranslations("contact");

  return (
    <Section id="contact" tone="light" className="pt-14 md:pt-20">
      <div className="grid gap-12 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1fr)] lg:gap-20">
        <Reveal>
          <SectionHeading
            eyebrow={t("eyebrow")}
            title={t("title")}
            intro={t("intro")}
            as="h1"
          />

          <dl className="mt-10 space-y-6">
            <div>
              <dt className="label-eyebrow text-cobalt">{t("emailLabel")}</dt>
              <dd className="mt-2">
                <a
                  href={`mailto:${site.email}`}
                  dir="ltr"
                  className="text-lg text-ink underline underline-offset-4 hover:text-cobalt"
                >
                  {site.email}
                </a>
              </dd>
            </div>
            <div>
              <dt className="label-eyebrow text-cobalt">LinkedIn</dt>
              <dd className="mt-2">
                <a
                  href={site.social.linkedin}
                  target="_blank"
                  rel="noreferrer noopener"
                  dir="ltr"
                  className="text-lg text-ink underline underline-offset-4 hover:text-cobalt"
                >
                  /in/royavosoughi
                </a>
              </dd>
            </div>
            <div>
              <dt className="label-eyebrow text-cobalt">{t("responseLabel")}</dt>
              <dd className="mt-2 text-lg text-ink/75">{t("responseValue")}</dd>
            </div>
          </dl>
        </Reveal>

        <Reveal delayMs={100} className="rounded-3xl bg-mist/40 p-6 md:p-8">
          <ContactForm configured={isSupabaseConfigured()} email={site.email} />
        </Reveal>
      </div>
    </Section>
  );
}
