# Logo & brand assets — source of truth

This is the confirmed, final logo (v2, applied 2026-08-04). Every file here
uses the same green R mark and the same "Roya Vosoughi" wordmark; only the
background and text color change per file. Don't hand-edit the paths —
regenerate from `brand/logo-icon-screenshot-match.svg` (icon) and the
Montserrat outline described in the project memory if either ever needs to
change.

**Green R mark:** `#3DBE5B`, never recolored, never stretched.
**Wordmark text "Roya Vosoughi":** Montserrat SemiBold, converted to vector
outlines (not live text) — renders identically everywhere, no font install
needed. Navy `#2B3A55` on light backgrounds, off-white `#F7FAF8` on dark.

## Which file to use

| File | Background | Use it for |
|---|---|---|
| `logo-full.svg` / `.png` | transparent, navy text | Website header/footer, anywhere on a light page |
| `logo-full-white.svg` / `.png` | transparent, white text | Dropped directly onto a dark-green section, no card |
| `logo-full-cream.svg` / `.png` | cream card `#FBF3E4` | Social preview images, cream-background contexts |
| `wordmark.svg` | dark green card `#023316` | LinkedIn banner, email signature |
| `logo.svg` | light card `#F7FAF8` | Documents/decks on a white page |
| `icon-transparent.svg` / `.png` | transparent | Anywhere you need just the R with your own background |
| `icon.svg` / `.png` | dark green rounded square | App icon, Instagram avatar/watermark |
| `formal.svg` | off-white, framed | Résumé and formal documents — deliberately uses Playfair Display serif instead of Montserrat, a different, more traditional treatment reserved for that one use case |

`@800` / `@256` suffixed PNGs are smaller export sizes for places a 2400px
file is overkill (email signatures, social profile fields).

## History

- **v1** (through 2026-08-04): rounded, separate left bar; stem cut short.
  Backed up in `../brand/backup-logo-v1/`, no longer used anywhere.
- **v2** (current): bar merged into the R along the top with a square
  corner, stem runs to the baseline. Rebuilt pixel-for-pixel from a
  screenshot of Roya's preferred Canva design (the Canva file itself was
  lost) — see `../brand/logo-icon-screenshot-match.svg` for the traced
  source path before scaling.
- Wordmark font changed from Quicksand Bold → **Montserrat SemiBold** on
  2026-08-04, chosen from a rendered comparison against Space Grotesk,
  Playfair Display, and a script alternative.

Full narrative and rationale: `roya-brand` and `website-logo` memory files
in Claude's project memory, and `../Roya_Brand_Guide.md` §02.
