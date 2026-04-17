import { describe, it, expect } from "vitest";
import {
  createBookingMessage,
  createOrderMessage,
  createTicketOrderMessage,
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
