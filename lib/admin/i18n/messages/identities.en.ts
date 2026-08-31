/** English strings for /admin/identities — the chat-identity registry (unified_users), distinct from CRM Contacts at /admin/contacts. */
const messages = {
  identities: {
    eyebrow: "Identity",
    title: "Identities",
    subtitle:
      "One row per identity seen across web, widget, and Telegram — names fill in once a visitor is captured as a lead.",
    notConfiguredTitle: "Supabase isn't configured",
    notConfiguredBody: "Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to see visitors here.",
    columnName: "Name",
    columnChannel: "Channel",
    columnIdentifier: "Identifier",
    columnFirstSeen: "First seen",
    emptyTitle: "No visitors yet",
    emptyBody: "They'll show up here the moment someone opens the chat.",
  },
} as const;

export default messages;
