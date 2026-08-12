import type { AdminMessages } from "./en";
import shared from "./messages/shared.fa";
import knowledge from "./messages/knowledge.fa";
import inbox from "./messages/inbox.fa";
import system from "./messages/system.fa";

/** Persian admin strings — see en.ts for the split-file/merge reasoning. Typed against AdminMessages so a missing/extra key anywhere fails the build. */
const messages: AdminMessages = {
  ...shared,
  ...knowledge,
  ...inbox,
  ...system,
};

export default messages;
