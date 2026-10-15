"use client";

import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type Ref,
} from "react";

import type { DocBlock, DocMeta } from "@/lib/crm/doc-blocks";
import { docLabels } from "@/lib/crm/doc-labels";
import { localizeDigits, type DocLocale } from "@/lib/crm/format";

/**
 * Shared A4 engine for proposals and contracts: "measure first, then lay out".
 *
 * 1. Blocks are broken into atoms — a list becomes one atom per item, a
 *    table one atom per row (plus a header atom) — so long lists/tables can
 *    split across pages and keep their numbering.
 * 2. Every atom is rendered off-screen at the real content width and measured
 *    with offsetHeight (NOT getBoundingClientRect: the visible preview is
 *    CSS-scaled, offsetHeight ignores transforms).
 * 3. Atoms are poured into 794×1123px pages; a heading keeps with the atom
 *    after it, and a table that continues on a new page repeats its header.
 *
 * Pages are rendered with inline hex colours only — html2canvas has to
 * screenshot them for the PDF, and Tailwind v4's color-mix() opacity
 * utilities are not something to bet a client's contract on.
 */

export const PAGE_W = 794;
export const PAGE_H = 1123;
const MARGIN_X = 64;
const HEADER_H = 118;
const FOOTER_H = 76;
const CONTENT_W = PAGE_W - MARGIN_X * 2;
const CONTENT_H = PAGE_H - HEADER_H - FOOTER_H;
/** Base64 of the PDF travels in a JSON body; Vercel rejects bodies over 4.5MB. */
const MAX_PDF_BYTES = 2.9 * 1024 * 1024;

const C = {
  ink: "#1E1E1E",
  inkMuted: "#5C5853",
  inkFaint: "#8A847D",
  cobalt: "#0047AB",
  cobaltTint: "#EDF2FA",
  cream: "#F5EBE0",
  creamDeep: "#EBDFD1",
  rule: "#E3DACF",
  white: "#FFFFFF",
};

type Atom =
  | { kind: "block"; block: Exclude<DocBlock, { type: "list" } | { type: "table" }>; keepWithNext: boolean }
  | { kind: "listItem"; ordered: boolean; index: number; text: string; last: boolean }
  | { kind: "tableHead"; tableKey: number; head: string[]; widths: string }
  | { kind: "tableRow"; tableKey: number; headIndex: number; cells: string[]; widths: string; last: boolean };

function splitLongParagraph(text: string): string[] {
  if (text.length <= 1100) return [text];
  const sentences = text.match(/[^.!?؟。]+[.!?؟。]*\s*/g) ?? [text];
  const chunks: string[] = [];
  let current = "";
  for (const s of sentences) {
    if (current && current.length + s.length > 900) {
      chunks.push(current.trim());
      current = "";
    }
    current += s;
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

function toAtoms(blocks: DocBlock[]): Atom[] {
  const atoms: Atom[] = [];
  let tableKey = 0;
  for (const block of blocks) {
    if (block.type === "list") {
      block.items.forEach((text, i) =>
        atoms.push({ kind: "listItem", ordered: Boolean(block.ordered), index: i + 1, text, last: i === block.items.length - 1 }),
      );
    } else if (block.type === "table") {
      tableKey += 1;
      const widths = block.widths?.join(" ") ?? `repeat(${block.head.length}, 1fr)`;
      const headIndex = atoms.length;
      atoms.push({ kind: "tableHead", tableKey, head: block.head, widths });
      block.rows.forEach((cells, i) =>
        atoms.push({ kind: "tableRow", tableKey, headIndex, cells, widths, last: i === block.rows.length - 1 }),
      );
    } else if (block.type === "paragraph") {
      for (const text of splitLongParagraph(block.text)) {
        atoms.push({ kind: "block", block: { ...block, text }, keepWithNext: false });
      }
    } else {
      atoms.push({ kind: "block", block, keepWithNext: block.type === "heading" || block.type === "title" });
    }
  }
  return atoms;
}

/** Page = list of atom indices. A table header repeated on a continuation page is just its index appearing again. */
function paginate(atoms: Atom[], heights: number[]): number[][] {
  const pages: number[][] = [[]];
  let used = 0;

  const newPage = () => {
    pages.push([]);
    used = 0;
  };

  for (let i = 0; i < atoms.length; i++) {
    const atom = atoms[i];
    const h = heights[i] ?? 0;
    let need = h;
    if (atom.kind === "block" && atom.keepWithNext && i + 1 < atoms.length) need += heights[i + 1] ?? 0;
    if (atom.kind === "tableHead" && i + 1 < atoms.length) need += heights[i + 1] ?? 0;

    const page = pages[pages.length - 1];
    if (page.length > 0 && used + need > CONTENT_H) newPage();

    const current = pages[pages.length - 1];
    if (atom.kind === "tableRow" && current.length === 0) {
      // Continuing a table on a fresh page: repeat its header first.
      current.push(atom.headIndex);
      used += heights[atom.headIndex] ?? 0;
    }
    current.push(i);
    used += h;
  }
  return pages;
}

// -----------------------------------------------------------------------------
// Inline text: **bold**, plus LTR isolation for emails / URLs / IPs / phones.
// -----------------------------------------------------------------------------

const INLINE_RE =
  /(\*\*[^*]+\*\*)|([\w.+-]+@[\w-]+(?:\.[\w-]+)+)|(https?:\/\/[^\s)]+)|(\b\d{1,3}(?:\.\d{1,3}){3}\b)|(\+?\d[\d\s-]{6,}\d)|(\[[^\]]+\])/g;

