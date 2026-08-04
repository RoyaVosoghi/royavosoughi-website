import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "onDark" | "onDarkGhost";

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-semibold " +
  "px-7 py-3.5 text-base leading-none transition-all duration-200 " +
  "focus-visible:outline-3 focus-visible:outline-offset-3 " +
  "disabled:opacity-50 disabled:pointer-events-none";

const variants: Record<Variant, string> = {
  // Emerald solid on light — the one primary action per screen
  primary:
    "bg-emerald text-offwhite shadow-[0_2px_0_0_var(--color-forest)] " +
    "hover:bg-forest hover:-translate-y-0.5 hover:shadow-[0_4px_0_0_var(--color-forest)] active:translate-y-0",
  // Outlined on light
  secondary:
    "border-2 border-forest text-forest hover:bg-forest hover:text-offwhite",
  // Spring on Deep Forest — the guide's designated CTA-on-dark
  onDark:
    "bg-spring text-forest hover:bg-offwhite hover:-translate-y-0.5 active:translate-y-0",
  onDarkGhost:
    "border-2 border-mint-deep text-offwhite hover:bg-offwhite hover:text-forest hover:border-offwhite",
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
