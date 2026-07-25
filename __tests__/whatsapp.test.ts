import { describe, it, expect } from "vitest";
import {
  createBookingMessage,
  createOrderMessage,
  createTicketOrderMessage,
  waNumber,
} from "@/lib/whatsapp";

describe("whatsapp message builders", () => {
  it("builds a booking message with required fields", () => {
    const msg = createBookingMessage({
      name: "John",
      email: "john@example.com",
      phone: "+27123",
      eventType: "DJ Set",
      eventDate: "2026-06-01",
      venue: "The Spot",
    });
    expect(msg).toContain("TSAKANI SESSIONS BOOKING REQUEST");
    expect(msg).toContain("John");
    expect(msg).toContain("+27123");
    expect(msg).toContain("The Spot");
  });

  it("includes optional budget and services", () => {
    const msg = createBookingMessage({
      name: "A",
      email: "a@a.com",
      phone: "1",
      eventType: "X",
      eventDate: "d",
      venue: "v",
      budget: "R5000-R10000",
      services: ["DJ", "Content"],
    });
    expect(msg).toContain("R5000-R10000");
    expect(msg).toContain("DJ, Content");
  });

  it("builds an order message with totals", () => {
    const msg = createOrderMessage({
      customerName: "Jane",
      customerPhone: "+1",
      items: [
        { name: "Tee", size: "M", color: "Black", quantity: 2, price: 450 },
      ],
      total: 900,
    });
    expect(msg).toContain("Tee");
    expect(msg).toContain("R900");
    expect(msg).toContain("x2");
  });

  it("builds a ticket order message", () => {
    const msg = createTicketOrderMessage({
      customerName: "Sam",
      customerPhone: "+2",
      eventTitle: "Sunset Cruise",
      eventDate: "2026-06-01",
      tickets: [{ type: "Early Bird", quantity: 2, price: 250 }],
      total: 500,
    });
    expect(msg).toContain("Sunset Cruise");
    expect(msg).toContain("Early Bird");
    expect(msg).toContain("R500");
  });
});

/**
 * Every case below is a real format sitting in ticket_orders.buyer_phone right
 * now. wa.me accepts none of them verbatim — given a number it cannot parse it
 * opens a chat with nobody, which looks to the team like the ticket was sent.
 * So the door's "send their ticket" button is only as good as this function.
 */
describe("waNumber", () => {
  it("converts a local South African number to international", () => {
    expect(waNumber("0663444301")).toBe("27663444301");
    expect(waNumber("082 123 4567")).toBe("27821234567");
  });

  it("keeps a number that is already international", () => {
    expect(waNumber("27722662818")).toBe("27722662818");
    expect(waNumber("+27813936557")).toBe("27813936557");
  });

  it("restores a leading zero lost to a spreadsheet", () => {
    expect(waNumber("814881232")).toBe("27814881232");
  });

  it("strips punctuation people actually type", () => {
    expect(waNumber("(060) 893-2868")).toBe("27608932868");
  });

  it("returns null when there is nothing to send to, so the button hides", () => {
    expect(waNumber(null)).toBeNull();
    expect(waNumber("")).toBeNull();
    expect(waNumber("n/a")).toBeNull();
    expect(waNumber("12345")).toBeNull();
  });
});
