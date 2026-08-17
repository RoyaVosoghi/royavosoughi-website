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
  // Lets our own site (see ElevenLabsVoiceWidget.tsx's sibling launcher) stack
  // this bubble above the ElevenLabs call button instead of overlapping it,
  // via <script data-bottom-offset="96">. Third-party embeds never set this,
  // so they keep the normal 20px.
  const BOTTOM_OFFSET = Number(currentScript?.dataset.bottomOffset) || 20;

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
      rateLimited: "You've sent a lot of messages in a short time — please wait a few minutes.",
      notConfigured: "Chat isn't available right now.",
      waitingForHuman: "A team member will reply here shortly.",
      endedTitle: "Thanks for reaching out!",
      endedBody: "Have a great day.",
      rateQuestion: "How was this conversation?",
      thanksForRating: "Thanks for your feedback!",
      checkInNudge: "Still there? Is there anything else I can help you with?",
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
      rateLimited: "در مدت کوتاهی پیام‌های زیادی فرستادید — لطفا چند دقیقه صبر کنید.",
      notConfigured: "گفتگو الان در دسترس نیست.",
      waitingForHuman: "به‌زودی یکی از اعضای تیم همین‌جا پاسخ می‌دهد.",
      endedTitle: "ممنون که پیام دادید!",
      endedBody: "روز خوبی داشته باشید.",
      rateQuestion: "این گفتگو چطور بود؟",
      thanksForRating: "بابت بازخوردتان ممنونیم!",
      checkInNudge: "هنوز آنجا هستید؟ کار دیگری هست که بتوانم کمکتان کنم؟",
    },
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
    .rv-starters { display: flex; flex-wrap: wrap; gap: 8px; }
    .rv-starter-btn {
      border: 2px solid rgba(2, 51, 22, 0.15);
      background: ${COLORS.offwhite};
      color: rgba(26, 30, 28, 0.8);
      border-radius: 999px;
      padding: 8px 14px;
      font-size: 13px;
      cursor: pointer;
      transition: border-color 0.15s ease, color 0.15s ease;
    }
    .rv-starter-btn:hover { border-color: ${COLORS.emerald}; color: ${COLORS.emerald}; }
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
      /* Matches the ElevenLabs voice launcher's fixed 36x36px button (its
         "tiny" variant has no config field to resize it — confirmed against
         the widget-embed bundle) so the two stacked launchers read as the
         same size. */
      width: 36px;
      height: 36px;
      padding: 0;
      border-radius: 50%;
      background: ${COLORS.forest};
      color: ${COLORS.offwhite};
      border: none;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-family: inherit;
      box-shadow: 0 8px 24px rgba(2, 51, 22, 0.35);
      transition: background 0.2s ease, transform 0.2s ease;
    }
    .rv-launcher:hover { background: ${COLORS.forestSoft}; transform: translateY(-2px); }
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
    .rv-end-title { font-size: 16px; font-weight: 700; color: ${COLORS.forest}; margin: 0; }
    .rv-end-body { font-size: 14px; color: rgba(26, 30, 28, 0.65); margin: 0 0 8px; }
    .rv-rate-question { font-size: 13px; font-weight: 600; color: ${COLORS.ink}; margin: 0; }
    .rv-stars { display: flex; gap: 6px; }
    .rv-star-btn {
      background: none;
      border: none;
      cursor: pointer;
      padding: 4px;
      color: rgba(2, 51, 22, 0.25);
      transition: color 0.15s ease, transform 0.15s ease;
    }
    .rv-star-btn:hover:not(:disabled) { color: ${COLORS.emerald}; transform: scale(1.1); }
    .rv-star-btn[data-active="true"] { color: ${COLORS.emerald}; }
    .rv-star-btn:disabled { cursor: default; }
    .rv-thanks { display: none; font-size: 13px; color: ${COLORS.emerald}; font-weight: 600; margin: 0; }
    `;
  }

  // Sized to the same ~44% icon-to-button ratio as the shrunk .rv-launcher
  // (36px) so the glyph doesn't look lost inside the smaller circle.
  const CHAT_ICON =
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>';
  const CLOSE_ICON =
    '<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M5 5l14 14M19 5L5 19"/></svg>';
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
    if (config?.primaryColor) COLORS.emerald = config.primaryColor;
    const positionSide = config?.position === "bottom-start" ? "start" : "end";
    const starters = (locale === "fa" ? config?.quickRepliesFa : config?.quickRepliesEn) ?? [];

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
    let ended = false;
    let idleTimer: ReturnType<typeof setTimeout> | null = null;
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
      ended = false;
      messages.length = 0;
      endScreen.dataset.visible = "false";
      messagesEl.style.display = "";
      inputRow.style.display = "";
      resetStars();
      setStatus("");
      sessionId = rotateSessionId();
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
          let streamMessage: DisplayMessage | null = null;
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
        setStatus(t("errorBody"));
      } finally {
        sending = false;
        sendBtn.disabled = false;
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

    sendBtn.addEventListener("click", () => send());
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
      title.textContent = t("bubbleTitle");
      closeBtn.setAttribute("aria-label", t("closeChat"));
      input.placeholder = t("inputPlaceholder");
      if (!sending) sendBtn.textContent = t("send");
      launcher.setAttribute("aria-label", open ? t("closeChat") : t("openChat"));
      endTitle.textContent = t("endedTitle");
      endBody.textContent = t("endedBody");
      rateQuestion.textContent = t("rateQuestion");
      thanksEl.textContent = t("thanksForRating");
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
