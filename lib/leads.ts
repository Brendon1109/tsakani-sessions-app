/**
 * Shared shapes and pure helpers for the admin Leads view.
 *
 * A "lead" is anyone who has shown interest in Tsakani Sessions, drawn from
 * several sources. Sources are never cross-merged: one person may legitimately
 * appear under more than one source (a ticket buyer who also signed up to the
 * newsletter is two leads, not one). The route below fetches each source
 * independently so a source that fails or does not exist yet is simply omitted.
 */

export type LeadSource =
  | "Booking"
  | "Ticket buyer"
  | "Merch buyer"
  | "Newsletter"
  | "Gallery view";

export interface Lead {
  source: LeadSource;
  name: string | null;
  email: string | null;
  phone: string | null;
  detail: string;
  date: string;
}

export const LEAD_SOURCES: LeadSource[] = [
  "Booking",
  "Ticket buyer",
  "Merch buyer",
  "Newsletter",
  "Gallery view",
];

/** Human label for which newsletter topics a subscriber opted into. */
export function describeConsents(events: boolean, merch: boolean): string {
  const parts: string[] = [];
  if (events) parts.push("Events");
  if (merch) parts.push("Merch");
  return parts.length ? parts.join(" and ") : "Newsletter";
}

/** Newest first. Rows with an unparseable date sort last. */
export function sortLeadsByDateDesc(leads: Lead[]): Lead[] {
  return [...leads].sort((a, b) => {
    const ta = new Date(a.date).getTime();
    const tb = new Date(b.date).getTime();
    return (Number.isNaN(tb) ? 0 : tb) - (Number.isNaN(ta) ? 0 : ta);
  });
}
