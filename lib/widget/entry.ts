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
}

// Guard against the script being included twice on the same page.
if (!(window as unknown as { __royaChatWidgetLoaded?: boolean }).__royaChatWidgetLoaded) {
  (window as unknown as { __royaChatWidgetLoaded: boolean }).__royaChatWidgetLoaded = true;

  // Must be read synchronously at top-level — this is what tells the widget
  // which origin to call, so an embedding site never has to configure it.
  const currentScript = document.currentScript as HTMLScriptElement | null;
  const API_BASE = currentScript ? new URL(currentScript.src).origin : "";

  const DEFAULT_ACCENT = "#0f7b4f";

  const COLORS = {
    forest: "#023316",
    forestSoft: "#0a4a24",
    emerald: DEFAULT_ACCENT, // overwritten below once /api/widget/config resolves
    mint: "#dff5e9",
    offwhite: "#f7faf8",
    ink: "#1a1e1c",
    saffronDeep: "#876012",
  };

  const STRINGS: Record<Locale, Record<string, string>> = {
    en: {
      bubbleTitle: "Ask me anything",
      openChat: "Open chat",
      closeChat: "Close chat",
      inputPlaceholder: "Type a message…",
      send: "Send",
      sending: "Sending…",
      thinking: "Thinking…",
      errorBody: "That didn't go through. Please try again in a moment.",
      emptyState: "Say hello, or ask a question.",
      rateLimited: "You've sent a lot of messages in a short time — please wait a few minutes.",
      notConfigured: "Chat isn't available right now.",
    },
    fa: {
      bubbleTitle: "هر چیزی بپرسید",
      openChat: "باز کردن گفتگو",
      closeChat: "بستن گفتگو",
      inputPlaceholder: "پیامی بنویسید…",
      send: "ارسال",
      sending: "در حال ارسال…",
      thinking: "در حال فکر کردن…",
      errorBody: "ارسال نشد. لطفا کمی بعد دوباره امتحان کنید.",
      emptyState: "سلام کنید یا سوالی بپرسید.",
      rateLimited: "در مدت کوتاهی پیام‌های زیادی فرستادید — لطفا چند دقیقه صبر کنید.",
      notConfigured: "گفتگو الان در دسترس نیست.",
    },
  };

  function detectLocale(): Locale {
    const lang = (document.documentElement.lang || navigator.language || "en").toLowerCase();
    return lang.startsWith("fa") ? "fa" : "en";
  }

  const locale = detectLocale();
  const dir = locale === "fa" ? "rtl" : "ltr";
  const t = (key: string) => STRINGS[locale][key] ?? key;

  const SESSION_STORAGE_KEY = "rv_widget_session_id";
  function getOrCreateSessionId(): string {
    const existing = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (existing) return existing;
    const id = crypto.randomUUID();
    window.localStorage.setItem(SESSION_STORAGE_KEY, id);
    return id;
  }
  const sessionId = getOrCreateSessionId();

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
      bottom: 20px;
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
      background: ${COLORS.offwhite};
      border-radius: 24px;
      border: 2px solid rgba(2, 51, 22, 0.15);
      box-shadow: 0 20px 50px rgba(2, 51, 22, 0.25);
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
      background: ${COLORS.forest};
      padding: 14px 18px;
      flex-shrink: 0;
    }
    .rv-header-title {
      color: ${COLORS.offwhite};
      font-weight: 600;
      font-size: 15px;
      margin: 0;
    }
    .rv-header-close {
      background: none;
      border: none;
      color: ${COLORS.mint};
      cursor: pointer;
      width: 30px;
      height: 30px;
      border-radius: 999px;
      display: grid;
      place-items: center;
    }
    .rv-header-close:hover { background: ${COLORS.forestSoft}; color: ${COLORS.offwhite}; }
    .rv-messages {
      flex: 1;
      overflow-y: auto;
      padding: 18px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .rv-empty { color: rgba(26, 30, 28, 0.6); font-size: 14px; }
    .rv-bubble-row { display: flex; }
    .rv-bubble-row.rv-user { justify-content: flex-end; }
    .rv-bubble-row.rv-assistant { justify-content: flex-start; }
    .rv-bubble {
      max-width: 80%;
      border-radius: 16px;
      padding: 10px 14px;
      font-size: 14px;
      line-height: 1.45;
      white-space: pre-wrap;
    }
    .rv-user .rv-bubble { background: ${COLORS.forest}; color: ${COLORS.offwhite}; }
    .rv-assistant .rv-bubble { background: ${COLORS.mint}; color: ${COLORS.ink}; }
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
      color: rgba(26, 30, 28, 0.35);
      transition: background 0.15s ease, color 0.15s ease;
    }
    .rv-feedback-btn:hover:not(:disabled) { background: rgba(2, 51, 22, 0.06); color: ${COLORS.emerald}; }
    .rv-feedback-btn:disabled { cursor: default; }
    .rv-feedback-btn[data-active="true"] { background: rgba(15, 123, 79, 0.15); color: ${COLORS.emerald}; }
    .rv-feedback-btn[data-active="true"].rv-down { background: rgba(135, 96, 18, 0.15); color: ${COLORS.saffronDeep}; }
    .rv-status {
      padding: 8px 18px;
      font-size: 13px;
      font-weight: 500;
      color: ${COLORS.saffronDeep};
      border-top: 1px solid rgba(2, 51, 22, 0.1);
    }
    .rv-input-row {
      display: flex;
      gap: 10px;
      align-items: center;
      padding: 14px;
      border-top: 1px solid rgba(2, 51, 22, 0.1);
      flex-shrink: 0;
    }
    .rv-input {
      flex: 1;
      border: 2px solid rgba(2, 51, 22, 0.15);
      border-radius: 16px;
      padding: 10px 14px;
      font-size: 14px;
      color: ${COLORS.ink};
      background: ${COLORS.offwhite};
      outline: none;
      font-family: inherit;
    }
    .rv-input:focus { border-color: ${COLORS.emerald}; }
    .rv-send {
      background: ${COLORS.emerald};
      color: ${COLORS.offwhite};
      border: none;
      border-radius: 999px;
      padding: 10px 18px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      flex-shrink: 0;
    }
    .rv-send:hover:not(:disabled) { background: ${COLORS.forest}; }
    .rv-send:disabled { opacity: 0.5; cursor: default; }
    .rv-launcher {
      width: 60px;
      height: 60px;
      border-radius: 999px;
      background: ${COLORS.emerald};
      color: ${COLORS.offwhite};
      border: none;
      cursor: pointer;
      display: grid;
      place-items: center;
      box-shadow: 0 8px 24px rgba(2, 51, 22, 0.35);
      transition: background 0.2s ease, transform 0.2s ease;
    }
    .rv-launcher:hover { background: ${COLORS.forest}; transform: translateY(-2px); }
    .rv-fallback { padding: 20px; font-size: 14px; color: ${COLORS.ink}; text-align: center; }
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
    if (config?.primaryColor) COLORS.emerald = config.primaryColor;
    const positionSide = config?.position === "bottom-start" ? "start" : "end";
    const welcomeOverride = locale === "fa" ? config?.welcomeMessageFa : config?.welcomeMessageEn;
    if (welcomeOverride) STRINGS[locale].emptyState = welcomeOverride;

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
    const title = el("p", "rv-header-title");
    title.textContent = t("bubbleTitle");
    const closeBtn = el("button", "rv-header-close");
    closeBtn.type = "button";
    closeBtn.innerHTML = CLOSE_ICON;
    closeBtn.setAttribute("aria-label", t("closeChat"));
    header.appendChild(title);
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

    const launcher = el("button", "rv-launcher");
    launcher.type = "button";
    launcher.innerHTML = CHAT_ICON;
    launcher.setAttribute("aria-label", t("openChat"));
    root.appendChild(launcher);

    let open = false;
    let sending = false;
    const messages: DisplayMessage[] = [];

    async function rate(message: DisplayMessage, rating: 1 | -1) {
      if (!message.id || message.feedback !== null) return;
      message.feedback = rating;
      renderMessages();
      try {
        await fetch(`${API_BASE}/api/widget/feedback`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messageId: message.id, rating }),
        });
      } catch {
        // Best-effort — the button already reflects the visitor's choice.
      }
    }

    function renderMessages() {
      messagesEl.innerHTML = "";
      if (messages.length === 0) {
        const empty = el("p", "rv-empty");
        empty.textContent = t("emptyState");
        messagesEl.appendChild(empty);
      } else {
        for (const message of messages) {
          const row = el("div", `rv-bubble-row rv-${message.role}`);
          const wrap = el("div");
          const bubble = el("div", "rv-bubble");
          bubble.textContent = message.content;
          wrap.appendChild(bubble);

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
            wrap.appendChild(feedbackRow);
          }

          row.appendChild(wrap);
          messagesEl.appendChild(row);
        }
      }
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    function setStatus(text: string) {
      statusEl.textContent = text;
      statusEl.style.display = text ? "block" : "none";
    }

    function setOpen(next: boolean) {
      open = next;
      panel.dataset.open = String(open);
      launcher.innerHTML = open ? CLOSE_ICON : CHAT_ICON;
      launcher.setAttribute("aria-label", open ? t("closeChat") : t("openChat"));
      if (open) input.focus();
    }

    launcher.addEventListener("click", () => setOpen(!open));
    closeBtn.addEventListener("click", () => setOpen(false));

    async function send() {
      const text = input.value.trim();
      if (!text || sending) return;

      messages.push({ role: "user", content: text });
      renderMessages();
      input.value = "";
      sending = true;
      sendBtn.disabled = true;
      sendBtn.textContent = t("sending");
      setStatus(t("thinking"));

      try {
        const response = await fetch(`${API_BASE}/api/widget/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ channelSessionId: sessionId, locale, message: text }),
        });

        if (response.status === 429) {
          setStatus(t("rateLimited"));
        } else if (response.status === 503) {
          setStatus(t("notConfigured"));
        } else if (!response.ok) {
          setStatus(t("errorBody"));
        } else {
          const data = (await response.json()) as { reply: string; messageId: string };
          messages.push({ role: "assistant", content: data.reply, id: data.messageId, feedback: null });
          renderMessages();
          setStatus("");
        }
      } catch {
        setStatus(t("errorBody"));
      } finally {
        sending = false;
        sendBtn.disabled = false;
        sendBtn.textContent = t("send");
      }
    }

    sendBtn.addEventListener("click", send);
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") send();
    });

    renderMessages();
  }

  if (document.body) {
    mount();
  } else {
    document.addEventListener("DOMContentLoaded", mount);
  }
}
