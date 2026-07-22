import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * The confirmation email is now the buyer's only receipt — the flow no longer
 * dumps them into a WhatsApp thread and hopes. So the things that would quietly
 * ruin it get pinned down here: asking a free ticket holder to pay, letting a
 * typed name become live markup in someone's inbox, and rendering an
 * admin-supplied `javascript:` link as a payment button.
 */

const sent: Record<string, unknown>[] = [];

vi.mock("resend", () => ({
  Resend: class {
    emails = {
      send: async (payload: Record<string, unknown>) => {
        sent.push(payload);
        return { data: { id: "test" }, error: null };
      },
    };
  },
}));

// Both modules read these lazily, inside the call — never at import time — so
// setting them here still takes effect despite the hoisted imports below.
process.env.RESEND_API_KEY = "re_test";
process.env.NEXT_PUBLIC_SITE_URL = "https://tsakanisessions.co.za";

import { sendTicketConfirmation, sendNewsletterWelcome } from "@/lib/email";
import { ticketUrl } from "@/lib/qr";

const base = {
  to: "buyer@example.com",
  buyerName: "Thabo Nkosi",
  orderRef: "TS-1A2B3C4D",
  qrCode: "8f14e45f-ceea-467a-9575-1c4d1a3f2b11",
  ticketName: "Early Bird",
  quantity: 2,
  totalZar: 300,
  eventTitle: "Tsakani Sessions Vol. 4",
  eventDateLabel: "Saturday, 25 July 2026, 8:00 pm",
  ticketUrl: "https://tsakanisessions.co.za/ticket/8f14e45f-ceea-467a-9575-1c4d1a3f2b11",
};

const html = () => String(sent[0].html);

beforeEach(() => {
  sent.length = 0;
});

describe("ticket confirmation email", () => {
  it("carries the order number and the ticket link", async () => {
    await sendTicketConfirmation(base);
    expect(sent).toHaveLength(1);
    expect(sent[0].subject).toContain("TS-1A2B3C4D");
    expect(html()).toContain("TS-1A2B3C4D");
    expect(html()).toContain(base.ticketUrl);
  });

  it("never mentions paying on a free ticket, whatever the event is configured with", async () => {
    await sendTicketConfirmation({
      ...base,
      totalZar: 0,
      paymentUrl: "https://festflow.example/pay",
      paymentNote: "EFT to FNB 1234567890",
    });
    const body = html();
    expect(body).toContain("Nothing to pay");
    expect(body).not.toContain("festflow.example");
    expect(body).not.toContain("FNB 1234567890");
    expect(body).not.toMatch(/Pay R/);
  });

  it("shows the payment button and note on a paid ticket", async () => {
    await sendTicketConfirmation({
      ...base,
      paymentUrl: "https://festflow.example/pay",
      paymentNote: "Use your order number as the reference.",
    });
    const body = html();
    expect(body).toContain("https://festflow.example/pay");
    expect(body).toContain("Use your order number as the reference.");
    expect(body).toContain("Pay R300 now");
  });

  it("falls back to 'we will be in touch' when the event has no payment details", async () => {
    await sendTicketConfirmation(base);
    const body = html();
    expect(body).toContain("payment details");
    expect(body).toContain("TS-1A2B3C4D");
  });

  it("escapes a name so it cannot become markup in the recipient's inbox", async () => {
    await sendTicketConfirmation({
      ...base,
      buyerName: '<img src=x onerror="alert(1)">',
      eventTitle: "<script>alert(2)</script>",
    });
    const body = html();
    expect(body).not.toContain("<img src=x");
    expect(body).not.toContain("<script>");
    expect(body).toContain("&lt;script&gt;");
  });

  it("escapes an admin-written payment note rather than rendering its markup", async () => {
    await sendTicketConfirmation({
      ...base,
      paymentNote: "Pay here <script>steal()</script>",
    });
    expect(html()).not.toContain("<script>steal()");
    expect(html()).toContain("&lt;script&gt;");
  });

  it("drops a payment link that is not http(s)", async () => {
    for (const bad of ["javascript:alert(1)", "data:text/html,<h1>hi", "not a url"]) {
      sent.length = 0;
      await sendTicketConfirmation({ ...base, paymentUrl: bad });
      expect(html(), `expected ${bad} to be dropped`).not.toContain(bad);
      // With no usable link it must still tell them what happens next.
      expect(html()).toContain("payment details");
    }
  });

  it("attaches the QR png when one was rendered", async () => {
    await sendTicketConfirmation({ ...base, qrPng: Buffer.from("fake-png") });
    const attachments = sent[0].attachments as { filename: string; content: string }[];
    expect(attachments).toHaveLength(1);
    expect(attachments[0].filename).toBe("tsakani-ticket-TS-1A2B3C4D.png");
    expect(attachments[0].content).toBe(Buffer.from("fake-png").toString("base64"));
  });

  it("does not double-escape the CTA label", async () => {
    // button() escapes its label, so passing a pre-encoded "&amp;" produced
    // "&amp;amp;" and the button literally read "View your ticket &amp; QR code"
    // — entity noise on the one email whose job is to look legitimate.
    await sendTicketConfirmation(base);
    expect(html()).not.toContain("&amp;amp;");
    expect(html()).toContain("View your ticket &amp; QR code");
  });

  it("sends without an attachment when the QR could not be rendered", async () => {
    await sendTicketConfirmation({ ...base, qrPng: null });
    expect(sent[0].attachments).toBeUndefined();
    expect(html()).toContain("Show it at the door");
  });
});

describe("newsletter welcome email", () => {
  const welcome = {
    to: "reader@example.com",
    consentEvents: true,
    consentMerch: false,
    unsubscribeUrl: "https://tsakanisessions.co.za/unsubscribe?token=abc",
    listUnsubscribeUrl: "https://tsakanisessions.co.za/api/newsletter/unsubscribe?token=abc",
  };

  it("shows the way out in the body, not just the headers", async () => {
    await sendNewsletterWelcome(welcome);
    expect(html()).toContain(welcome.unsubscribeUrl);
    expect(html()).toContain("unsubscribe here");
  });

  it("points one-click unsubscribe at the endpoint, not the confirmation page", async () => {
    await sendNewsletterWelcome(welcome);
    const headers = sent[0].headers as Record<string, string>;
    // The page asks before acting, so it must never be the one-click target —
    // a client POSTing there would get HTML and the person would stay subscribed.
    expect(headers["List-Unsubscribe"]).toBe(`<${welcome.listUnsubscribeUrl}>`);
    expect(headers["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
  });

  it("names only the topics that were actually consented to", async () => {
    await sendNewsletterWelcome(welcome);
    expect(html()).toContain("upcoming events");
    expect(html()).not.toContain("merch drops");

    sent.length = 0;
    await sendNewsletterWelcome({ ...welcome, consentMerch: true });
    expect(html()).toContain("upcoming events and new merch drops");
  });
});

describe("ticketUrl", () => {
  it("builds an absolute link to the buyer's copy", () => {
    expect(ticketUrl("abc-123")).toBe("https://tsakanisessions.co.za/ticket/abc-123");
  });

  it("does not double the slash when the site url has a trailing one", () => {
    expect(ticketUrl("abc", "https://example.com/")).toBe("https://example.com/ticket/abc");
  });
});
