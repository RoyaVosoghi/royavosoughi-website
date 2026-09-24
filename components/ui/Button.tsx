import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "onDark" | "onDarkGhost";

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-semibold " +
  "px-7 py-3.5 text-base leading-none transition-all duration-200 " +
  "focus-visible:outline-3 focus-visible:outline-offset-3 " +
  "disabled:opacity-50 disabled:pointer-events-none";

const variants: Record<Variant, string> = {
  // Coral solid — the one primary action per screen. Text on coral is
  // always Navy (white on coral is only 3:1); hover lightens to coral-soft
  // and the press-shadow is a Navy line, echoing the brand's two tones.
  primary:
    "bg-coral text-navy shadow-[0_2px_0_0_var(--color-navy)] " +
    "hover:bg-coral-soft hover:-translate-y-0.5 hover:shadow-[0_4px_0_0_var(--color-navy)] active:translate-y-0",
  // Outlined on light
  secondary:
    "border-2 border-navy text-navy hover:bg-navy hover:text-canvas",
  // Coral on Navy sections — the same action colour, 5.4:1
  onDark:
    "bg-coral text-navy hover:bg-canvas hover:-translate-y-0.5 active:translate-y-0",
  onDarkGhost:
    "border-2 border-fog text-canvas hover:bg-canvas hover:text-navy hover:border-canvas",
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
