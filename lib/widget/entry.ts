/**
 * Standalone embeddable chat widget. Bundled by esbuild into public/widget.js
 * (see package.json "build:widget") and loaded via a plain <script> tag on
 * any third-party site — so this file is deliberately dependency-free (no
 * React, no imports from lib/ai/* or components/*): those are either
 * server-only or tied to our own Next.js app's build/hydration pipeline,
 * neither of which applies to a script running inside someone else's page.
 *
 * Visual/string duplication vs. components/chat/ChatBubble.tsx is intentional
 * — the two run in fundamentally different environments and have nothing
 * real to share.
 */

type Locale = "en" | "fa";
type Role = "user" | "assistant";

interface DisplayMessage {
  role: Role;
  content: string;
  /** Assistant messages only. */
  id?: string;
  feedback?: 1 | -1 | null;
  /** The client-rendered greeting bubble — never sent to/from the backend, never eligible for thumbs feedback. */
  synthetic?: boolean;
  /** Visitor pressed Stop mid-reply — partial text, never saved, not ratable. */
  stopped?: boolean;
  /** 👎 clicked and the "what went wrong?" panel is open; the rating is sent on Send/Skip. */
  askingReason?: boolean;
  /** Shown once the 👎 (with or without a reason) has been sent. */
  thanked?: boolean;
}

/**
 * How long the panel waits for a reply before acting — used twice: once
 * after the assistant's last real message (triggers a check-in nudge, not
 * an immediate close), and again after that nudge (this one actually ends
 * the conversation). ElevenLabs has no working equivalent for text sessions
 * (confirmed: max_duration_seconds_after_last_agent_message doesn't enforce
 * there), so this widget owns the whole thing client-side.
 */
const IDLE_CLOSE_MS = 30_000;

