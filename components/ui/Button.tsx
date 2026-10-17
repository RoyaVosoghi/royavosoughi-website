import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "onDark" | "onDarkGhost";

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-semibold " +
  "px-7 py-3.5 text-base leading-none transition-all duration-200 " +
  "focus-visible:outline-3 focus-visible:outline-offset-3 " +
  "disabled:opacity-50 disabled:pointer-events-none";

const variants: Record<Variant, string> = {
  // Cobalt solid — the one primary action per screen. Text on cobalt is
  // white in light (8:1; ink on cobalt is only 2.2:1) — on-cobalt flips it in
  // dark. Hover deepens to cobalt-dark and the press-shadow is an Ink line
  // (black in dark, where Ink is cream).
  primary:
    "bg-cobalt text-on-cobalt shadow-[0_2px_0_0_var(--btn-press,var(--color-ink))] " +
    "hover:bg-cobalt-dark hover:-translate-y-0.5 hover:shadow-[0_4px_0_0_var(--btn-press,var(--color-ink))] active:translate-y-0",
  // Outlined on light
  secondary:
    "border-2 border-ink text-ink hover:bg-ink hover:text-canvas",
  // Cobalt on Ink sections — white text keeps 8:1; hover flips to cream
  onDark:
    "bg-cobalt text-on-cobalt hover:bg-canvas hover:text-ink hover:-translate-y-0.5 active:translate-y-0",
  onDarkGhost:
    "border-2 border-fog text-canvas hover:bg-canvas hover:text-ink hover:border-canvas",
};

type LinkProps = { href: string; variant?: Variant; children: ReactNode } & Omit<
  AnchorHTMLAttributes<HTMLAnchorElement>,
  "href" | "className"
>;

/** For in-page anchors and external URLs. Locale routes use LocaleButtonLink. */
export function ButtonLink({
  href,
  variant = "primary",
  children,
  ...rest
}: LinkProps) {
  return (
    <a href={href} className={`${base} ${variants[variant]}`} {...rest}>
      {children}
    </a>
  );
}

type ButtonProps = { variant?: Variant; children: ReactNode } & Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "className"
>;

export function Button({ variant = "primary", children, ...rest }: ButtonProps) {
  return (
    <button className={`${base} ${variants[variant]}`} {...rest}>
      {children}
    </button>
  );
}

export const buttonStyles = (variant: Variant = "primary") =>
  `${base} ${variants[variant]}`;
