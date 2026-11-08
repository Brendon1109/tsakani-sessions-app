import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Book Now in the header goes through /book. With an event coming up it opens
 * /events, where the tickets are. With nothing on, /events only says "No
 * upcoming events right now", so it opens the WhatsApp booking chat instead,
 * and does the same whenever the database cannot be asked.
 */

const DAY = 24 * 60 * 60 * 1000;
const inDays = (n: number) => new Date(Date.now() + n * DAY).toISOString();

let configured = true;
let rows: { date: string }[] | null = [];
let failed = false;
const asked: { table: string; column: string; value: unknown }[] = [];

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () =>
    configured
      ? {
          from: (table: string) => ({
            select: () => ({
              eq: async (column: string, value: unknown) => {
                asked.push({ table, column, value });
                return failed
                  ? { data: null, error: { message: "down" } }
                  : { data: rows, error: null };
              },
            }),
          }),
        }
      : null,
}));

import { GET } from "@/app/book/route";
import { BOOKING_ENQUIRY_URL } from "@/lib/whatsapp";

// The Location header is the link after the URL parser has had it, which
// writes the apostrophe in "I'd" as %27. WhatsApp reads both the same.
const WHATSAPP = new URL(BOOKING_ENQUIRY_URL).href;

async function bookNow() {
  const res = await GET(new Request("https://tsakanisessions.co.za/book"));
  return { status: res.status, location: res.headers.get("location") };
}

describe("/book", () => {
  beforeEach(() => {
    configured = true;
    rows = [];
    failed = false;
    asked.length = 0;
  });

  it("is the same booking chat the home page links to", () => {
    expect(BOOKING_ENQUIRY_URL).toBe(
      "https://wa.me/27769961477?text=Hi%20Tsakani%20Sessions!%20I'd%20like%20to%20enquire%20about%20booking.",
    );
  });

  it("opens /events when an event is coming up", async () => {
    rows = [{ date: inDays(-10) }, { date: inDays(6) }];
    expect(await bookNow()).toEqual({
      status: 307,
      location: "https://tsakanisessions.co.za/events",
    });
    expect(asked).toEqual([{ table: "events", column: "status", value: "published" }]);
  });

  it("opens the WhatsApp booking chat when nothing is coming up", async () => {
    rows = [{ date: inDays(-10) }];
    const { status, location } = await bookNow();
    expect(status).toBe(307);
    expect(location).toBe(WHATSAPP);
    const chat = new URL(location!);
    expect(chat.origin + chat.pathname).toBe("https://wa.me/27769961477");
    expect(chat.searchParams.get("text")).toBe(
      "Hi Tsakani Sessions! I'd like to enquire about booking.",
    );
  });

  it("opens WhatsApp when there are no events at all", async () => {
    rows = [];
    expect((await bookNow()).location).toBe(WHATSAPP);
  });

  it("opens WhatsApp when the database fails or is not configured", async () => {
    failed = true;
    expect((await bookNow()).location).toBe(WHATSAPP);
    failed = false;
    configured = false;
    expect((await bookNow()).location).toBe(WHATSAPP);
  });
});
