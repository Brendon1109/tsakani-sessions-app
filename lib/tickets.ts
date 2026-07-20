import type { Ticket } from "@/lib/types";

/**
 * Whether a ticket may be sold right now.
 *
 * Two independent gates:
 *   is_active            the manual on/off switch an admin controls
 *   sale_start/sale_end  an optional time window, in absolute instants
 *
 * A null bound means "unbounded on that side", so a ticket with no window
 * behaves exactly as it did before windows existed. The window is half open,
 * [sale_start, sale_end), so a door ticket ending at 04:00 is already closed
 * at 04:00 rather than lingering for a final millisecond.
 *
 * This mirrors the same test inside the reserve_tickets database function.
 * The database is the authority, this exists so the UI does not offer a
 * ticket the database would refuse. Keep the two in step.
 */
export function isTicketOnSale(
  ticket: Pick<Ticket, "is_active" | "sale_start" | "sale_end">,
  now: Date = new Date()
): boolean {
  if (!ticket.is_active) return false;

  const at = now.getTime();

  if (ticket.sale_start) {
    const start = new Date(ticket.sale_start).getTime();
    if (Number.isNaN(start)) return false;
    if (at < start) return false;
  }

  if (ticket.sale_end) {
    const end = new Date(ticket.sale_end).getTime();
    if (Number.isNaN(end)) return false;
    if (at >= end) return false;
  }

  return true;
}

/** Convenience filter for the shape used across the public queries. */
export function onSaleTickets<T extends Pick<Ticket, "is_active" | "sale_start" | "sale_end">>(
  tickets: T[] | null | undefined,
  now: Date = new Date()
): T[] {
  return (tickets || []).filter((t) => isTicketOnSale(t, now));
}
