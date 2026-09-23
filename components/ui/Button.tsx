import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "onDark" | "onDarkGhost";

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-semibold " +
  "px-7 py-3.5 text-base leading-none transition-all duration-200 " +
  "focus-visible:outline-3 focus-visible:outline-offset-3 " +
  "disabled:opacity-50 disabled:pointer-events-none";

const variants: Record<Variant, string> = {
  // Neon Cyan solid — the one primary action per screen. Cyan is the
  // brightest brand tone, so text on it is Deep Indigo (white on cyan fails
  // contrast) and hover lifts to Soft White with a cyan glow.
  primary:
    "bg-cyan text-indigo shadow-[0_0_0_0_rgba(0,229,255,0)] " +
    "hover:bg-soft hover:-translate-y-0.5 hover:shadow-[0_8px_28px_-6px_rgba(0,229,255,0.55)] active:translate-y-0",
  // Outlined — Soft White line, fills cyan on hover
  secondary:
    "border-2 border-soft/40 text-soft hover:border-cyan hover:bg-cyan hover:text-indigo",
  // On raised Night panels — same cyan action (buttons are always cyan)
  onDark:
    "bg-cyan text-indigo hover:bg-soft hover:-translate-y-0.5 active:translate-y-0",
  onDarkGhost:
    "border-2 border-haze text-soft hover:bg-soft hover:text-indigo hover:border-soft",
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
