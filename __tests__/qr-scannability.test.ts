import { describe, it, expect } from "vitest";
import QRCode from "qrcode";
import jsQR from "jsqr";
import { QR_COLORS } from "@/lib/qr-colors";

/**
 * The door scanner could not read the ticket page.
 *
 * QRCodeDisplay drew gold modules on near-black, which is an inverted QR code,
 * and the scanner ran jsQR with inversionAttempts "dontInvert". A guest's own
 * phone camera read the ticket fine — cameras try both polarities — so the
 * report that came back was "the code is fine, your app is broken", and it was
 * right. Every guest presenting the ticket page was unscannable; only the
 * emailed PNG, already dark-on-white for printing, worked.
 *
 * These tests decode real rendered pixels rather than asserting on hex strings,
 * because the thing that broke was not the colour values — it was whether a
 * decoder could read what those values produced.
 */

const URL = "https://tsakanisessions.co.za/ticket/6c010ade-a863-4b21-9f3e-5c8d0a1e2f77";

/**
 * Renders a QR to raw RGBA, the same shape jsQR gets from a canvas frame.
 * Deliberately not mocked: a fake bitmap would pass whatever we wrote.
 */
function renderRgba(dark: string, light: string, scale = 8, quiet = 4) {
  const qr = QRCode.create(URL, { errorCorrectionLevel: "M" });
  const size = qr.modules.size;
  const modules = qr.modules.data;
  const dim = (size + quiet * 2) * scale;
  const buf = new Uint8ClampedArray(dim * dim * 4);

  const rgb = (hex: string) => [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
  const on = rgb(dark);
  const off = rgb(light);

  for (let y = 0; y < dim; y++) {
    for (let x = 0; x < dim; x++) {
      const mx = Math.floor(x / scale) - quiet;
      const my = Math.floor(y / scale) - quiet;
      const isDark =
        mx >= 0 && my >= 0 && mx < size && my < size ? !!modules[my * size + mx] : false;
      const c = isDark ? on : off;
      const i = (y * dim + x) * 4;
      buf[i] = c[0];
      buf[i + 1] = c[1];
      buf[i + 2] = c[2];
      buf[i + 3] = 255;
    }
  }
  return { buf, dim };
}

function decode(
  dark: string,
  light: string,
  inversionAttempts: "dontInvert" | "attemptBoth"
): string | null {
  const { buf, dim } = renderRgba(dark, light);
  return jsQR(buf, dim, dim, { inversionAttempts })?.data ?? null;
}

describe("QR codes this app draws are actually scannable", () => {
  it("renders dark-on-light, so any decoder reads it without inversion", () => {
    // The regression itself. Had this been here, gold-on-dark would have failed
    // the moment it was written.
    expect(decode(QR_COLORS.dark, QR_COLORS.light, "dontInvert")).toBe(URL);
  });

  it("proves the old palette was the bug, not an unrelated change", () => {
    expect(decode("#ffd700", "#111111", "dontInvert")).toBeNull();
  });

  it("still reads tickets already sitting in inboxes and screenshots", () => {
    // Codes rendered before the fix keep working, which is why the scanner
    // attempts both polarities rather than relying on the new palette alone.
    expect(decode("#ffd700", "#111111", "attemptBoth")).toBe(URL);
  });

  it("reads the emailed PNG palette, which was always correct", () => {
    expect(decode("#000000", "#ffffff", "attemptBoth")).toBe(URL);
  });
});
