import QRCode from "qrcode";
import { SITE_URL } from "@/lib/seo";
import { QR_COLORS } from "@/lib/qr-colors";

/**
 * Server-side QR rendering, for the copy that goes in the email.
 *
 * The browser already draws a QR on the confirmation screen via
 * components/QRCodeDisplay, but that canvas only exists while the tab is open.
 * A ticket has to survive the tab being closed, so the email carries its own
 * PNG rendered here.
 *
 * This copy was always dark-on-white, and it was the only one that worked: when
 * the on-screen version was drawn gold-on-near-black it became an inverted
 * symbol that the door scanner could not read, so guests showing their ticket
 * page were unscannable while the same ticket from an inbox went straight
 * through. Both now share one palette. See lib/qr-colors.ts.
 */
export async function ticketQrPng(url: string): Promise<Buffer> {
  return QRCode.toBuffer(url, {
    type: "png",
    width: 600,
    margin: 2,
    errorCorrectionLevel: "M",
    color: { ...QR_COLORS },
  });
}

/**
 * The URL a ticket QR points at: the buyer's own copy of their ticket.
 *
 * Falls back to SITE_URL from lib/seo, which every other consumer of
 * NEXT_PUBLIC_SITE_URL in this repo already does. An empty base would be far
 * worse here than in a sitemap: it produces "/ticket/<uuid>", which is a dead
 * href in every mail client AND gets baked into the QR PNG as a bare string
 * that no phone camera can open. The ticket would be silently useless, with
 * nothing logged.
 */
export function ticketUrl(qrCode: string, siteUrl?: string): string {
  const base = (siteUrl || SITE_URL).replace(/\/+$/, "");
  return `${base}/ticket/${encodeURIComponent(qrCode)}`;
}
