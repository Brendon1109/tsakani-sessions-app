import { Resend } from "resend";
import { SITE_URL } from "@/lib/seo";

const FROM = process.env.RESEND_FROM_EMAIL || "Tsakani Sessions <onboarding@resend.dev>";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "tsakanisessions@gmail.com";

/**
 * Where a reply to one of our emails should actually land.
 *
 * We send from the sending domain, which has no MX record — Resend's "Enable
 * Receiving" is deliberately off, because switching it on would claim the root
 * MX and block ever putting real mailboxes on the domain. Without this header a
 * buyer who hits Reply on their ticket confirmation gets a bounce, on the one
 * email whose whole job is to make them feel looked after.
 *
 * ADMIN_EMAIL is a real inbox someone reads, so it is the honest answer.
 */
const REPLY_TO = process.env.REPLY_TO_EMAIL || ADMIN_EMAIL;
const WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "27769961477";

let warnedMissingKey = false;

function getClient() {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    if (!warnedMissingKey) {
      console.warn(
        "[email] RESEND_API_KEY is not set — order confirmations and admin alerts will be skipped. Set it in your environment to enable transactional email."
      );
      warnedMissingKey = true;
    }
    return null;
  }
  return new Resend(key);
}

function siteUrl(): string {
  return SITE_URL.replace(/\/+$/, "");
}

/**
 * Everything a person typed goes through here before it reaches an email body.
 *
 * Names, event titles and payment notes are all attacker-reachable — a buyer
 * types their own name, and the admin-written payment note is free text. Without
 * this, a name of `<img src=x onerror=...>` lands as live markup in the inbox of
 * whoever opens it, including the team reading the admin alert.
 */
function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Only http(s) links are allowed to become an href.
 *
 * payment_url is admin-editable, and an admin account that got taken over could
 * otherwise put `javascript:` or `data:` in front of every buyer. Anything that
 * is not a plain web link is dropped rather than rendered.
 */
function safeUrl(value: unknown): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

const GOLD = "#ffd700";
const INK = "#0a0a0a";
const PANEL = "#141414";
const MUTED = "#9a9a9a";

/**
 * One shell for every email we send, so a confirmation looks like it came from
 * the same people as the newsletter.
 *
 * Built out of tables with inline styles rather than the flexbox the site uses.
 * Outlook renders through Word's engine and drops most modern CSS, and a ticket
 * that arrives as an unstyled wall of text undoes the point of sending it.
 */
