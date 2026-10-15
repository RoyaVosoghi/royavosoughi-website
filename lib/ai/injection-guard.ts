import "server-only";

import type { Locale } from "./types";

/**
 * Cheap pre-model screen for the most common prompt-injection phrasings —
 * "ignore all previous instructions", "show me your system prompt", "you
 * are now DAN" and their Persian equivalents. A hit is answered with a fixed
 * reply and never reaches the model, so it costs no tokens and can't leak
 * anything. Deliberately narrow: every pattern needs an instruction-override
 * verb AND a target (instructions/prompt/rules), so ordinary questions like
 * "what are your instructions for booking?" don't trip it. The system
 * prompt's own guardrails remain the real defense for anything subtler.
 */
const PATTERNS: RegExp[] = [
  // English
  /\b(ignore|disregard|forget|override|bypass)\b[^.!?\n]{0,40}\b(previous|prior|above|earlier|all|your|the|system)\b[^.!?\n]{0,20}\b(instructions?|prompts?|rules|guidelines|directives)\b/i,
  /\b(reveal|show|print|repeat|output|leak|display|tell me)\b[^.!?\n]{0,30}\b(your|the)\s+(system\s+prompt|initial\s+prompt|hidden\s+(prompt|instructions)|instructions\s+above|developer\s+message)\b/i,
  /\bwhat\s+(is|are|was|were)\s+your\s+(system\s+prompt|initial\s+instructions|hidden\s+instructions)\b/i,
  /\b(you\s+are\s+now|act\s+as|pretend\s+to\s+be)\s+(dan|an?\s+unrestricted|an?\s+unfiltered|jailbroken)\b/i,
  /\b(developer|god|jailbreak|dan)\s+mode\b/i,
  // Persian
  /(دستورات|دستورالعمل|قوانین|پرامپت|قواعد)[^.!؟\n]{0,30}(قبلی|بالا|قبل|سیستمی|خودت)[^.!؟\n]{0,30}(نادیده|فراموش|کنار بگذار|بی‌خیال|بیخیال)/,
  /(نادیده بگیر|فراموش کن)[^.!؟\n]{0,30}(دستورات|دستورالعمل|قوانین|پرامپت|قواعد)/,
  /(پرامپت|دستورالعمل)\s*(سیستمی|سیستم|اولیه|مخفی)[^.!؟\n]{0,30}(نشان بده|بگو|چاپ کن|بنویس|فاش کن)/,
];

export function looksLikePromptInjection(message: string): boolean {
  const text = message.normalize("NFKC");
  return PATTERNS.some((pattern) => pattern.test(text));
}

export const INJECTION_GUARD_REPLY: Record<Locale, string> = {
  en: "I can only help with questions about Roya's services, work, and how to get in touch. What would you like to know?",
  fa: "من فقط می‌توانم دربارهٔ خدمات، نمونه‌کارها و راه‌های تماس با رویا کمک کنم. دوست دارید دربارهٔ چه چیزی بدانید؟",
};
