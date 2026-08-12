import type { DeepStringify } from "./deep-stringify";
import shared from "./messages/shared.en";
import knowledge from "./messages/knowledge.en";
import inbox from "./messages/inbox.en";
import system from "./messages/system.en";

/**
 * Source-of-truth English strings for the admin panel — a separate tree from
 * messages/en.json (the public site's, which npm run ingest partially feeds
 * into the chatbot's RAG index). Admin copy must never end up in there, so
 * it lives here instead.
 *
 * Split into per-area files under messages/ (shared shell, knowledge/AI
 * pages, inbox/people pages, channels/system pages) purely so unrelated
 * pages' translations can be edited concurrently without touching the same
 * file. This file and fa.ts just merge them — fa.ts is typed against
 * AdminMessages below, so tsc fails loudly if a key is added to one locale
 * and not the other, in any of the source files.
 */
const messages = {
  ...shared,
  ...knowledge,
  ...inbox,
  ...system,
} as const;

export default messages;

export type AdminMessages = DeepStringify<typeof messages>;
