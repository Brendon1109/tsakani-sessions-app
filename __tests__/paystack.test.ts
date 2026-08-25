import { describe, it, expect } from "vitest";
import { buildPaystackUrl, isPaystackUrl } from "@/lib/paystack";

/**
 * The pay link is built server side from a total the database calculated, and
 * it is the one URL in this app that decides how much a stranger's card gets
 * charged. Both halves are pinned here: the host check that stops it pointing
 * anywhere but Paystack, and the locking that stops a buyer editing the amount.
 */

const BASE = "https://paystack.shop/pay/j3zv9vxm5f";

describe("isPaystackUrl", () => {
  it("accepts Paystack's own hosts over https", () => {
    expect(isPaystackUrl("https://paystack.shop/pay/abc")).toBe(true);
    expect(isPaystackUrl("https://paystack.com/pay/abc")).toBe(true);
    expect(isPaystackUrl("  https://checkout.paystack.com/abc  ")).toBe(true);
  });

  it("refuses anything else, however convincing", () => {
    expect(isPaystackUrl("https://paystack.shop.evil.com/pay/abc")).toBe(false);
    expect(isPaystackUrl("https://paystack-shop.com/pay/abc")).toBe(false);
    expect(isPaystackUrl("https://notpaystack.com/pay/abc")).toBe(false);
    expect(isPaystackUrl("javascript:alert(1)")).toBe(false);
    expect(isPaystackUrl("")).toBe(false);
  });

  it("refuses plain http, even on the right host", () => {
    expect(isPaystackUrl("http://paystack.shop/pay/abc")).toBe(false);
  });
});

describe("buildPaystackUrl", () => {
  it("sends the amount in cents, exactly as stored", () => {
    const url = new URL(
      buildPaystackUrl({ baseUrl: BASE, amountCents: 37000, email: "a@b.com" })!
    );
    expect(url.searchParams.get("amount")).toBe("37000");
  });

  it("locks email and amount so a buyer cannot edit what they owe", () => {
    const url = new URL(
      buildPaystackUrl({ baseUrl: BASE, amountCents: 74000, email: "a@b.com" })!
    );
    expect(url.searchParams.get("read-only")).toBe("email,amount");
  });

  it("splits a name into first and last", () => {
    const url = new URL(
      buildPaystackUrl({
        baseUrl: BASE,
        amountCents: 50000,
        email: "a@b.com",
        customerName: "Brendon Simbarashe Mapinda",
      })!
    );
    expect(url.searchParams.get("first_name")).toBe("Brendon");
    expect(url.searchParams.get("last_name")).toBe("Simbarashe Mapinda");
  });

  it("copes with one name, and with none", () => {
    const one = new URL(
      buildPaystackUrl({ baseUrl: BASE, amountCents: 100, email: "a@b.com", customerName: "Koporal" })!
    );
    expect(one.searchParams.get("first_name")).toBe("Koporal");
    expect(one.searchParams.has("last_name")).toBe(false);

    const none = new URL(
      buildPaystackUrl({ baseUrl: BASE, amountCents: 100, email: "a@b.com", customerName: "  " })!
    );
    expect(none.searchParams.has("first_name")).toBe(false);
  });

  it("keeps the page path and any parameters already on the link", () => {
    const url = new URL(
      buildPaystackUrl({
        baseUrl: "https://paystack.shop/pay/j3zv9vxm5f?utm_source=shop",
        amountCents: 12345,
        email: "a@b.com",
      })!
    );
    expect(url.pathname).toBe("/pay/j3zv9vxm5f");
    expect(url.searchParams.get("utm_source")).toBe("shop");
  });

  it("returns null rather than a link to somewhere else", () => {
    expect(
      buildPaystackUrl({ baseUrl: "https://evil.com/pay", amountCents: 100, email: "a@b.com" })
    ).toBeNull();
    expect(
      buildPaystackUrl({ baseUrl: "not a url", amountCents: 100, email: "a@b.com" })
    ).toBeNull();
  });

  it("rounds a fractional cent rather than sending a decimal", () => {
    const url = new URL(
      buildPaystackUrl({ baseUrl: BASE, amountCents: 999.6, email: "a@b.com" })!
    );
    expect(url.searchParams.get("amount")).toBe("1000");
  });
});
