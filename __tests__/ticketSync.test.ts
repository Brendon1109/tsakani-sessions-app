import { describe, it, expect } from "vitest";
import { isCompleteTicket, planTicketSync } from "@/lib/ticketSync";

const ga = { id: "t1", name: "General Admission", price_zar: 150, quantity_total: 100 };
const vip = { id: "t2", name: "VIP", price_zar: 500, quantity_total: 20 };

describe("isCompleteTicket", () => {
  it("accepts a ticket with name, price, and quantity", () => {
    expect(isCompleteTicket(ga)).toBe(true);
  });

  it("rejects blank or whitespace-only names", () => {
    expect(isCompleteTicket({ ...ga, name: "" })).toBe(false);
    expect(isCompleteTicket({ ...ga, name: "   " })).toBe(false);
  });

  it("rejects non-finite price or quantity", () => {
    expect(isCompleteTicket({ ...ga, price_zar: undefined })).toBe(false);
    expect(isCompleteTicket({ ...ga, quantity_total: NaN })).toBe(false);
  });

  it("accepts a free ticket (price 0)", () => {
    expect(isCompleteTicket({ ...ga, price_zar: 0 })).toBe(true);
  });
});

describe("planTicketSync", () => {
  it("updates existing tickets and inserts new ones", () => {
    const result = planTicketSync(
      ["t1"],
      [ga, { name: "Early Bird", price_zar: 100, quantity_total: 50 }],
    );
    if ("error" in result) throw new Error(result.error);
    expect(result.plan.toDelete).toEqual([]);
    expect(result.plan.toUpdate).toEqual([ga]);
    expect(result.plan.toInsert).toEqual([
      { name: "Early Bird", price_zar: 100, quantity_total: 50 },
    ]);
  });

  it("deletes only tickets removed from the form", () => {
    const result = planTicketSync(["t1", "t2"], [ga]);
    if ("error" in result) throw new Error(result.error);
    expect(result.plan.toDelete).toEqual(["t2"]);
  });

  it("NEVER deletes an existing ticket that was submitted with a blank name — errors instead", () => {
    // Regression: a cleared name used to drop the ticket from the "valid" set,
    // which classified it as removed and deleted it (cascading its orders).
    const result = planTicketSync(["t1", "t2"], [{ ...ga, name: "" }, vip]);
    expect("error" in result).toBe(true);
  });

  it("errors on an existing ticket with invalid price instead of deleting it", () => {
    const result = planTicketSync(["t1"], [{ ...ga, price_zar: undefined }]);
    expect("error" in result).toBe(true);
  });

  it("skips incomplete NEW tickets (blank add-ticket rows) without error", () => {
    const result = planTicketSync(["t1"], [ga, { name: "", price_zar: 0, quantity_total: 100 }]);
    if ("error" in result) throw new Error(result.error);
    expect(result.plan.toInsert).toEqual([]);
    expect(result.plan.toDelete).toEqual([]);
  });

  it("deletes everything when the form has no tickets", () => {
    const result = planTicketSync(["t1", "t2"], []);
    if ("error" in result) throw new Error(result.error);
    expect(result.plan.toDelete).toEqual(["t1", "t2"]);
    expect(result.plan.toUpdate).toEqual([]);
    expect(result.plan.toInsert).toEqual([]);
  });
});
