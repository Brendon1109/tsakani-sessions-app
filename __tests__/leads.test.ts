import { describe, it, expect } from "vitest";
import { type Lead, describeConsents, sortLeadsByDateDesc } from "@/lib/leads";

describe("describeConsents", () => {
  it("labels a single consent", () => {
    expect(describeConsents(true, false)).toBe("Events");
    expect(describeConsents(false, true)).toBe("Merch");
  });

  it("joins both consents with 'and'", () => {
    expect(describeConsents(true, true)).toBe("Events and Merch");
  });

  it("falls back to a generic label when nothing is set", () => {
    expect(describeConsents(false, false)).toBe("Newsletter");
  });
});

describe("sortLeadsByDateDesc", () => {
  const make = (source: Lead["source"], date: string): Lead => ({
    source,
    name: null,
    email: `${source}@example.com`,
    phone: null,
    detail: "x",
    date,
  });

  it("sorts a mixed set of sources newest first without merging them", () => {
    const input: Lead[] = [
      make("Newsletter", "2026-01-01T00:00:00Z"),
      make("Booking", "2026-03-01T00:00:00Z"),
      make("Ticket buyer", "2026-02-01T00:00:00Z"),
    ];
    const sorted = sortLeadsByDateDesc(input);
    expect(sorted.map((l) => l.source)).toEqual([
      "Booking",
      "Ticket buyer",
      "Newsletter",
    ]);
    // Same count in, same count out: sources are never collapsed.
    expect(sorted).toHaveLength(3);
  });

  it("does not mutate the input array", () => {
    const input: Lead[] = [
      make("Booking", "2026-01-01T00:00:00Z"),
      make("Merch buyer", "2026-05-01T00:00:00Z"),
    ];
    const before = input.map((l) => l.date);
    sortLeadsByDateDesc(input);
    expect(input.map((l) => l.date)).toEqual(before);
  });

  it("keeps every conforming lead shape", () => {
    const lead = make("Gallery view", "2026-04-01T00:00:00Z");
    const [out] = sortLeadsByDateDesc([lead]);
    expect(out).toEqual({
      source: "Gallery view",
      name: null,
      email: "Gallery view@example.com",
      phone: null,
      detail: "x",
      date: "2026-04-01T00:00:00Z",
    });
  });
});