// Guard against the script being included twice on the same page.
if (!(window as unknown as { __royaChatWidgetLoaded?: boolean }).__royaChatWidgetLoaded) {
  (window as unknown as { __royaChatWidgetLoaded: boolean }).__royaChatWidgetLoaded = true;

  // Must be read synchronously at top-level — this is what tells the widget
  // which origin to call, so an embedding site never has to configure it.
  const currentScript = document.currentScript as HTMLScriptElement | null;
  const API_BASE = currentScript ? new URL(currentScript.src).origin : "";
  // Lets our own site (see VoiceWidget.tsx's sibling launcher) stack this
  // bubble above the voice call button instead of overlapping it, via
  // <script data-bottom-offset="96">. Third-party embeds never set this,
  // so they keep the normal 20px.
  const BOTTOM_OFFSET = Number(currentScript?.dataset.bottomOffset) || 20;

  const DEFAULT_ACCENT = "#0047ab"; // brand Cobalt

  // Brand cream, ink & cobalt palette. `accent` is overwritten below once
  // /api/widget/config resolves; `onAccent` is then recomputed so text on the
  // accent stays readable whatever colour the admin picks.
  const COLORS = {
    canvas: "#f5ebe0",
    ink: "#1e1e1e",
    inkSoft: "#2e2e2e",
    mist: "#ebdfd1",
    fog: "#b8b0a6",
    amberDeep: "#876012",
    accent: DEFAULT_ACCENT,
    onAccent: "#ffffff",
  };

  /** Ink on light accents, Canvas on dark ones (WCAG luminance). */
  function textOn(hex: string): string {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
    if (!m) return COLORS.ink;
    const n = parseInt(m[1], 16);
    const lin = (c: number) => {
      const v = c / 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    };
    const L = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
    return L > 0.18 ? COLORS.ink : COLORS.canvas;
  }

  /** Nura's avatar — "nur" means light, so a cream four-point spark on cobalt. Fixed brand colours (not the admin accent) so the assistant looks the same everywhere. */
  const AVATAR_SVG =
    '<svg class="rv-avatar" viewBox="0 0 40 40" aria-hidden="true">' +
    '<circle cx="20" cy="20" r="20" fill="#0047ab"/>' +
    '<path d="M20 8.5C21 15.5 24.5 19 31.5 20C24.5 21 21 24.5 20 31.5C19 24.5 15.5 21 8.5 20C15.5 19 19 15.5 20 8.5Z" fill="#f5ebe0"/>' +
    '<circle cx="29" cy="11" r="2.2" fill="#f5ebe0"/>' +
    "</svg>";

  const STRINGS: Record<Locale, Record<string, string>> = {
    en: {
      assistantName: "Nura",
      assistantRole: "Roya's AI assistant",
      greetingTitle: "Hi! I'm Nura",
      greetingBody: "Roya's AI assistant. Ask me about her work, projects, or how to get in touch.",
      openChat: "Open chat",
      closeChat: "Close chat",
      inputPlaceholder: "Type a message…",
      send: "Send",
      sending: "Sending…",
      thinking: "Thinking…",
      errorBody: "That didn't go through. Please try again in a moment.",
      rateLimited: "You've sent a lot of messages in a short time — please wait a few minutes.",
      notConfigured: "Chat isn't available right now.",
      waitingForHuman: "A team member will reply here shortly.",
      endedTitle: "Thanks for reaching out!",
      endedBody: "Have a great day.",
      rateQuestion: "How was this conversation?",
      thanksForRating: "Thanks for your feedback!",
      checkInNudge: "Still there? Is there anything else I can help you with?",
      stop: "Stop",
      stopped: "Stopped",
      feedbackReasonTitle: "What went wrong?",
      feedbackReasonPlaceholder: "Tell us more (optional)",
      feedbackSend: "Send",
      feedbackSkip: "Skip",
      feedbackThanks: "Thanks — this helps improve the assistant.",
    },
    fa: {
      assistantName: "نورا",
      assistantRole: "دستیار هوشمند رویا",
      greetingTitle: "سلام! من نورا هستم",
      greetingBody: "دستیار هوشمند رویا. درباره‌ی کارها، پروژه‌ها یا راه‌های ارتباط با رویا از من بپرسید.",
      openChat: "باز کردن گفتگو",
      closeChat: "بستن گفتگو",
      inputPlaceholder: "پیامی بنویسید…",
      send: "ارسال",
      sending: "در حال ارسال…",
      thinking: "در حال فکر کردن…",
      errorBody: "ارسال نشد. لطفا کمی بعد دوباره امتحان کنید.",
      rateLimited: "در مدت کوتاهی پیام‌های زیادی فرستادید — لطفا چند دقیقه صبر کنید.",
      notConfigured: "گفتگو الان در دسترس نیست.",
      waitingForHuman: "به‌زودی یکی از اعضای تیم همین‌جا پاسخ می‌دهد.",
      endedTitle: "ممنون که پیام دادید!",
      endedBody: "روز خوبی داشته باشید.",
      rateQuestion: "این گفتگو چطور بود؟",
      thanksForRating: "بابت بازخوردتان ممنونیم!",
      checkInNudge: "هنوز آنجا هستید؟ کار دیگری هست که بتوانم کمکتان کنم؟",
      stop: "توقف",
      stopped: "متوقف شد",
      feedbackReasonTitle: "چه مشکلی داشت؟",
      feedbackReasonPlaceholder: "توضیح بیشتر (اختیاری)",
      feedbackSend: "ارسال",
      feedbackSkip: "رد شدن",
      feedbackThanks: "ممنون — این به بهترشدن دستیار کمک می‌کند.",
    },
  };

  /** Kept outside STRINGS because STRINGS is string-valued only. */
  const FEEDBACK_REASONS: Record<Locale, string[]> = {
    en: ["Wrong or made-up information", "Didn't answer my question", "Too long or unclear", "Something else"],
    fa: ["اطلاعات نادرست یا ساختگی", "به سؤالم جواب نداد", "طولانی یا نامفهوم", "دلیل دیگر"],
  };

  function detectLocale(): Locale {
    const lang = (document.documentElement.lang || navigator.language || "en").toLowerCase();
    return lang.startsWith("fa") ? "fa" : "en";
  }

  let locale = detectLocale();
  let dir = locale === "fa" ? "rtl" : "ltr";
  const t = (key: string) => STRINGS[locale][key] ?? key;

  const SESSION_STORAGE_KEY = "rv_widget_session_id";
  function getOrCreateSessionId(): string {
    const existing = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (existing) return existing;
    return rotateSessionId();
  }
  /** A fresh id starts a brand-new conversation server-side (getOrCreateConversation keys on channel+external_user_id) — used once the previous one has ended, so reopening the widget never resumes a closed conversation. */
  function rotateSessionId(): string {
    const id = crypto.randomUUID();
    window.localStorage.setItem(SESSION_STORAGE_KEY, id);
    return id;
  }
  let sessionId = getOrCreateSessionId();

  /**
   * Built lazily (not a top-level const) because primaryColor/position come
   * from /api/widget/config, fetched async before mount() draws anything —
   * a template literal evaluated at module load would freeze in the
   * hardcoded defaults instead.
   */
  function buildStyles(positionSide: "start" | "end"): string {
    // Logical "end" is physically right in LTR, left in RTL — and vice
    // versa for "start". Panel grows from whichever corner the launcher sits in.
    const physicalSide = (positionSide === "end") === (dir === "ltr") ? "right" : "left";

    return `
    :host { all: initial; }
    * { box-sizing: border-box; }
    .rv-root {
      position: fixed;
      bottom: ${BOTTOM_OFFSET}px;
      inset-inline-${positionSide}: 20px;
      z-index: 2147483000;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 14px;
    }
    .rv-panel {
      width: min(22rem, calc(100vw - 2.5rem));
      height: min(32rem, 70vh);
      background: ${COLORS.canvas};
      color: ${COLORS.ink};
      border-radius: 24px;
      border: 1px solid rgba(30, 30, 30, 0.12);
      box-shadow: 0 20px 50px rgba(30, 30, 30, 0.22);
      overflow: hidden;
      display: flex;
      flex-direction: column;
      transform-origin: bottom ${physicalSide};
      transition: transform 0.2s ease, opacity 0.2s ease;
    }
    .rv-panel[data-open="false"] {
      transform: scale(0.95);
      opacity: 0;
      pointer-events: none;
    }
    .rv-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: ${COLORS.ink};
      padding: 14px 18px;
      flex-shrink: 0;
    }
    .rv-header-id { display: flex; align-items: center; gap: 10px; min-width: 0; }
    .rv-avatar { width: 40px; height: 40px; flex-shrink: 0; border-radius: 999px; display: block; }
    .rv-header-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
    .rv-header-name {
      color: ${COLORS.canvas};
      font-weight: 700;
      font-size: 15px;
      line-height: 1.2;
      margin: 0;
    }
    .rv-header-role {
      color: ${COLORS.fog};
      font-size: 12px;
      line-height: 1.2;
      margin: 0;
    }
    .rv-empty {
      margin: auto 0;
      padding: 12px 8px;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
    }
    .rv-empty-wave { font-size: 32px; line-height: 1; }
    .rv-empty-title { font-size: 16px; font-weight: 700; color: ${COLORS.ink}; margin: 4px 0 0; }
    .rv-empty-body { font-size: 13.5px; line-height: 1.5; color: rgba(30, 30, 30, 0.65); margin: 0; max-width: 17rem; }
    .rv-header-close {
      background: none;
      border: none;
      color: ${COLORS.fog};
      cursor: pointer;
      width: 30px;
      height: 30px;
      border-radius: 999px;
      display: grid;
      place-items: center;
    }
    .rv-header-close:hover { background: ${COLORS.inkSoft}; color: ${COLORS.canvas}; }
    .rv-messages {
      flex: 1;
      overflow-y: auto;
      padding: 18px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .rv-starters { display: flex; flex-wrap: wrap; gap: 8px; }
    .rv-starter-btn {
      border: 1px solid rgba(30, 30, 30, 0.15);
      background: #ffffff;
      color: rgba(30, 30, 30, 0.85);
      border-radius: 999px;
      padding: 8px 14px;
      font-size: 13px;
      cursor: pointer;
      transition: border-color 0.15s ease, color 0.15s ease;
    }
    .rv-starter-btn:hover { border-color: ${COLORS.ink}; color: ${COLORS.ink}; }
    .rv-bubble-row { display: flex; flex-direction: column; gap: 4px; }
    .rv-bubble-row.rv-user { align-items: flex-end; }
    .rv-bubble-row.rv-assistant { align-items: flex-start; }
    .rv-bubble {
      max-width: 80%;
      border-radius: 16px;
      padding: 10px 14px;
      font-size: 14px;
      line-height: 1.45;
      white-space: pre-wrap;
    }
    .rv-user .rv-bubble { background: ${COLORS.accent}; color: ${COLORS.onAccent}; }
    .rv-assistant .rv-bubble { background: ${COLORS.mist}; color: ${COLORS.ink}; }
    .rv-feedback { display: flex; gap: 4px; padding: 0 2px; }
    .rv-feedback-btn {
      width: 26px;
      height: 26px;
      border-radius: 999px;
      border: none;
      background: none;
      cursor: pointer;
      display: grid;
      place-items: center;
      color: rgba(30, 30, 30, 0.35);
      transition: background 0.15s ease, color 0.15s ease;
    }
    .rv-feedback-btn:hover:not(:disabled) { background: rgba(30, 30, 30, 0.06); color: ${COLORS.ink}; }
    .rv-feedback-btn:disabled { cursor: default; }
    .rv-feedback-btn[data-active="true"] { background: rgba(30, 30, 30, 0.1); color: ${COLORS.ink}; }
    .rv-feedback-btn[data-active="true"].rv-down { background: rgba(227, 167, 47, 0.16); color: ${COLORS.amberDeep}; }
    .rv-note { font-size: 12px; color: rgba(30, 30, 30, 0.5); padding: 0 2px; margin: 0; }
    .rv-reason {
      max-width: 80%;
      border: 1px solid rgba(30, 30, 30, 0.12);
      border-radius: 14px;
      padding: 10px;
      background: #ffffff;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .rv-reason-title { font-size: 13px; font-weight: 600; color: ${COLORS.ink}; margin: 0; }
    .rv-reason-chips { display: flex; flex-wrap: wrap; gap: 6px; }
    .rv-reason-chip {
      border: 1px solid rgba(30, 30, 30, 0.18);
      background: none;
      border-radius: 999px;
      padding: 4px 10px;
      font-size: 12px;
      color: ${COLORS.ink};
      cursor: pointer;
      font-family: inherit;
    }
    .rv-reason-chip[aria-pressed="true"] { border-color: ${COLORS.accent}; background: rgba(0, 71, 171, 0.08); }
    .rv-reason-text {
      border: 1px solid rgba(30, 30, 30, 0.18);
      border-radius: 10px;
      padding: 6px 8px;
      font-size: 13px;
      font-family: inherit;
      resize: none;
      color: ${COLORS.ink};
    }
    .rv-reason-actions { display: flex; justify-content: flex-end; gap: 6px; }
    .rv-reason-skip, .rv-reason-send {
      border: none;
      border-radius: 999px;
      padding: 5px 12px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      font-family: inherit;
    }
    .rv-reason-skip { background: none; color: rgba(30, 30, 30, 0.6); }
    .rv-reason-send { background: ${COLORS.ink}; color: ${COLORS.canvas}; }
    .rv-reason-send:disabled { opacity: 0.4; cursor: default; }
    .rv-status {
      padding: 8px 18px;
      font-size: 13px;
      font-weight: 500;
      color: ${COLORS.amberDeep};
      border-top: 1px solid rgba(30, 30, 30, 0.1);
    }
    .rv-input-row {
      display: flex;
      gap: 10px;
      align-items: center;
      padding: 14px;
      border-top: 1px solid rgba(30, 30, 30, 0.1);
      flex-shrink: 0;
    }
    .rv-input {
      flex: 1;
      border: 1px solid rgba(30, 30, 30, 0.18);
      border-radius: 16px;
      padding: 10px 14px;
      font-size: 14px;
      color: ${COLORS.ink};
      background: #ffffff;
      outline: none;
      font-family: inherit;
    }
    .rv-input::placeholder { color: rgba(30, 30, 30, 0.45); }
    .rv-input:focus { border-color: ${COLORS.ink}; }
    .rv-send {
      background: ${COLORS.accent};
      color: ${COLORS.onAccent};
      border: none;
      border-radius: 999px;
      padding: 10px 18px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      flex-shrink: 0;
      transition: background 0.15s ease, color 0.15s ease;
    }
    .rv-send:hover:not(:disabled) { background: ${COLORS.ink}; color: ${COLORS.canvas}; }
    .rv-send:disabled { opacity: 0.5; cursor: default; }
    .rv-launcher {
      width: 60px;
      height: 60px;
      padding: 0;
      border-radius: 50%;
      background: ${COLORS.accent};
      color: ${COLORS.onAccent};
      border: none;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-family: inherit;
      box-shadow: 0 8px 24px rgba(30, 30, 30, 0.3);
      transition: background 0.2s ease, color 0.2s ease, transform 0.2s ease;
    }
    .rv-launcher:hover { background: ${COLORS.ink}; color: ${COLORS.canvas}; transform: translateY(-2px); }
    .rv-launcher-icon { display: grid; place-items: center; }
    .rv-fallback { padding: 20px; font-size: 14px; color: ${COLORS.ink}; text-align: center; }
    .rv-end-screen {
      display: none;
      flex: 1;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 14px;
      padding: 24px;
      text-align: center;
    }
    .rv-end-screen[data-visible="true"] { display: flex; }
    .rv-end-title { font-size: 16px; font-weight: 700; color: ${COLORS.ink}; margin: 0; }
    .rv-end-body { font-size: 14px; color: rgba(30, 30, 30, 0.7); margin: 0 0 8px; }
    .rv-rate-question { font-size: 13px; font-weight: 600; color: ${COLORS.ink}; margin: 0; }
    .rv-stars { display: flex; gap: 6px; }
    .rv-star-btn {
      background: none;
      border: none;
      cursor: pointer;
      padding: 4px;
      color: rgba(30, 30, 30, 0.2);
      transition: color 0.15s ease, transform 0.15s ease;
    }
    .rv-star-btn:hover:not(:disabled) { color: ${COLORS.accent}; transform: scale(1.1); }
    .rv-star-btn[data-active="true"] { color: ${COLORS.accent}; }
    .rv-star-btn:disabled { cursor: default; }
    .rv-thanks { display: none; font-size: 13px; color: ${COLORS.ink}; font-weight: 600; margin: 0; }
    `;
  }

  const CHAT_ICON =
    '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>';
  const CLOSE_ICON =
    '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M5 5l14 14M19 5L5 19"/></svg>';
  const THUMB_UP_ICON =
    '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 22V11M2 13v7a2 2 0 0 0 2 2h12.9a2 2 0 0 0 2-1.7l1.4-8A2 2 0 0 0 18.3 10H14V5a2 2 0 0 0-2-2L7 11"/></svg>';
  const THUMB_DOWN_ICON =
    '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" transform="rotate(180 12 12)"><path d="M7 22V11M2 13v7a2 2 0 0 0 2 2h12.9a2 2 0 0 0 2-1.7l1.4-8A2 2 0 0 0 18.3 10H14V5a2 2 0 0 0-2-2L7 11"/></svg>';
  const STAR_ICON =
    '<svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor" stroke="none"><path d="M12 2.5l2.95 6.28 6.92.86-5.13 4.75 1.4 6.86L12 17.77l-6.14 3.48 1.4-6.86-5.13-4.75 6.92-.86L12 2.5z"/></svg>';

  function el<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    className?: string,
  ): HTMLElementTagNameMap[K] {
    const node = document.createElement(tag);
    if (className) node.className = className;
    return node;
  }

  interface WidgetConfig {
    primaryColor: string;
    position: "bottom-end" | "bottom-start";
    welcomeMessageEn: string | null;
    welcomeMessageFa: string | null;
    allowedDomains: string[];
    quickRepliesEn: string[];
    quickRepliesFa: string[];
  }

  async function fetchConfig(): Promise<WidgetConfig | null> {
    if (!API_BASE) return null;
    try {
      const response = await fetch(`${API_BASE}/api/widget/config`);
      if (!response.ok) return null;
      return (await response.json()) as WidgetConfig;
    } catch {
      return null;
    }
  }

  async function mount() {
    // Best-effort: a fetch failure (offline, misconfigured API_BASE) falls
    // straight back to the hardcoded defaults already in COLORS/STRINGS —
    // the widget must never fail to render just because /api/widget/config
    // is unreachable.
    const config = await fetchConfig();
    if (config?.primaryColor) {
      COLORS.accent = config.primaryColor;
      COLORS.onAccent = textOn(config.primaryColor);
    }
    const positionSide = config?.position === "bottom-start" ? "start" : "end";
    const starters = (locale === "fa" ? config?.quickRepliesFa : config?.quickRepliesEn) ?? [];
    /** Body of the empty-state greeting: the admin-editable widget_config.welcome_message_* when set, else the built-in default. Read per render so a locale switch picks the right language. */
    const greetingBody = () =>
      (locale === "fa" ? config?.welcomeMessageFa : config?.welcomeMessageEn) || t("greetingBody");

    const host = document.createElement("div");
    host.setAttribute("dir", dir);
    document.body.appendChild(host);
    const shadow = host.attachShadow({ mode: "open" });

    const style = document.createElement("style");
    style.textContent = buildStyles(positionSide);
    shadow.appendChild(style);

    const root = el("div", "rv-root");
    shadow.appendChild(root);

    const panel = el("div", "rv-panel");
    panel.dataset.open = "false";
    root.appendChild(panel);

    const header = el("div", "rv-header");
    const headerId = el("div", "rv-header-id");
    headerId.innerHTML = AVATAR_SVG;
    const headerText = el("div", "rv-header-text");
    const title = el("p", "rv-header-name");
    title.textContent = t("assistantName");
    const role = el("p", "rv-header-role");
    role.textContent = t("assistantRole");
    headerText.appendChild(title);
    headerText.appendChild(role);
    headerId.appendChild(headerText);
    const closeBtn = el("button", "rv-header-close");
    closeBtn.type = "button";
    closeBtn.innerHTML = CLOSE_ICON;
    closeBtn.setAttribute("aria-label", t("closeChat"));
    header.appendChild(headerId);
    header.appendChild(closeBtn);
    panel.appendChild(header);

    const messagesEl = el("div", "rv-messages");
    panel.appendChild(messagesEl);

    const statusEl = el("div", "rv-status");
    statusEl.style.display = "none";
    panel.appendChild(statusEl);

    const inputRow = el("div", "rv-input-row");
    const input = el("input", "rv-input");
    input.type = "text";
    input.placeholder = t("inputPlaceholder");
    const sendBtn = el("button", "rv-send");
    sendBtn.type = "button";
    sendBtn.textContent = t("send");
    inputRow.appendChild(input);
    inputRow.appendChild(sendBtn);
    panel.appendChild(inputRow);

    const endScreen = el("div", "rv-end-screen");
    const endTitle = el("p", "rv-end-title");
    endTitle.textContent = t("endedTitle");
    const endBody = el("p", "rv-end-body");
    endBody.textContent = t("endedBody");
    const rateQuestion = el("p", "rv-rate-question");
    rateQuestion.textContent = t("rateQuestion");
    const starsRow = el("div", "rv-stars");
    const starButtons: HTMLButtonElement[] = [];
    const thanksEl = el("p", "rv-thanks");
    thanksEl.textContent = t("thanksForRating");

    for (let i = 1; i <= 5; i++) {
      const starBtn = el("button", "rv-star-btn");
      starBtn.type = "button";
      starBtn.innerHTML = STAR_ICON;
      starBtn.setAttribute("aria-label", String(i));
      starBtn.addEventListener("click", async () => {
        if (starButtons.some((b) => b.disabled)) return; // already rated
        starButtons.forEach((btn, idx) => {
          btn.disabled = true;
          btn.dataset.active = String(idx < i);
        });
        thanksEl.style.display = "block";
        try {
          await fetch(`${API_BASE}/api/widget/rate-conversation`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ channelSessionId: sessionId, rating: i }),
          });
        } catch {
          // best-effort — the stars already reflect the visitor's choice
        }
      });
      starButtons.push(starBtn);
      starsRow.appendChild(starBtn);
    }

    endScreen.appendChild(endTitle);
    endScreen.appendChild(endBody);
    endScreen.appendChild(rateQuestion);
    endScreen.appendChild(starsRow);
    endScreen.appendChild(thanksEl);
    panel.appendChild(endScreen);

    function resetStars() {
      for (const btn of starButtons) {
        btn.disabled = false;
        btn.dataset.active = "false";
      }
      thanksEl.style.display = "none";
    }

    const launcher = el("button", "rv-launcher");
    launcher.type = "button";
    const launcherIcon = el("span", "rv-launcher-icon");
    launcherIcon.innerHTML = CHAT_ICON;
    launcher.appendChild(launcherIcon);
    launcher.setAttribute("aria-label", t("openChat"));
    root.appendChild(launcher);

    let open = false;
    let sending = false;
    let abortController: AbortController | null = null;
    let ended = false;
    let idleTimer: ReturnType<typeof setTimeout> | null = null;
    const messages: DisplayMessage[] = [];


    async function postFeedback(messageId: string, rating: 1 | -1, comment?: string) {
      try {
        await fetch(`${API_BASE}/api/widget/feedback`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messageId, rating, comment: comment || undefined }),
        });
      } catch {
        // Best-effort — the button already reflects the visitor's choice.
      }
    }

    function rate(message: DisplayMessage, rating: 1 | -1) {
      if (!message.id || message.feedback !== null) return;
      message.feedback = rating;
      if (rating === 1) {
        void postFeedback(message.id, 1);
      } else {
        // 👎 asks why first; Skip (or sending another message) still records it.
        flushPendingReasons();
        message.askingReason = true;
        // Don't let the idle close wipe a half-written reason.
        cancelIdleClose();
      }
      renderMessages();
    }

    function submitDownvote(message: DisplayMessage, comment?: string) {
      message.askingReason = false;
      message.thanked = true;
      if (open && !sending && !ended) scheduleIdleClose();
      if (message.id) void postFeedback(message.id, -1, comment);
    }

    /** Sends any 👎 still waiting on its reason panel, without a reason. */
    function flushPendingReasons() {
      for (const m of messages) if (m.askingReason) submitDownvote(m);
    }

    function buildReasonPanel(message: DisplayMessage): HTMLElement {
      const panelEl = el("div", "rv-reason");
      const heading = el("p", "rv-reason-title");
      heading.textContent = t("feedbackReasonTitle");
      panelEl.appendChild(heading);

      let choice: string | null = null;
      const chips = el("div", "rv-reason-chips");
      const textArea = el("textarea", "rv-reason-text");
      const sendReason = el("button", "rv-reason-send");
      const refresh = () => {
        sendReason.disabled = !choice && !textArea.value.trim();
      };
      for (const reason of FEEDBACK_REASONS[locale]) {
        const chip = el("button", "rv-reason-chip");
        chip.type = "button";
        chip.textContent = reason;
        chip.setAttribute("aria-pressed", "false");
        chip.addEventListener("click", () => {
          choice = choice === reason ? null : reason;
          for (const c of Array.from(chips.children)) {
            c.setAttribute("aria-pressed", String(c.textContent === choice));
          }
          refresh();
        });
        chips.appendChild(chip);
      }
      panelEl.appendChild(chips);

      textArea.rows = 2;
      textArea.maxLength = 500;
      textArea.placeholder = t("feedbackReasonPlaceholder");
      textArea.setAttribute("aria-label", t("feedbackReasonPlaceholder"));
      textArea.addEventListener("input", refresh);
      panelEl.appendChild(textArea);

      const actions = el("div", "rv-reason-actions");
      const skip = el("button", "rv-reason-skip");
      skip.type = "button";
      skip.textContent = t("feedbackSkip");
      skip.addEventListener("click", () => {
        submitDownvote(message);
        renderMessages();
      });
      sendReason.type = "button";
      sendReason.textContent = t("feedbackSend");
      sendReason.addEventListener("click", () => {
        submitDownvote(message, [choice, textArea.value.trim()].filter(Boolean).join(" — "));
        renderMessages();
      });
      refresh();
      actions.appendChild(skip);
      actions.appendChild(sendReason);
      panelEl.appendChild(actions);
      return panelEl;
    }

    function renderMessages() {
      messagesEl.innerHTML = "";

      // Before anything is said: Nura introduces herself (client-only, never sent to the backend).
      if (messages.length === 0) {
        const empty = el("div", "rv-empty");
        const wave = el("div", "rv-empty-wave");
        wave.textContent = "👋";
        wave.setAttribute("aria-hidden", "true");
        const emptyTitle = el("p", "rv-empty-title");
        emptyTitle.textContent = t("greetingTitle");
        const emptyBody = el("p", "rv-empty-body");
        emptyBody.textContent = greetingBody();
        empty.appendChild(wave);
        empty.appendChild(emptyTitle);
        empty.appendChild(emptyBody);
        messagesEl.appendChild(empty);
      }

      for (const message of messages) {
        // Bubble + feedback icons are appended straight into the row (itself
        // flex-direction:column with align-items set per role below) rather
        // than into an intermediate wrapper div. A wrapper div's own width is
        // computed via shrink-to-fit against its children's *unconstrained*
        // max-content size (percentages like .rv-bubble's max-width:80% are
        // ignored during that pass to avoid a circular dependency) — so for
        // long messages the wrapper silently stretched to the row's full
        // width, which broke right-alignment for wrapped user bubbles and
        // detached the feedback icons from the assistant bubble's actual
        // footprint. The row's own width instead comes from align-items:
        // stretch on its outer container (.rv-messages), which has no such
        // circularity, so align-items: flex-start/flex-end on the row aligns
        // both children tightly and reliably regardless of message length.
        const row = el("div", `rv-bubble-row rv-${message.role}`);
        const bubble = el("div", "rv-bubble");
        bubble.textContent = message.content;
        row.appendChild(bubble);

        if (message.role === "assistant" && message.id) {
          const feedbackRow = el("div", "rv-feedback");

          const upBtn = el("button", "rv-feedback-btn rv-up");
          upBtn.type = "button";
          upBtn.innerHTML = THUMB_UP_ICON;
          upBtn.setAttribute("aria-label", "Good response");
          upBtn.disabled = message.feedback !== null;
          upBtn.dataset.active = String(message.feedback === 1);
          upBtn.addEventListener("click", () => rate(message, 1));

          const downBtn = el("button", "rv-feedback-btn rv-down");
          downBtn.type = "button";
          downBtn.innerHTML = THUMB_DOWN_ICON;
          downBtn.setAttribute("aria-label", "Bad response");
          downBtn.disabled = message.feedback !== null;
          downBtn.dataset.active = String(message.feedback === -1);
          downBtn.addEventListener("click", () => rate(message, -1));

          feedbackRow.appendChild(upBtn);
          feedbackRow.appendChild(downBtn);
          row.appendChild(feedbackRow);
        }

        if (message.stopped) {
          const note = el("p", "rv-note");
          note.textContent = t("stopped");
          row.appendChild(note);
        }
        if (message.askingReason) row.appendChild(buildReasonPanel(message));
        if (message.thanked) {
          const note = el("p", "rv-note");
          note.textContent = t("feedbackThanks");
          row.appendChild(note);
        }

        messagesEl.appendChild(row);
      }

      // Quick-reply starters stay useful only before the visitor has actually said anything themselves.
      const hasRealExchange = messages.some((m) => m.role === "user");
      if (!hasRealExchange && starters.length > 0) {
        const startersRow = el("div", "rv-starters");
        for (const starter of starters) {
          const btn = el("button", "rv-starter-btn");
          btn.type = "button";
          btn.textContent = starter;
          btn.addEventListener("click", () => send(starter));
          startersRow.appendChild(btn);
        }
        messagesEl.appendChild(startersRow);
      }

      messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    function setStatus(text: string) {
      statusEl.textContent = text;
      statusEl.style.display = text ? "block" : "none";
    }

    function cancelIdleClose() {
      if (idleTimer) {
        clearTimeout(idleTimer);
        idleTimer = null;
      }
    }

    function scheduleIdleClose() {
      cancelIdleClose();
      idleTimer = setTimeout(handleIdleNudge, IDLE_CLOSE_MS);
    }

    /** Undoes everything a prior conversation left behind, so the next open starts clean rather than resuming a closed one. */
    function resetToFresh() {
      abortController?.abort();
      ended = false;
      messages.length = 0;
      endScreen.dataset.visible = "false";
      messagesEl.style.display = "";
      inputRow.style.display = "";
      resetStars();
      setStatus("");
      sessionId = rotateSessionId();
      renderMessages();
    }

    /**
     * Fires 10s after the assistant's last message with no reply. Mirrors
     * the voice agent's own behavior — it checks in once before hanging up,
     * it doesn't just cut the call — rather than ending outright, this sends
     * one check-in nudge and gives the visitor another 10s to respond before
     * handleIdleTimeout actually closes things out. Nothing to check in on
     * if the visitor never said anything back in the first place (just
     * opened the panel and walked away): that case quietly collapses
     * instead of nudging a conversation that never happened.
     */
    function handleIdleNudge() {
      idleTimer = null;
      const hadRealExchange = messages.some((m) => m.role === "user");

      if (!hadRealExchange) {
        setOpen(false);
        resetToFresh();
        return;
      }

      messages.push({ role: "assistant", content: t("checkInNudge"), feedback: null, synthetic: true });
      renderMessages();
      idleTimer = setTimeout(handleIdleTimeout, IDLE_CLOSE_MS);
    }

    /** Fires 10s after the check-in nudge above with still no reply — this is the one that actually ends the conversation and shows the rating screen. */
    function handleIdleTimeout() {
      idleTimer = null;
      ended = true;
      messagesEl.style.display = "none";
      inputRow.style.display = "none";
      setStatus("");
      endScreen.dataset.visible = "true";

      void fetch(`${API_BASE}/api/widget/close-conversation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelSessionId: sessionId, reason: "idle_timeout" }),
      }).catch(() => {});
    }

    function setOpen(next: boolean) {
      if (next && ended) resetToFresh();

      open = next;
      panel.dataset.open = String(open);
      launcherIcon.innerHTML = open ? CLOSE_ICON : CHAT_ICON;
      launcher.setAttribute("aria-label", open ? t("closeChat") : t("openChat"));

      if (open) {
        input.focus();
        scheduleIdleClose();
      } else {
        cancelIdleClose();
        // An explicit close is the visitor deliberately dismissing the
        // panel — log it, but don't block their exit with a rating screen
        // the way the idle-timeout path does.
        const hadRealExchange = messages.some((m) => m.role === "user");
        if (hadRealExchange && !ended) {
          void fetch(`${API_BASE}/api/widget/close-conversation`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ channelSessionId: sessionId, reason: "user_closed" }),
          }).catch(() => {});
        }
      }
    }

    launcher.addEventListener("click", () => setOpen(!open));
    closeBtn.addEventListener("click", () => setOpen(false));

    // Splits an SSE byte stream into {event, data} frames, same logic as
    // ChatWidget.tsx's parseSseChunk — duplicated rather than shared per this
    // file's header comment (no imports across the React/vanilla boundary).
    function parseSseChunk(buffer: string, raw: string): { events: Array<{ event: string; data: unknown }>; buffer: string } {
      const combined = buffer + raw;
      const frames = combined.split("\n\n");
      const rest = frames.pop() ?? "";

      const events: Array<{ event: string; data: unknown }> = [];
      for (const frame of frames) {
        const eventLine = frame.split("\n").find((line) => line.startsWith("event: "));
        const dataLine = frame.split("\n").find((line) => line.startsWith("data: "));
        if (!eventLine || !dataLine) continue;
        try {
          events.push({ event: eventLine.slice("event: ".length).trim(), data: JSON.parse(dataLine.slice("data: ".length)) });
        } catch {
          // malformed frame — skip it rather than crash the reader loop
        }
      }
      return { events, buffer: rest };
    }

    async function send(presetText?: string) {
      const text = (presetText ?? input.value).trim();
      if (!text || sending) return;

      cancelIdleClose();
      flushPendingReasons();
      messages.push({ role: "user", content: text });
      renderMessages();
      input.value = "";
      sending = true;
      // While a reply is on its way the send button becomes Stop (see the click handler below).
      sendBtn.textContent = t("stop");
      setStatus(t("thinking"));

      const controller = new AbortController();
      abortController = controller;
      let streamMessage: DisplayMessage | null = null;

      try {
        const response = await fetch(`${API_BASE}/api/widget/chat`, {
          method: "POST",
          signal: controller.signal,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ channelSessionId: sessionId, locale, message: text }),
        });

        if (response.status === 429) {
          setStatus(t("rateLimited"));
        } else if (response.status === 503) {
          setStatus(t("notConfigured"));
        } else if (!response.ok) {
          setStatus(t("errorBody"));
        } else if (!response.body || !(response.headers.get("content-type") ?? "").includes("text/event-stream")) {
          const data = (await response.json()) as { reply: string; messageId: string; paused?: boolean };
          if (data.paused) {
            setStatus(t("waitingForHuman"));
            pollForHumanReply();
          } else {
            messages.push({ role: "assistant", content: data.reply, id: data.messageId, feedback: null });
            renderMessages();
            setStatus("");
            if (open) scheduleIdleClose();
          }
        } else {
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";
          let streamFailed = false;

          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;

            const parsed = parseSseChunk(buffer, decoder.decode(value, { stream: true }));
            buffer = parsed.buffer;

            for (const { event, data } of parsed.events) {
              if (event === "chunk") {
                const { text: delta } = data as { text: string };
                if (!streamMessage) {
                  streamMessage = { role: "assistant", content: "", feedback: null };
                  messages.push(streamMessage);
                  setStatus("");
                }
                streamMessage.content += delta;
                renderMessages();
              } else if (event === "done") {
                const result = data as { reply: string; messageId: string };
                if (streamMessage) {
                  streamMessage.content = streamMessage.content || result.reply;
                  streamMessage.id = result.messageId;
                } else {
                  messages.push({ role: "assistant", content: result.reply, id: result.messageId, feedback: null });
                }
                renderMessages();
                if (open) scheduleIdleClose();
              } else if (event === "error") {
                streamFailed = true;
              }
            }
          }

          if (streamFailed && !streamMessage) setStatus(t("errorBody"));
        }
      } catch {
        if (controller.signal.aborted) {
          // Stop pressed — keep the partial text, marked as cut off.
          const partial = streamMessage as DisplayMessage | null;
          if (partial && !partial.id) {
            partial.stopped = true;
            partial.feedback = undefined;
          }
          setStatus("");
          renderMessages();
          if (open) scheduleIdleClose();
        } else {
          setStatus(t("errorBody"));
        }
      } finally {
        if (abortController === controller) abortController = null;
        sending = false;
        sendBtn.textContent = t("send");
      }
    }

    let pollTimer: ReturnType<typeof setInterval> | null = null;

    // Mirrors ChatWidget.tsx's polling: while paused for human handoff,
    // there's no push channel into the widget's shadow DOM, so this is the
    // only way an operator's manual reply shows up without a page reload.
    function pollForHumanReply() {
      if (pollTimer) return;
      const seenCount = messages.length;
      let attempts = 0;
      const MAX_ATTEMPTS = 60;
      pollTimer = setInterval(async () => {
        attempts++;
        if (attempts > MAX_ATTEMPTS) {
          if (pollTimer) clearInterval(pollTimer);
          pollTimer = null;
          return;
        }
        try {
          const response = await fetch(`${API_BASE}/api/widget/history?channelSessionId=${sessionId}`);
          if (!response.ok) return;
          const data = (await response.json()) as {
            messages: Array<{ id: string; role: Role; content: string }>;
          };
          if (data.messages.length > seenCount) {
            messages.length = 0;
            for (const m of data.messages) {
              messages.push({
                role: m.role,
                content: m.content,
                id: m.role === "assistant" ? m.id : undefined,
                feedback: m.role === "assistant" ? null : undefined,
              });
            }
            renderMessages();
            setStatus("");
            if (pollTimer) clearInterval(pollTimer);
            pollTimer = null;
          }
        } catch {
          // keep polling — a transient network error shouldn't end the wait
        }
      }, 5000);
    }

    sendBtn.addEventListener("click", () => {
      if (sending) abortController?.abort();
      else void send();
    });
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") send();
    });

    // Actively composing a reply isn't silence — every keystroke pushes the
    // idle window out another full IDLE_CLOSE_MS, so the timer only ever
    // fires that long after the visitor's last keystroke (or last message),
    // whichever came later. Only matters once there's actually a live idle
    // cycle running (`idleTimer` set) — no point restarting a clock that
    // isn't ticking (before the first message, or once the panel's ended).
    input.addEventListener("input", () => {
      if (open && idleTimer) scheduleIdleClose();
    });

    /**
     * The panel mounts once per browser session (guard at the top of this
     * file) and a soft locale switch never reloads /widget.js, so without
     * this it stayed frozen in whatever language/corner it started in —
     * unlike the ElevenLabs voice widget, which re-reads page direction on
     * every render. Watching <html lang> (set per-locale in
     * app/[locale]/layout.tsx) keeps this widget's side and text in step
     * with the rest of the page instead of lagging a language switch.
     */
    function applyLocale(newLocale: Locale) {
      if (newLocale === locale) return;
      locale = newLocale;
      dir = locale === "fa" ? "rtl" : "ltr";
      host.setAttribute("dir", dir);
      style.textContent = buildStyles(positionSide);
      title.textContent = t("assistantName");
      role.textContent = t("assistantRole");
      closeBtn.setAttribute("aria-label", t("closeChat"));
      input.placeholder = t("inputPlaceholder");
      sendBtn.textContent = sending ? t("stop") : t("send");
      launcher.setAttribute("aria-label", open ? t("closeChat") : t("openChat"));
      endTitle.textContent = t("endedTitle");
      endBody.textContent = t("endedBody");
      rateQuestion.textContent = t("rateQuestion");
      thanksEl.textContent = t("thanksForRating");
      renderMessages();
    }

    new MutationObserver(() => applyLocale(detectLocale())).observe(
      document.documentElement,
      { attributes: true, attributeFilter: ["lang"] },
    );

    renderMessages();
  }

  if (document.body) {
    mount();
  } else {
    document.addEventListener("DOMContentLoaded", mount);
  }
}
