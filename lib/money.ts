/**
 * Rand and cents.
 *
 * products.price_zar and orders.total_zar are integer CENTS. Every price the
 * admin types and every price a buyer reads is RAND. Getting that wrong by a
 * factor of a hundred is the single most expensive mistake this app can make,
 * so the conversion lives here, in one tested place, rather than as a scattering
 * of /100 and *100.
 *
 * Note the asymmetry already in the schema and kept on purpose: ticket_orders
 * stores RANDS, merch stores CENTS. These helpers are for merch.
 */

/** "450", "R450", "450.50" as typed in the admin form, to integer cents. */
export function randToCents(value: string): number | null {
  const cleaned = value.replace(/[^0-9.]/g, "");
  if (!cleaned) return null;
  // More than one decimal point is a typo, not a number.
  if ((cleaned.match(/\./g) || []).length > 1) return null;
  const asNumber = Number(cleaned);
  if (!Number.isFinite(asNumber) || asNumber < 0) return null;
  return Math.round(asNumber * 100);
}

/** Cents back to what the admin should see in the price box. */
export function centsToRand(cents: number): string {
  return cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2);
}

/** Cents to a display price, "R450" or "R450,50" in South African format. */
export function formatCents(cents: number): string {
  return `R${(cents / 100).toLocaleString("en-ZA", {
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}
