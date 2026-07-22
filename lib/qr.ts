import QRCode from "qrcode";
import { SITE_URL } from "@/lib/seo";

/**
 * Server-side QR rendering, for the copy that goes in the email.
 *
 * The browser already draws a QR on the confirmation screen via
 * components/QRCodeDisplay, but that canvas only exists while the tab is open.
 * A ticket has to survive the tab being closed, so the email carries its own
 * PNG rendered here.
 *
 * Colours are inverted from the on-screen version on purpose. On screen the QR
 * sits on the dark page and is drawn gold on near-black. In an email it becomes
 * an attachment the buyer may open in a photo viewer, print, or hold up in a
 * dark venue — dark-on-white is what scanners and printers handle reliably.
 */
export async function ticketQrPng(url: string): Promise<Buffer> {
  return QRCode.toBuffer(url, {
    type: "png",
    width: 600,
    margin: 2,
    errorCorrectionLevel: "M",
    color: {
      dark: "#000000",
      light: "#ffffff",
    },
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