function Inline({ text }: { text: string }) {
  const out: ReactNode[] = [];
  let last = 0;
  let key = 0;
  for (const match of text.matchAll(INLINE_RE)) {
    const start = match.index ?? 0;
    if (start > last) out.push(text.slice(last, start));
    const token = match[0];
    if (match[1]) {
      out.push(
        <strong key={key++} style={{ fontWeight: 700, color: C.ink }}>
          {token.slice(2, -2)}
        </strong>,
      );
    } else if (match[6]) {
      // [placeholder] — marked so it is obvious something must be filled in. Text colour + underline,
      // never a background: html2canvas paints a wrapped inline background as one rectangle over the whole line.
      out.push(
        <span key={key++} style={{ color: "#876012", fontWeight: 600, textDecoration: "underline dotted" }}>
          {token}
        </span>,
      );
    } else {
      out.push(
        <span key={key++} dir="ltr" style={{ unicodeBidi: "isolate" }}>
          {token}
        </span>,
      );
    }
    last = start + token.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return <>{out}</>;
}

// -----------------------------------------------------------------------------
// Atom renderers — used identically for measuring and for the real pages.
// -----------------------------------------------------------------------------

function fonts(locale: DocLocale) {
  return locale === "fa"
    ? { body: "var(--font-vazirmatn), Tahoma, sans-serif", display: "var(--font-vazirmatn), Tahoma, sans-serif", lh: 1.95 }
    : { body: "var(--font-inter), 'Segoe UI', sans-serif", display: "var(--font-space-grotesk), 'Segoe UI', sans-serif", lh: 1.65 };
}

function CheckMark({ color = C.cobalt }: { color?: string }) {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" style={{ flex: "none", marginTop: 5 }}>
      <path d="M2 6.5 L5 9 L10 3" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function AtomView({ atom, locale }: { atom: Atom; locale: DocLocale }) {
  const f = fonts(locale);

  if (atom.kind === "listItem") {
    return (
      <div style={{ display: "flex", gap: 10, paddingBottom: atom.last ? 12 : 5, fontSize: 13, lineHeight: f.lh, color: C.ink }}>
        {atom.ordered ? (
          <span style={{ flex: "none", minWidth: 18, fontWeight: 700, color: C.cobalt }}>
            {localizeDigits(String(atom.index), locale)}.
          </span>
        ) : (
          <span style={{ flex: "none", width: 6, height: 6, marginTop: locale === "fa" ? 11 : 8, background: C.cobalt, borderRadius: 1 }} />
        )}
        <span style={{ minWidth: 0 }}>
          <Inline text={atom.text} />
        </span>
      </div>
    );
  }

  if (atom.kind === "tableHead") {
    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: atom.widths,
          background: C.ink,
          color: C.white,
          fontSize: 11.5,
          fontWeight: 700,
          borderRadius: "6px 6px 0 0",
          fontFamily: f.display,
        }}
      >
        {atom.head.map((h, i) => (
          <div key={i} style={{ padding: "7px 10px" }}>
            {h}
          </div>
        ))}
      </div>
    );
  }

  if (atom.kind === "tableRow") {
    return (
      <div style={{ paddingBottom: atom.last ? 14 : 0 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: atom.widths,
            fontSize: 12,
            lineHeight: f.lh - 0.15,
            color: C.ink,
            borderBottom: `1px solid ${C.rule}`,
            borderInline: `1px solid ${C.rule}`,
          }}
        >
          {atom.cells.map((cell, i) => (
            <div key={i} style={{ padding: "7px 10px", minWidth: 0, color: i === 0 ? C.cobalt : C.ink, fontWeight: i === 0 ? 700 : 400 }}>
              <Inline text={cell} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const block = atom.block;
  switch (block.type) {
    case "title":
      return (
        <div style={{ paddingBottom: 14 }}>
          <div style={{ fontFamily: f.display, fontSize: 26, fontWeight: 700, lineHeight: 1.3, color: C.ink, letterSpacing: locale === "fa" ? 0 : "-0.02em" }}>
            {block.text}
          </div>
          {block.subtitle ? (
            <div style={{ marginTop: 6, fontSize: 14, color: C.inkMuted }}>
              <Inline text={block.subtitle} />
            </div>
          ) : null}
        </div>
      );
    case "heading":
      return block.level === 2 ? (
        <div style={{ paddingTop: 8, paddingBottom: 4, fontFamily: f.display, fontSize: 14, fontWeight: 700, color: C.ink }}>
          {block.text}
        </div>
      ) : (
        <div style={{ paddingTop: 14, paddingBottom: 6 }}>
          <div style={{ fontFamily: f.display, fontSize: 17, fontWeight: 700, color: C.cobalt, lineHeight: 1.4 }}>{block.text}</div>
        </div>
      );
    case "paragraph":
      return (
        <div style={{ paddingBottom: 9, fontSize: 13, lineHeight: f.lh, color: block.muted ? C.inkMuted : C.ink, textAlign: "start" }}>
          <Inline text={block.text} />
        </div>
      );
    case "facts":
      return (
        <div style={{ paddingBottom: 18 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "8px 24px",
              background: C.cream,
              borderRadius: 10,
              padding: "12px 16px",
            }}
          >
            {block.items.map((item, i) => (
              <div key={i} style={{ fontSize: 12 }}>
                <div style={{ color: C.inkFaint, fontSize: 10.5, fontWeight: 600 }}>{item.label}</div>
                <div style={{ color: C.ink, fontWeight: 600 }}>
                  <Inline text={item.value} />
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    case "card":
      return (
        <div style={{ paddingBottom: 12 }}>
          <div
            style={{
              border: `${block.highlight ? 2 : 1}px solid ${block.highlight ? C.cobalt : C.rule}`,
              background: block.highlight ? C.cobaltTint : C.white,
              borderRadius: 12,
              padding: "14px 16px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontFamily: f.display, fontSize: 16, fontWeight: 700, color: C.ink }}>{block.title}</span>
                  {block.badge ? (
                    <span style={{ fontSize: 10.5, fontWeight: 700, color: C.white, background: C.cobalt, borderRadius: 999, padding: "2px 9px" }}>
                      {block.badge}
                    </span>
                  ) : null}
                </div>
                {block.subtitle ? <div style={{ fontSize: 12, color: C.inkMuted, marginTop: 2 }}>{block.subtitle}</div> : null}
              </div>
              {block.price ? (
                <div style={{ flex: "none", fontFamily: f.display, fontSize: 18, fontWeight: 700, color: C.cobalt }}>{block.price}</div>
              ) : null}
            </div>
            {block.items?.length ? (
              <div style={{ marginTop: 8 }}>
                {block.items.map((item, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, fontSize: 12.5, lineHeight: f.lh - 0.1, color: C.ink }}>
                    <CheckMark />
                    <span>
                      <Inline text={item} />
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
            {block.notes?.length ? (
              <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${C.rule}`, fontSize: 11.5, color: C.inkMuted }}>
                {block.notes.join(" · ")}
              </div>
            ) : null}
          </div>
        </div>
      );
    case "signature":
      return (
        <div style={{ paddingTop: 18 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {block.parties.map((party, i) => (
              <div
                key={i}
                style={{
                  border: `1.5px ${party.signed ? "solid" : "dashed"} ${party.signed ? C.cobalt : C.inkFaint}`,
                  borderRadius: 10,
                  padding: "12px 14px",
                  minHeight: 118,
                  background: party.signed ? C.cobaltTint : C.white,
                }}
              >
                <div style={{ fontSize: 10.5, fontWeight: 700, color: C.inkFaint }}>{party.role}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                  {party.signed ? <CheckMark /> : null}
                  <span style={{ fontFamily: f.display, fontSize: 15, fontWeight: 700, color: C.ink }}>{party.name}</span>
                </div>
                {party.lines.map((line, j) => (
                  <div key={j} style={{ fontSize: 11.5, lineHeight: 1.7, color: C.inkMuted }}>
                    <Inline text={line} />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      );
  }
}

function SignalMark() {
  return (
    // 0.7em ≈ Space Grotesk's cap height, so the mark sits on the baseline as the "R".
    <svg viewBox="0 0 74 100" aria-hidden="true" style={{ height: "0.7em", width: "auto" }}>
      <path d="M10 90 V10 H40 a22 22 0 0 1 0 44 H10" fill="none" stroke={C.ink} strokeWidth="20" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="26" y1="54" x2="64" y2="90" stroke={C.cobalt} strokeWidth="20" strokeLinecap="round" />
    </svg>
  );
}

function Page({
  meta,
  pageNo,
  pageCount,
  children,
  pageRef,
}: {
  meta: DocMeta;
  pageNo: number;
  pageCount: number;
  children: ReactNode;
  pageRef?: (el: HTMLDivElement | null) => void;
}) {
  const L = docLabels(meta.locale);
  const f = fonts(meta.locale);
  return (
    <div
      ref={pageRef}
      dir={meta.locale === "fa" ? "rtl" : "ltr"}
      lang={meta.locale}
      style={{
        position: "relative",
        width: PAGE_W,
        height: PAGE_H,
        background: C.white,
        color: C.ink,
        fontFamily: f.body,
        overflow: "hidden",
        boxShadow: "0 1px 3px rgba(30,30,30,0.12), 0 8px 24px rgba(30,30,30,0.08)",
      }}
    >
      {/* Letterhead */}
      <div style={{ position: "absolute", top: 40, insetInline: MARGIN_X, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        {/* Wordmark: the Signal R mark IS the R of "Roya" — never "R Roya" (brand rule, see components/ui/Logo.tsx). */}
        <div
          dir="ltr"
          style={{
            display: "flex",
            alignItems: "baseline",
            fontFamily: "var(--font-space-grotesk), 'Segoe UI', sans-serif",
            fontSize: 19,
            fontWeight: 700,
            letterSpacing: "-0.04em",
            color: C.ink,
            lineHeight: 1,
          }}
        >
          <SignalMark />
          <span style={{ marginInlineStart: "0.02em" }}>oya</span>
          <span style={{ marginInlineStart: "0.26em" }}>Vosoughi</span>
        </div>
        <div style={{ textAlign: "end" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.inkFaint, letterSpacing: meta.locale === "fa" ? 0 : "0.12em", textTransform: "uppercase" }}>
            {meta.kindLabel}
          </div>
          <div dir="ltr" style={{ fontSize: 12, fontWeight: 700, color: C.ink, fontFamily: "var(--font-space-grotesk), 'Segoe UI', sans-serif" }}>
            {meta.docNo}
          </div>
        </div>
      </div>
      <div style={{ position: "absolute", top: 84, insetInline: MARGIN_X, height: 2, background: C.ink }} />
      <div style={{ position: "absolute", top: 89, insetInlineStart: MARGIN_X, width: 96, height: 3, background: C.cobalt }} />

      {/* Body */}
      <div style={{ position: "absolute", top: HEADER_H, insetInline: MARGIN_X, height: CONTENT_H, overflow: "hidden" }}>{children}</div>

      {/* Footer */}
      <div
        style={{
          position: "absolute",
          bottom: 32,
          insetInline: MARGIN_X,
          paddingTop: 10,
          borderTop: `1px solid ${C.rule}`,
          display: "flex",
          justifyContent: "space-between",
          fontSize: 10.5,
          color: C.inkFaint,
        }}
      >
        <span>
          <span dir="ltr">royavosoughi.com</span> · {L.slogan}
        </span>
        <span>{L.page(localizeDigits(String(pageNo), meta.locale), localizeDigits(String(pageCount), meta.locale))}</span>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Font readiness — measuring before the web font arrives gives fallback-font
// heights and pages that overflow once the real font swaps in.
// -----------------------------------------------------------------------------

async function loadDocFonts(locale: DocLocale): Promise<void> {
  if (typeof document === "undefined" || !document.fonts) return;
  const root = getComputedStyle(document.documentElement);
  const families = (locale === "fa" ? ["--font-vazirmatn", "--font-space-grotesk"] : ["--font-inter", "--font-space-grotesk"])
    .map((v) => root.getPropertyValue(v).trim())
    .filter(Boolean);
  await Promise.all(
    families.flatMap((family) => [
      document.fonts.load(`400 16px ${family}`).catch(() => []),
      document.fonts.load(`700 16px ${family}`).catch(() => []),
    ]),
  );
  await document.fonts.ready;
}

const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

export interface A4DocumentHandle {
  /** Re-measures and re-paginates; resolves once the new layout is on screen. Call right after changing blocks/meta. */
  relayout(): Promise<void>;
  /** Renders every page to JPEG and assembles an A4 PDF, lowering quality until it fits under ~2.9MB. */
  exportPdf(): Promise<{ blob: Blob; base64: string }>;
}

export interface A4DocumentLabels {
  zoomIn: string;
  zoomOut: string;
  fit: string;
  fullscreen: string;
  pages: (n: number) => string;
}

const DEFAULT_LABELS: A4DocumentLabels = {
  zoomIn: "Zoom in",
  zoomOut: "Zoom out",
  fit: "Fit",
  fullscreen: "Full screen",
  pages: (n) => `${n} page${n === 1 ? "" : "s"}`,
};

export function A4Document({
  blocks,
  meta,
  variant = "panel",
  labels = DEFAULT_LABELS,
  onReady,
  ref,
}: {
  blocks: DocBlock[];
  meta: DocMeta;
  variant?: "panel" | "public";
  labels?: A4DocumentLabels;
  onReady?: (pageCount: number) => void;
  ref?: Ref<A4DocumentHandle>;
}) {
  const atoms = useMemo(() => toAtoms(blocks), [blocks]);
  const measureRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<HTMLDivElement>(null);
  const pageEls = useRef<Array<HTMLDivElement | null>>([]);
  const waiters = useRef<Array<() => void>>([]);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  const pageCountRef = useRef(0);

  const [fontsReady, setFontsReady] = useState(false);
  const [nonce, setNonce] = useState(0);
  const [layout, setLayout] = useState<{ atoms: Atom[]; pages: number[][] }>({ atoms: [], pages: [] });
  const [zoom, setZoom] = useState<number | null>(null); // null = fit to width
  const [fitScale, setFitScale] = useState(1);
  const [capturing, setCapturing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadDocFonts(meta.locale).finally(() => {
      if (!cancelled) {
        setFontsReady(true);
        setNonce((n) => n + 1);
      }
    });
    const bump = () => setNonce((n) => n + 1);
    document.fonts?.addEventListener?.("loadingdone", bump);
    return () => {
      cancelled = true;
      document.fonts?.removeEventListener?.("loadingdone", bump);
    };
  }, [meta.locale]);

  useLayoutEffect(() => {
    if (!fontsReady || !measureRef.current) return;
    const children = Array.from(measureRef.current.children) as HTMLElement[];
    const heights = children.map((el) => el.offsetHeight);
    setLayout({ atoms, pages: paginate(atoms, heights) });
  }, [atoms, fontsReady, nonce, meta.locale]);

  useEffect(() => {
    if (!fontsReady || layout.atoms !== atoms) return;
    pageCountRef.current = layout.pages.length;
    const pending = waiters.current;
    waiters.current = [];
    pending.forEach((resolve) => resolve());
    onReadyRef.current?.(layout.pages.length);
  }, [layout, atoms, fontsReady]);

  useEffect(() => {
    const el = viewerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const width = entry.contentRect.width - (variant === "panel" ? 32 : 0);
      setFitScale(Math.min(1, Math.max(0.2, width / PAGE_W)));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [variant]);

  const scale = capturing ? 1 : (zoom ?? fitScale);

  const exportPdf = useCallback(async () => {
    setCapturing(true);
    try {
      await nextFrame();
      await nextFrame();
      const [{ jsPDF }, html2canvasModule] = await Promise.all([import("jspdf"), import("html2canvas-pro")]);
      const html2canvas = html2canvasModule.default;
      const pages = pageEls.current
        .slice(0, pageCountRef.current)
        .filter((el): el is HTMLDivElement => Boolean(el));

      const attempts: Array<{ scale: number; quality: number }> = [
        { scale: 2, quality: 0.85 },
        { scale: 2, quality: 0.7 },
        { scale: 1.6, quality: 0.6 },
        { scale: 1.3, quality: 0.5 },
        { scale: 1.1, quality: 0.4 },
      ];
      let canvases: HTMLCanvasElement[] = [];
      let canvasScale = 0;
      let blob: Blob | null = null;

      for (const attempt of attempts) {
        if (attempt.scale !== canvasScale) {
          canvases = [];
          for (const page of pages) {
            canvases.push(await html2canvas(page, { scale: attempt.scale, backgroundColor: "#ffffff", useCORS: true, logging: false }));
          }
          canvasScale = attempt.scale;
        }
        const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });
        canvases.forEach((canvas, i) => {
          if (i > 0) pdf.addPage();
          pdf.addImage(canvas.toDataURL("image/jpeg", attempt.quality), "JPEG", 0, 0, 210, 297, undefined, "FAST");
        });
        blob = pdf.output("blob");
        if (blob.size <= MAX_PDF_BYTES) break;
      }

      const finalBlob = blob!;
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(finalBlob);
      });
      return { blob: finalBlob, base64 };
    } finally {
      setCapturing(false);
    }
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      relayout: () =>
        new Promise<void>((resolve) => {
          waiters.current.push(resolve);
          setNonce((n) => n + 1);
        }),
      exportPdf,
    }),
    [exportPdf],
  );

  const pageCount = layout.pages.length;
  const f = fonts(meta.locale);
  const measureStyle: CSSProperties = {
    position: "absolute",
    top: 0,
    left: -10000,
    width: CONTENT_W,
    visibility: "hidden",
    pointerEvents: "none",
    fontFamily: f.body,
  };

  const toolbarButton =
    "rounded-full border-2 border-ink/15 bg-canvas px-3 py-1 text-xs font-semibold text-ink transition-colors hover:bg-mist disabled:opacity-40";

  return (
    <div className={variant === "panel" ? "flex h-full min-h-0 flex-col" : ""}>
      {/* Off-screen measuring layer */}
      <div ref={measureRef} aria-hidden="true" dir={meta.locale === "fa" ? "rtl" : "ltr"} style={measureStyle}>
        {atoms.map((atom, i) => (
          <AtomView key={i} atom={atom} locale={meta.locale} />
        ))}
      </div>

      {variant === "panel" ? (
        <div className="mb-3 flex flex-wrap items-center gap-2" dir="ltr">
          <button type="button" className={toolbarButton} aria-label={labels.zoomOut} onClick={() => setZoom(Math.max(0.3, Math.round(((zoom ?? fitScale) - 0.1) * 10) / 10))}>
            −
          </button>
          <span className="min-w-12 text-center text-xs font-semibold tabular-nums text-ink/70">{Math.round(scale * 100)}%</span>
          <button type="button" className={toolbarButton} aria-label={labels.zoomIn} onClick={() => setZoom(Math.min(1.5, Math.round(((zoom ?? fitScale) + 0.1) * 10) / 10))}>
            +
          </button>
          <button type="button" className={toolbarButton} onClick={() => setZoom(null)} disabled={zoom === null}>
            {labels.fit}
          </button>
          <button type="button" className={toolbarButton} onClick={() => viewerRef.current?.requestFullscreen?.()}>
            {labels.fullscreen}
          </button>
          <span className="ms-auto text-xs text-ink/60">{pageCount ? labels.pages(pageCount) : ""}</span>
        </div>
      ) : null}

      <div
        ref={viewerRef}
        className={variant === "panel" ? "min-h-0 flex-1 overflow-auto rounded-2xl bg-mist/60 p-4" : "w-full"}
        style={{ background: variant === "panel" ? undefined : "transparent" }}
      >
        <div dir="ltr" style={{ width: PAGE_W * scale, margin: "0 auto" }}>
          {layout.pages.map((indices, p) => (
            <div key={p} style={{ width: PAGE_W * scale, height: PAGE_H * scale, marginBottom: 16 * Math.max(scale, 0.5) }}>
              <div style={{ transform: scale === 1 ? "none" : `scale(${scale})`, transformOrigin: "top left" }}>
                <Page
                  meta={meta}
                  pageNo={p + 1}
                  pageCount={pageCount}
                  pageRef={(el) => {
                    pageEls.current[p] = el;
                  }}
                >
                  {indices.map((atomIndex, k) => (
                    <AtomView key={`${atomIndex}-${k}`} atom={layout.atoms[atomIndex]} locale={meta.locale} />
                  ))}
                </Page>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Triggers a browser download for a generated PDF. */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