function shell(opts: { preheader: string; body: string; footerNote?: string }): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark light">
</head>
<body style="margin:0;padding:0;background:${INK};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;font-size:1px;line-height:1px">${esc(opts.preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${INK};padding:24px 12px">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:${PANEL};border-radius:16px;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">
          <tr>
            <td style="padding:22px 28px 0;text-align:center">
              <div style="font-size:13px;letter-spacing:3px;text-transform:uppercase;color:${GOLD};font-weight:700">Tsakani Sessions</div>
            </td>
          </tr>
          <tr><td style="padding:0 28px 28px">${opts.body}</td></tr>
          <tr>
            <td style="padding:18px 28px 26px;border-top:1px solid #262626;text-align:center">
              ${opts.footerNote ? `<p style="margin:0 0 10px;font-size:12px;line-height:1.6;color:${MUTED}">${opts.footerNote}</p>` : ""}
              <p style="margin:0;font-size:12px;line-height:1.7;color:#6d6d6d">
                Tsakani Sessions &middot; Cape Town<br>
                Questions? WhatsApp us on
                <a href="https://wa.me/${esc(WHATSAPP_NUMBER)}" style="color:${GOLD};text-decoration:none">+27 76 996 1477</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function button(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto"><tr>
    <td style="background:${GOLD};border-radius:999px">
      <a href="${esc(href)}" style="display:inline-block;padding:13px 30px;font-size:15px;font-weight:700;color:#000;text-decoration:none">${esc(label)}</a>
    </td></tr></table>`;
}

/** Turns admin-written free text into paragraphs without letting markup through. */
function paragraphs(text: string, color: string): string {
  return esc(text)
    .split(/\n{2,}/)
    .map(
      (block) =>
        `<p style="margin:0 0 10px;font-size:14px;line-height:1.65;color:${color}">${block.replace(/\n/g, "<br>")}</p>`
    )
    .join("");
}

// ── Tickets ────────────────────────────────────────────────

export interface TicketConfirmationData {
  to: string;
  buyerName: string;
  orderRef: string;
  qrCode: string;
  ticketName: string;
  quantity: number;
  totalZar: number;
  eventTitle: string;
  eventDateLabel: string;
  venueName?: string | null;
  venueAddress?: string | null;
  paymentUrl?: string | null;
  paymentNote?: string | null;
  ticketUrl: string;
  qrPng?: Buffer | null;
}

/**
 * The email that replaces "you are now in a WhatsApp chat with a stranger".
 *
 * A free ticket and a paid one are genuinely different messages, not the same
 * message with a price of zero. A free ticket is already yours and says nothing
 * about money; a paid one is held, and its whole job is to tell you how to
 * finish paying. Mixing them is how you end up asking someone to pay R0.
 */
export async function sendTicketConfirmation(data: TicketConfirmationData): Promise<boolean> {
  const resend = getClient();
  if (!resend || !data.to) return false;

  const isFree = data.totalZar <= 0;
  const payUrl = isFree ? null : safeUrl(data.paymentUrl);
  const where = [data.venueName, data.venueAddress].filter(Boolean).join(", ");

  const detailRow = (label: string, value: string) =>
    `<tr>
      <td style="padding:7px 0;font-size:13px;color:${MUTED};white-space:nowrap">${esc(label)}</td>
      <td style="padding:7px 0 7px 16px;font-size:14px;color:#fff;text-align:right;font-weight:600">${esc(value)}</td>
    </tr>`;

  const paymentBlock = isFree
    ? `<div style="margin:22px 0 0;padding:16px 18px;background:rgba(255,215,0,0.07);border:1px solid rgba(255,215,0,0.25);border-radius:12px">
         <p style="margin:0;font-size:14px;line-height:1.65;color:#e8e8e8">
           <strong style="color:${GOLD}">Nothing to pay.</strong> This one is on us — just bring this ticket to the door.
         </p>
       </div>`
    : `<div style="margin:22px 0 0;padding:16px 18px;background:rgba(255,215,0,0.07);border:1px solid rgba(255,215,0,0.25);border-radius:12px">
         <p style="margin:0 0 ${data.paymentNote || payUrl ? "10px" : "0"};font-size:14px;line-height:1.65;color:#e8e8e8">
           <strong style="color:${GOLD}">Your spot is held.</strong> It becomes a confirmed ticket once payment lands.
         </p>
         ${data.paymentNote ? paragraphs(data.paymentNote, "#cfcfcf") : ""}
         ${payUrl ? `<div style="margin-top:14px">${button(payUrl, `Pay R${data.totalZar.toLocaleString("en-ZA")} now`)}</div>` : ""}
         ${
           !payUrl && !data.paymentNote
             ? `<p style="margin:0;font-size:14px;line-height:1.65;color:#cfcfcf">We'll be in touch shortly with payment details. Quote your order number, <strong style="color:#fff">${esc(data.orderRef)}</strong>.</p>`
             : ""
         }
       </div>`;

  const body = `
    <h1 style="margin:22px 0 6px;font-size:24px;line-height:1.3;color:#fff;font-weight:700">
      ${isFree ? "You're on the list" : "We've got you"}, ${esc(data.buyerName.split(" ")[0])}.
    </h1>
    <p style="margin:0 0 22px;font-size:15px;line-height:1.65;color:#b8b8b8">
      ${isFree ? "Your free ticket to" : "Your ticket to"} <strong style="color:#fff">${esc(data.eventTitle)}</strong> is booked. Here's everything you need.
    </p>

    <div style="background:#0d0d0d;border:1px solid #262626;border-radius:14px;padding:18px 20px">
      <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${MUTED}">Order number</div>
      <div style="font-size:26px;letter-spacing:2px;color:${GOLD};font-weight:700;margin-top:3px">${esc(data.orderRef)}</div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:14px;border-top:1px solid #262626">
        ${detailRow("Event", data.eventTitle)}
        ${detailRow("When", data.eventDateLabel)}
        ${where ? detailRow("Where", where) : ""}
        ${detailRow("Ticket", `${data.quantity} x ${data.ticketName}`)}
        ${detailRow("Total", isFree ? "Free" : `R${data.totalZar.toLocaleString("en-ZA")}`)}
      </table>
    </div>

    ${paymentBlock}

    <div style="margin:26px 0 0;text-align:center">
      ${/* Plain text — button() escapes the label, so a pre-encoded &amp; would double-encode. */ ""}
      ${button(data.ticketUrl, "View your ticket & QR code")}
      <p style="margin:12px 0 0;font-size:12px;line-height:1.6;color:${MUTED}">
        ${data.qrPng ? "Your QR code is attached to this email too. " : ""}Show it at the door — save the link or screenshot the code.
      </p>
    </div>
  `;

  try {
    await resend.emails.send({
      from: FROM,
      to: data.to,
      subject: `${data.orderRef} — your ticket to ${data.eventTitle}`,
      replyTo: REPLY_TO,
      html: shell({
        preheader: `Order ${data.orderRef} · ${data.quantity} x ${data.ticketName} · ${data.eventDateLabel}`,
        body,
        footerNote: "Keep this email — it's your proof of booking.",
      }),
      attachments: data.qrPng
        ? [
            {
              // Resend takes base64 for attachment content over the HTTP API.
              filename: `tsakani-ticket-${data.orderRef}.png`,
              content: data.qrPng.toString("base64"),
            },
          ]
        : undefined,
    });
    return true;
  } catch (err) {
    console.error("[email] ticket confirmation failed:", err);
    return false;
  }
}

/**
 * Sent when the team marks a held order as paid.
 *
 * Without this, the buyer's last word from us says "awaiting payment" forever,
 * even after they have paid — which is exactly the uncertainty that made people
 * uncomfortable in the first place. The reservation email opens the loop; this
 * one closes it.
 */
export async function sendTicketConfirmedEmail(data: {
  to: string;
  buyerName: string;
  orderRef: string;
  ticketName: string;
  quantity: number;
  totalZar: number;
  eventTitle: string;
  eventDateLabel: string;
  ticketUrl: string;
}): Promise<boolean> {
  const resend = getClient();
  if (!resend || !data.to) return false;

  const body = `
    <h1 style="margin:22px 0 6px;font-size:24px;line-height:1.3;color:#fff;font-weight:700">
      You're confirmed, ${esc(data.buyerName.split(" ")[0])}.
    </h1>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.65;color:#b8b8b8">
      ${data.totalZar > 0 ? "Payment received." : "You're all set."} Your ticket to
      <strong style="color:#fff">${esc(data.eventTitle)}</strong> is confirmed — see you there.
    </p>
    <div style="background:#0d0d0d;border:1px solid #262626;border-radius:14px;padding:18px 20px;text-align:center">
      <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${MUTED}">Order number</div>
      <div style="font-size:26px;letter-spacing:2px;color:${GOLD};font-weight:700;margin-top:3px">${esc(data.orderRef)}</div>
      <div style="margin-top:12px;padding-top:12px;border-top:1px solid #262626;font-size:14px;color:#e8e8e8">
        ${esc(data.quantity)} &times; ${esc(data.ticketName)}<br>
        <span style="color:${MUTED};font-size:13px">${esc(data.eventDateLabel)}</span>
      </div>
    </div>
    <div style="margin:26px 0 0;text-align:center">
      ${button(data.ticketUrl, "Open your ticket")}
      <p style="margin:12px 0 0;font-size:12px;line-height:1.6;color:${MUTED}">
        Show the QR code at the door.
      </p>
    </div>
  `;

  try {
    await resend.emails.send({
      from: FROM,
      to: data.to,
      subject: `Confirmed — ${data.orderRef} for ${data.eventTitle}`,
      replyTo: REPLY_TO,
      html: shell({
        preheader: `Your ticket to ${data.eventTitle} is confirmed.`,
        body,
        footerNote: "See you on the dancefloor.",
      }),
    });
    return true;
  } catch (err) {
    console.error("[email] ticket confirmed email failed:", err);
    return false;
  }
}

// ── Newsletter ─────────────────────────────────────────────

/**
 * Confirms a signup and, in the same breath, shows the way out.
 *
 * The unsubscribe link is the point, not a footnote. Someone who can see how to
 * leave is far more relaxed about joining, and POPIA expects the opt-out to be
 * as easy as the opt-in. It also goes in the List-Unsubscribe header so Gmail
 * and Apple Mail can offer it natively, which keeps our domain out of the spam
 * folder when people leave through the client instead of the link.
 */
export async function sendNewsletterWelcome(data: {
  to: string;
  consentEvents: boolean;
  consentMerch: boolean;
  /** The page a human clicks. It asks before acting, so link scanners can't unsubscribe anyone. */
  unsubscribeUrl: string;
  /** The endpoint mail clients POST to for one-click. Must act immediately, per RFC 8058. */
  listUnsubscribeUrl: string;
}): Promise<boolean> {
  const resend = getClient();
  if (!resend || !data.to) return false;

  const topics = [
    data.consentEvents ? "upcoming events" : null,
    data.consentMerch ? "new merch drops" : null,
  ].filter(Boolean) as string[];
  const topicLine =
    topics.length === 2 ? `${topics[0]} and ${topics[1]}` : topics[0] || "news from us";

  const body = `
    <h1 style="margin:22px 0 6px;font-size:24px;line-height:1.3;color:#fff;font-weight:700">
      You're on the list.
    </h1>
    <p style="margin:0 0 18px;font-size:15px;line-height:1.65;color:#b8b8b8">
      Thanks for subscribing to Tsakani Sessions with
      <strong style="color:#fff">${esc(data.to)}</strong>.
      We'll email you about <strong style="color:${GOLD}">${esc(topicLine)}</strong> — and nothing else.
    </p>
    <p style="margin:0 0 22px;font-size:15px;line-height:1.65;color:#b8b8b8">
      We keep it rare and worth opening. No daily noise.
    </p>
    ${siteUrl() ? `<div style="margin:24px 0;text-align:center">${button(`${siteUrl()}/events`, "See what's coming up")}</div>` : ""}
    <div style="margin:24px 0 0;padding:15px 18px;background:#0d0d0d;border:1px solid #262626;border-radius:12px">
      <p style="margin:0;font-size:13px;line-height:1.65;color:${MUTED}">
        Changed your mind? No hard feelings —
        <a href="${esc(data.unsubscribeUrl)}" style="color:${GOLD};text-decoration:underline">unsubscribe here</a>.
        It takes one click and we won't email you again.
      </p>
    </div>
  `;

  try {
    await resend.emails.send({
      from: FROM,
      to: data.to,
      subject: "You're subscribed to Tsakani Sessions",
      replyTo: REPLY_TO,
      html: shell({
        preheader: `You're subscribed for ${topicLine}. Unsubscribe any time.`,
        body,
      }),
      headers: {
        "List-Unsubscribe": `<${data.listUnsubscribeUrl}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    });
    return true;
  } catch (err) {
    console.error("[email] newsletter welcome failed:", err);
    return false;
  }
}

export async function sendUnsubscribeConfirmation(to: string): Promise<boolean> {
  const resend = getClient();
  if (!resend || !to) return false;

  const body = `
    <h1 style="margin:22px 0 6px;font-size:22px;line-height:1.3;color:#fff;font-weight:700">
      You're unsubscribed.
    </h1>
    <p style="margin:0 0 18px;font-size:15px;line-height:1.65;color:#b8b8b8">
      We've removed <strong style="color:#fff">${esc(to)}</strong> from the Tsakani Sessions list.
      This is the last email you'll get from us.
    </p>
    <p style="margin:0;font-size:15px;line-height:1.65;color:#b8b8b8">
      Thanks for the time you gave us. The door stays open if you ever want back in.
    </p>
  `;

  try {
    await resend.emails.send({
      from: FROM,
      to,
      subject: "You've been unsubscribed",
      replyTo: REPLY_TO,
      html: shell({ preheader: "You've been removed from the Tsakani Sessions list.", body }),
    });
    return true;
  } catch (err) {
    console.error("[email] unsubscribe confirmation failed:", err);
    return false;
  }
}

// ── Merch ──────────────────────────────────────────────────

/**
 * Bank details for an EFT order. Null when the buyer chose WhatsApp, or when
 * EFT is switched off in admin, and in that case no payment panel is rendered
 * at all rather than an empty one.
 */
export interface EftDetails {
  account_holder: string | null;
  bank_name: string | null;
  account_number: string | null;
  branch_code: string | null;
  account_type: string | null;
  payment_email: string | null;
  eft_instructions: string | null;
  reference: string;
}

export async function sendOrderConfirmation(data: {
  to: string;
  customerName: string;
  items: { name: string; size: string; color: string; qty: number; price: number }[];
  total: number;
  orderId: string;
  reference?: string | null;
  eft?: EftDetails | null;
  /** Ready-to-click card payment link, already carrying the locked amount. */
  paystackUrl?: string | null;
  paystackNote?: string | null;
}): Promise<boolean> {
  const resend = getClient();
  if (!resend || !data.to) return false;

  const itemRows = data.items
    .map((it) => {
      const variant = [it.size, it.color].filter(Boolean).join(", ");
      return `<tr>
           <td style="padding:9px 0;border-bottom:1px solid #262626;font-size:14px;color:#e8e8e8">${esc(it.name)}${variant ? ` <span style="color:${MUTED}">(${esc(variant)})</span>` : ""} <span style="color:${MUTED}">&times;${esc(it.qty)}</span></td>
           <td style="padding:9px 0;border-bottom:1px solid #262626;font-size:14px;color:#fff;text-align:right;white-space:nowrap">R${(it.price * it.qty).toLocaleString("en-ZA")}</td>
         </tr>`;
    })
    .join("");

  const eft = data.eft;
  const bankRow = (label: string, value: string | null | undefined) =>
    value
      ? `<tr>
           <td style="padding:5px 0;font-size:13px;color:${MUTED}">${esc(label)}</td>
           <td style="padding:5px 0;font-size:14px;color:#fff;text-align:right;font-weight:600">${esc(value)}</td>
         </tr>`
      : "";

  const eftPanel = eft
    ? `
    <div style="background:#0d0d0d;border:1px solid ${GOLD}55;border-radius:14px;padding:16px 20px;margin-top:16px">
      <p style="margin:0 0 12px;font-size:15px;font-weight:700;color:${GOLD}">Pay by EFT</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        ${bankRow("Account holder", eft.account_holder)}
        ${bankRow("Bank", eft.bank_name)}
        ${bankRow("Account number", eft.account_number)}
        ${bankRow("Branch code", eft.branch_code)}
        ${bankRow("Account type", eft.account_type)}
        ${bankRow("Reference", eft.reference)}
      </table>
      <p style="margin:14px 0 0;font-size:13px;line-height:1.6;color:#b8b8b8">
        Use <strong style="color:#fff">${esc(eft.reference)}</strong> as your payment reference so we can match your payment to this order.
      </p>
      ${
        eft.payment_email
          ? `<p style="margin:8px 0 0;font-size:13px;line-height:1.6;color:#b8b8b8">Send proof of payment to <a href="mailto:${esc(eft.payment_email)}" style="color:${GOLD}">${esc(eft.payment_email)}</a>.</p>`
          : ""
      }
      ${
        eft.eft_instructions
          ? `<p style="margin:8px 0 0;font-size:13px;line-height:1.6;color:#b8b8b8">${esc(eft.eft_instructions)}</p>`
          : ""
      }
    </div>`
    : "";

  const payUrl = safeUrl(data.paystackUrl);
  const cardPanel = payUrl
    ? `
    <div style="background:#0d0d0d;border:1px solid ${GOLD}55;border-radius:14px;padding:16px 20px;margin-top:16px;text-align:center">
      <p style="margin:0 0 6px;font-size:15px;font-weight:700;color:${GOLD}">Pay by card</p>
      <p style="margin:0 0 14px;font-size:13px;line-height:1.6;color:#b8b8b8">
        Your reference is <strong style="color:#fff">${esc(data.reference || data.orderId)}</strong>. Enter it on the payment page so we can match your payment to this order.
      </p>
      <a href="${esc(payUrl)}" style="display:inline-block;background:${GOLD};color:#000;font-weight:700;font-size:15px;text-decoration:none;padding:12px 26px;border-radius:999px">Pay R${data.total.toLocaleString("en-ZA")} now</a>
      ${
        data.paystackNote
          ? `<p style="margin:14px 0 0;font-size:13px;line-height:1.6;color:#b8b8b8">${esc(data.paystackNote)}</p>`
          : ""
      }
    </div>`
    : "";

  const intro = payUrl
    ? "We've got it. Pay by card using the button below and we'll confirm as soon as it clears."
    : eft
    ? "We've got it. Pay by EFT using the details below and we'll confirm as soon as the payment reflects."
    : "We've got it. We'll confirm availability and payment with you shortly.";

  const body = `
    <h1 style="margin:22px 0 6px;font-size:23px;line-height:1.3;color:#fff;font-weight:700">
      Thanks for your order, ${esc(data.customerName.split(" ")[0])}.
    </h1>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.65;color:#b8b8b8">
      ${esc(intro)}
    </p>
    <div style="background:#0d0d0d;border:1px solid #262626;border-radius:14px;padding:16px 20px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        ${itemRows}
        <tr>
          <td style="padding:11px 0 0;font-size:15px;font-weight:700;color:#fff">Total</td>
          <td style="padding:11px 0 0;font-size:17px;font-weight:700;color:${GOLD};text-align:right">R${data.total.toLocaleString("en-ZA")}</td>
        </tr>
      </table>
      <p style="margin:14px 0 0;font-size:12px;color:${MUTED}">Order reference: ${esc(data.reference || data.orderId)}</p>
    </div>
    ${cardPanel}
    ${eftPanel}
  `;

  try {
    await resend.emails.send({
      from: FROM,
      to: data.to,
      subject: "Order confirmation — Tsakani Sessions",
      replyTo: REPLY_TO,
      html: shell({
        preheader: `We received your order (R${data.total.toLocaleString("en-ZA")}).`,
        body,
      }),
    });
    return true;
  } catch (err) {
    console.error("[email] order confirmation failed:", err);
    return false;
  }
}

// ── Admin ──────────────────────────────────────────────────

export async function sendAdminOrderAlert(data: {
  type: "merch" | "ticket" | "booking";
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
  summary: string;
  total?: number;
  orderId: string;
}): Promise<boolean> {
  const resend = getClient();
  if (!resend) return false;

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;background:${INK};color:#fff;padding:24px">
      <h2 style="color:${GOLD};margin:0 0 12px">New ${esc(data.type)} order</h2>
      <p style="margin:0 0 4px"><strong>${esc(data.customerName)}</strong></p>
      <p style="margin:0 0 12px;color:${MUTED}">Phone: ${esc(data.customerPhone)}${data.customerEmail ? ` &middot; Email: ${esc(data.customerEmail)}` : ""}</p>
      <pre style="background:${PANEL};padding:12px;border-radius:8px;white-space:pre-wrap;font-family:inherit;color:#e8e8e8">${esc(data.summary)}</pre>
      ${data.total ? `<p style="color:${GOLD};font-size:18px">Total: R${data.total.toLocaleString("en-ZA")}</p>` : ""}
      <p style="font-size:12px;color:#6d6d6d">Reference: ${esc(data.orderId)}</p>
    </div>
  `;

  try {
    await resend.emails.send({
      from: FROM,
      to: ADMIN_EMAIL,
      subject: `[${data.type.toUpperCase()}] New order from ${data.customerName}`,
      html,
      replyTo: data.customerEmail || undefined,
    });
    return true;
  } catch (err) {
    console.error("[email] admin alert failed:", err);
    return false;
  }
}

export function emailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
}
