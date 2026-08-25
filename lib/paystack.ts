/**
 * Building the link a buyer is sent to for card payment.
 *
 * This is the hosted payment page route, not the API integration. Paystack
 * payment pages accept exactly four query parameters, per their own support
 * article on pre-filling: email, first_name, last_name and amount. There is no
 * reference parameter and no metadata, which is why an order paid this way
 * still has to be matched by hand.
 *
 * `read-only` locks the fields we pre-fill so a buyer cannot edit the amount on
 * the way through. That is the whole reason we build the URL server side rather
 * than letting the browser assemble it.
 */

/**
 * Amount is sent in CENTS, the same subunit the rest of this app stores and the
 * convention Paystack uses everywhere else in its API.
 *
 * It is worth being blunt about this: their pre-fill article does not spell the
 * unit out, and being wrong here is wrong by a factor of a hundred. That is why
 * /admin/store-settings has a test link that opens the page at a known R123.45,
 * and why the Paystack toggle is off until somebody has actually looked at it.
 */
export function buildPaystackUrl(opts: {
  baseUrl: string;
  amountCents: number;
  email: string;
  customerName?: string | null;
}): string | null {
  let url: URL;
  try {
    url = new URL(opts.baseUrl);
  } catch {
    return null;
  }
  if (!isPaystackHost(url)) return null;

  const [first, ...rest] = (opts.customerName || "").trim().split(/\s+/);

  url.searchParams.set("amount", String(Math.round(opts.amountCents)));
  url.searchParams.set("email", opts.email);
  if (first) url.searchParams.set("first_name", first);
  if (rest.length > 0) url.searchParams.set("last_name", rest.join(" "));
  // Note the hyphen. It is Paystack's parameter name, not a typo.
  url.searchParams.set("read-only", "email,amount");

  return url.toString();
}

/**
 * The link field is admin-editable and it is where we send people to type in
 * card details, so it is held to a tighter standard than an ordinary URL field.
 * An admin account that got taken over could otherwise point every buyer at a
 * convincing card-harvesting page. Only Paystack's own hosts are accepted.
 */
export function isPaystackHost(url: URL): boolean {
  if (url.protocol !== "https:") return false;
  const host = url.hostname.toLowerCase();
  return (
    host === "paystack.com" ||
    host === "paystack.shop" ||
    host.endsWith(".paystack.com") ||
    host.endsWith(".paystack.shop")
  );
}

/** Same check from a raw string, for validating what an admin pasted. */
export function isPaystackUrl(value: string): boolean {
  try {
    return isPaystackHost(new URL(value.trim()));
  } catch {
    return false;
  }
}
