/**
 * Allowed answers for every dropdown on the consultation form. Shared by the
 * form, the API's zod schema and the notification email so the three can
 * never drift apart. Labels live in messages/*.json under
 * `contact.<field>Options.<value>`; the DB check constraints in
 * supabase/schema.sql must list the same values.
 */
export const contactSelects = {
  role: ["founder", "manager", "technical", "other"],
  industry: [
    "retail",
    "services",
    "healthcare",
    "education",
    "realEstate",
    "hospitality",
    "manufacturing",
    "marketing",
    "tech",
    "other",
  ],
  companySize: ["solo", "small", "medium", "large", "enterprise"],
  businessStage: ["idea", "early", "growing", "established"],
  needType: ["documents", "support", "automation", "agent", "unsure"],
  currentApproach: ["manual", "tool", "otherAi", "none"],
  timeline: ["asap", "quarter", "half", "exploring"],
  budget: ["under2k", "from2to5k", "from5to15k", "over15k", "unsure"],
  preferredTime: ["morning", "afternoon", "evening"],
} as const;

export type ContactSelect = keyof typeof contactSelects;
