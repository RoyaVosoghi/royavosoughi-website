import { getTranslations } from "next-intl/server";

import { site } from "@/lib/site";

/**
 * Fixed vertical social rail, desktop only — the sidebar-links-plus-line
 * pattern used by well-known individual developer portfolios (e.g. Brittany
 * Chiang's). `start-*` is a logical property, so this mirrors to the right
 * edge for free under `dir="rtl"`. The same links already live in the
 * Footer for mobile/keyboard-linear access; this is a desktop-only echo,
 * not the only way to reach them.
 */
export async function SocialRail() {
  const t = await getTranslations("contact");

  const links = [
    { label: "GitHub", href: site.social.github, icon: GithubIcon },
    { label: "LinkedIn", href: site.social.linkedin, icon: LinkedinIcon },
    { label: "Instagram", href: site.social.instagram, icon: InstagramIcon },
    { label: t("emailLabel"), href: `mailto:${site.email}`, icon: MailIcon },
  ];

  return (
    <div className="fixed bottom-0 start-6 z-20 hidden lg:flex lg:flex-col lg:items-center xl:start-10">
      <ul className="flex flex-col items-center gap-5">
        {links.map(({ label, href, icon: Icon }) => (
          <li key={label}>
            <a
              href={href}
              target={href.startsWith("mailto:") ? undefined : "_blank"}
              rel={href.startsWith("mailto:") ? undefined : "noreferrer noopener"}
              aria-label={label}
              className="block text-forest/50 transition-all duration-200 hover:-translate-y-0.5 hover:text-emerald"
            >
              <Icon />
            </a>
          </li>
        ))}
      </ul>
      <span aria-hidden="true" className="mt-6 h-24 w-px bg-forest/20" />
    </div>
  );
}

const iconProps = {
  viewBox: "0 0 24 24",
  width: 19,
  height: 19,
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

function GithubIcon() {
  return (
    <svg {...iconProps}>
      <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
    </svg>
  );
}

function LinkedinIcon() {
  return (
    <svg {...iconProps}>
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
      <rect x="2" y="9" width="4" height="12" />
      <circle cx="4" cy="4" r="2" />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg {...iconProps}>
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg {...iconProps}>
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  );
}
