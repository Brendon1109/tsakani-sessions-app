import { Resend } from "resend";

const FROM = process.env.RESEND_FROM_EMAIL || "Tsakani Sessions <onboarding@resend.dev>";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "tsakanisessions@gmail.com";

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

export async function sendOrderConfirmation(data: {
  to: string;
  customerName: string;
  items: { name: string; size: string; color: string; qty: number; price: number }[];
  total: number;
  orderId: string;
}): Promise<boolean> {
  const resend = getClient();
  if (!resend || !data.to) return false;

  const itemRows = data.items
    .map(
      (it) =>
        `<tr><td style="padding:8px;border-bottom:1px solid #333">${it.name} (${it.size}, ${it.color}) x${it.qty}</td><td style="padding:8px;border-bottom:1px solid #333;text-align:right">R${it.price * it.qty}</td></tr>`
    )
    .join("");

  const html = `
    <div style="font-family:sans-serif;background:#000;color:#fff;padding:24px">
      <h2 style="color:#ffd700">Thanks for your order, ${data.customerName}!</h2>
      <p>We received your order and will confirm availability via WhatsApp shortly.</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0">
        ${itemRows}
        <tr><td style="padding:8px;font-weight:bold">Total</td><td style="padding:8px;font-weight:bold;text-align:right;color:#ffd700">R${data.total}</td></tr>
      </table>
      <p style="font-size:12px;color:#888">Order ID: ${data.orderId}</p>
      <p style="font-size:12px;color:#888">Tsakani Sessions · Cape Town · WhatsApp +27 76 996 1477</p>
    </div>
  `;

  try {
    await resend.emails.send({
      from: FROM,
      to: data.to,
      subject: `Order confirmation — Tsakani Sessions`,
      html,
    });
    return true;
  } catch (err) {
    console.error("Email failed:", err);
    return false;
  }
}

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
    <div style="font-family:sans-serif;background:#000;color:#fff;padding:24px">
      <h2 style="color:#ffd700">New ${data.type} order</h2>
      <p><strong>${data.customerName}</strong></p>
      <p>Phone: ${data.customerPhone}${data.customerEmail ? ` · Email: ${data.customerEmail}` : ""}</p>
      <pre style="background:#111;padding:12px;border-radius:8px;white-space:pre-wrap;font-family:inherit">${data.summary}</pre>
      ${data.total ? `<p style="color:#ffd700;font-size:18px">Total: R${data.total}</p>` : ""}
      <p style="font-size:12px;color:#888">ID: ${data.orderId}</p>
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
    console.error("Admin email failed:", err);
    return false;
  }
}

export function emailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
}
