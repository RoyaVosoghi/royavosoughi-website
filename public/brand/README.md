# Logo & brand assets — source of truth

**Roya Vosoughi** — *AI engineered for reality.* (v4, cream / ink / cobalt,
applied 2026-10-10). Every file here uses the same Signal R mark and the same
wordmark; only the background and text colour change per file.
Regenerate from `components/ui/Logo.tsx` proportions rather than
hand-editing the paths.

**Palette:** Canvas (cream) `#F5EBE0` background, Ink `#1E1E1E` text and dark
surfaces, Cobalt `#0047AB` buttons and accents (Cobalt-light `#7FA6E8` for
accents on Ink — raw cobalt is only 2.1:1 there).

**The mark (Signal R):** a rounded single-stroke R whose leg is the one Cobalt
stroke — the step from idea to working system. The R is Ink on light and
Canvas on dark; the leg is Cobalt on light and Cobalt-light on dark. On the
icon it is a Canvas R with an Ink leg on a Cobalt tile. Never stretched.
**Wordmark:** the mark *is* the R of "Roya", followed by "oya Vosoughi" in
Space Grotesk Bold, −4% tracking, converted to vector outlines (not live
text) — renders identically everywhere, no font install needed. Always Latin,
in both English and Farsi contexts.

## Which file to use

| File | Background | Use it for |
|---|---|---|
| `roya-logo.svg` / `.png` | transparent, ink | The default — any light background |
| `roya-logo-white.svg` / `.png` | transparent, cream | On ink or other dark surfaces |
| `roya-logo-card.svg` / `.png` | ink rounded card | LinkedIn banner, email signature, social previews |
| `roya-mark.svg` / `.png` | transparent, ink | Just the R, on your own light background |
| `roya-icon.svg` / `.png` / `@256.png` | cobalt rounded square | Favicon, app icon, LinkedIn/Instagram avatar |

The site's live favicon is `app/icon.svg` (same as `roya-icon.svg`).

## History

- **v1** (through 2026-08-04): Roya Vosoughi, rounded green R with a separate
  bar. Backed up in `../../brand/backup-logo-v1/`.
- **v2** (2026-08-04 → 2026-09-24): Roya Vosoughi, green R monogram +
  Montserrat SemiBold wordmark, Deep Forest palette. Backed up in
  `../../brand/backup-logo-roya-v2/`, no longer used anywhere.
- **v3** (2026-09-24, same day): rebrand to **Nura** — Deep Indigo / Electric
  Violet / Neon Cyan / Soft White, dark theme.
- **v3.1**: Nura in **navy & coral** — Canvas `#F5F5F7`, Navy
  `#14213D`, Coral `#E07A5F`. Light theme; chosen as the most trustworthy for
  business managers.
- **v4** (current, 2026-10-10): back to **Roya Vosoughi** — a trademark
  search found NURA already registered in software/IT classes (Mooney S.p.A.
  in Italy, NuraLogix in the EU). Cream / ink / cobalt palette, Signal R mark.

Full rationale: `../../Roya_Brand_Guide.md` §02.
