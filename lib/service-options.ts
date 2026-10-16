/**
 * The services offered on /services, in display order. The keys are what gets
 * stored in service_requests.service — they must match the CHECK constraint in
 * supabase/schema.sql and the `services.items.*` keys in messages/*.json.
 */
export const serviceKeys = [
  "training",
  "consulting",
  "automation",
  "agent",
  "multiAgent",
] as const;

export type ServiceKey = (typeof serviceKeys)[number];
