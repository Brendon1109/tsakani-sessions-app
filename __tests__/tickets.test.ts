import { describe, it, expect } from "vitest";
import { isTicketOnSale, onSaleTickets } from "@/lib/tickets";

// The 25 July event, in absolute instants.
// 13:00 SAST = 11:00 UTC, 04:00 SAST next day = 02:00 UTC.
const DOOR_OPEN = "2026-07-25T11:00:00.000Z";
const DOOR_CLOSE = "2026-07-26T02:00:00.000Z";

const at = (iso: string) => new Date(iso);

const freeEntry = { is_active: true, sale_start: null, sale_end: DOOR_OPEN };
const doorAdmission = { is_active: true, sale_start: DOOR_OPEN, sale_end: DOOR_CLOSE };

describe("isTicketOnSale", () => {
  it("treats a ticket with no window as always on sale", () => {
    expect(isTicketOnSale({ is_active: true, sale_start: null, sale_end: null })).toBe(true);
  });

  it("respects is_active regardless of the window", () => {
    expect(isTicketOnSale({ ...doorAdmission, is_active: false }, at(DOOR_OPEN))).toBe(false);
  });

  it("hands over from free entry to door admission at exactly 13:00", () => {
    const justBefore = at("2026-07-25T10:59:59.000Z");
    expect(isTicketOnSale(freeEntry, justBefore)).toBe(true);
    expect(isTicketOnSale(doorAdmission, justBefore)).toBe(false);

    // At the boundary the swap is complete, with no overlap and no gap.
    const boundary = at(DOOR_OPEN);
    expect(isTicketOnSale(freeEntry, boundary)).toBe(false);
    expect(isTicketOnSale(doorAdmission, boundary)).toBe(true);
  });

  it("closes door admission at exactly 04:00, not a moment later", () => {
    expect(isTicketOnSale(doorAdmission, at("2026-07-26T01:59:59.000Z"))).toBe(true);
    expect(isTicketOnSale(doorAdmission, at(DOOR_CLOSE))).toBe(false);
    expect(isTicketOnSale(doorAdmission, at("2026-07-26T03:00:00.000Z"))).toBe(false);
  });

  it("never leaves the event with nothing on sale between the two windows", () => {
    const samples = [
      "2026-07-25T06:00:00.000Z",
      "2026-07-25T10:59:59.999Z",
      "2026-07-25T11:00:00.000Z",
      "2026-07-25T18:00:00.000Z",
      "2026-07-26T01:59:59.999Z",
    ];
    for (const iso of samples) {
      const live = onSaleTickets([freeEntry, doorAdmission], at(iso));
      expect(live.length, `expected exactly one ticket live at ${iso}`).toBe(1);
    }
  });

  it("refuses a malformed date rather than treating it as unbounded", () => {
    expect(isTicketOnSale({ is_active: true, sale_start: "not-a-date", sale_end: null })).toBe(false);
    expect(isTicketOnSale({ is_active: true, sale_start: null, sale_end: "not-a-date" })).toBe(false);
  });

  it("filters a mixed list down to what is genuinely buyable", () => {
    const live = onSaleTickets(
      [freeEntry, doorAdmission, { is_active: false, sale_start: null, sale_end: null }],
      at("2026-07-25T18:00:00.000Z")
    );
    expect(live).toEqual([doorAdmission]);
  });

  it("handles null and undefined ticket lists", () => {
    expect(onSaleTickets(null)).toEqual([]);
    expect(onSaleTickets(undefined)).toEqual([]);
  });
});
