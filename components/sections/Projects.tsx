import { getLocale, getTranslations } from "next-intl/server";

import { Section, SectionHeading } from "@/components/ui/Section";
import { Reveal } from "@/components/ui/Reveal";
import { ButtonLink } from "@/components/ui/Button";
import { visibleProjects } from "@/content/projects";
import { site } from "@/lib/site";

export async function Projects() {
  const t = await getTranslations("projects");
  const locale = await getLocale();
  const items = visibleProjects();
  const copyFor = (p: (typeof items)[number]) =>
    locale === "fa" ? p.fa : p.en;

  return (
    <Section id="projects" tone="light">
      <Reveal>
        <SectionHeading
          eyebrow={t("eyebrow")}
          title={t("title")}
          intro={t("intro")}
        />
      </Reveal>

      {items.length === 0 ? (
        /* Honest empty state. Better than inventing work that does not exist. */
        <Reveal
          delayMs={80}
          className="mt-12 rounded-3xl border-2 border-dashed border-forest/15 bg-mint/40 p-10 text-center"
        >
          <p className="mx-auto max-w-md text-lg text-ink/75">
            {t("emptyState")}
          </p>
          <a
            href={site.social.github}
            target="_blank"
            rel="noreferrer noopener"
            className="mt-5 inline-block font-semibold text-emerald underline underline-offset-4 hover:text-forest"
          >
            {t("followGithub")}
          </a>
        </Reveal>
      ) : (
        <ul className="mt-14 grid gap-6 md:grid-cols-2">
          {items.map((project, i) => {
            const copy = copyFor(project);
            return (
              <li key={project.slug}>
                <Reveal
                  delayMs={80 + i * 80}
                  className="flex h-full flex-col rounded-3xl border border-forest/10 bg-offwhite p-8 transition-all duration-200 hover:-translate-y-1 hover:border-emerald/40 hover:shadow-[0_12px_32px_-12px_rgba(2,51,22,0.25)]"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm text-ink/70">
                      {project.year}
                    </span>
                    {project.draft ? (
                      <span className="rounded-full bg-saffron/20 px-2.5 py-0.5 font-mono text-xs font-bold text-saffron-deep">
                        DRAFT — dev only
                      </span>
                    ) : null}
                  </div>

                  <h3 className="mt-3 text-2xl text-forest">{copy.title}</h3>
                  <p className="mt-3 text-ink/75">{copy.problem}</p>

                  <ul className="mt-5 flex flex-wrap gap-2">
                    {project.tags.map((tag) => (
                      <li
                        key={tag}
                        className="rounded-full bg-mint px-3 py-1 font-mono text-xs font-medium text-forest"
                      >
                        {tag}
                      </li>
                    ))}
                  </ul>

                  <p className="mt-6 rounded-2xl bg-mint/50 p-4 text-[0.9375rem] text-ink/80">
                    <span className="font-semibold text-emerald">
                      {t("learnedLabel")}{" "}
                    </span>
                    {copy.learned}
                  </p>

                  <div className="mt-auto flex flex-wrap gap-5 pt-6">
                    {project.links.demo ? (
                      <a
                        href={project.links.demo}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="font-semibold text-emerald underline underline-offset-4 hover:text-forest"
                      >
                        {t("liveDemo")} →
                      </a>
                    ) : null}
                    {project.links.github ? (
                      <a
                        href={project.links.github}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="font-semibold text-emerald underline underline-offset-4 hover:text-forest"
                      >
                        {t("sourceCode")} →
                      </a>
                    ) : null}
                  </div>
                </Reveal>
              </li>
            );
          })}
        </ul>
      )}

      <Reveal
        delayMs={items.length * 80 + 80}
        className="mt-14 flex flex-col items-center gap-4 text-center sm:flex-row sm:justify-between sm:text-start"
      >
        <p className="text-xl text-forest">{t("ctaTitle")}</p>
        <ButtonLink href="#contact" variant="secondary">
          {t("ctaButton")}
        </ButtonLink>
      </Reveal>
    </Section>
  );
}
