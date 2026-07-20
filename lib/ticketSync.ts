export interface TicketInput {
  id?: string;
  name?: string;
  price_zar?: number;
  quantity_total?: number;
  description?: string;
  /** Manual on/off. Absent is treated as on, so older callers behave as before. */
  is_active?: boolean;
  /** Optional sale window, as ISO instants. Null means unbounded on that side. */
  sale_start?: string | null;
  sale_end?: string | null;
}

export interface TicketSyncPlan {
  toDelete: string[];
  toUpdate: TicketInput[];
  toInsert: TicketInput[];
}

export function isCompleteTicket(t: TicketInput): boolean {
  return (
    Boolean(t.name && t.name.trim()) &&
    Number.isFinite(t.price_zar) &&
    Number.isFinite(t.quantity_total)
  );
}

/**
 * Decide which tickets to delete, update, and insert when saving an event.
 *
 * An existing ticket is deleted ONLY when its id is absent from the submitted
 * form. An existing ticket submitted with cleared/invalid fields is a
 * validation error, never a delete — ticket_orders cascade on ticket delete,
 * so misclassifying one would silently destroy sales records.
 *
 * Incomplete tickets WITHOUT an id (e.g. a blank "Add ticket" row that was
 * never filled in) are skipped rather than rejected.
 */
export function planTicketSync(
  existingIds: string[],
  incoming: TicketInput[],
): { error: string } | { plan: TicketSyncPlan } {
  const invalidExisting = incoming.filter((t) => t.id && !isCompleteTicket(t));
  if (invalidExisting.length > 0) {
    return {
      error:
        "Every ticket needs a name, price, and quantity. Fix or remove the incomplete ticket, then save again.",
    };
  }

  const incomingIds = new Set(
    incoming.filter((t) => t.id).map((t) => t.id as string),
  );
  const complete = incoming.filter(isCompleteTicket);

  return {
    plan: {
      toDelete: existingIds.filter((id) => !incomingIds.has(id)),
      toUpdate: complete.filter((t) => t.id),
      toInsert: complete.filter((t) => !t.id),
    },
  };
}
