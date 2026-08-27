/**
 * Breazy Analytics, the collect core.
 *
 * Every site's collect route is a thin adapter over this. Three adapters exist
 * (Next.js, Astro, and a bare Worker fetch handler) and they must never grow
 * their own copies of the logic below, because the cookie rules here are the
 * difference between returning visitors working on an iPhone and not.
 *
 * ===========================================================================
 * WHY THE ROUTE LIVES ON EACH SITE RATHER THAN CENTRALLY
 * ===========================================================================
 *
 * Apple deletes anything a site's JavaScript stores on the device after seven
 * days without a return visit. WebKit scopes it precisely: ITP deletes "all
 * cookies created in JavaScript and all other script-writeable storage", the
 * named types being IndexedDB, LocalStorage, Media keys, SessionStorage and
 * Service Worker registrations.
 *
 * A cookie set by the site's OWN server, in an HTTP response, is in none of
 * those categories, and WebKit separately confirms cookies sit outside the
 * storage eviction policy entirely. That is the whole mechanism. A cookie from
 * a central analytics domain would be third party and Safari blocks those
 * outright, and a CNAME pointing at one is detected and capped back to seven
 * days. iOS is about 40 per cent of VibesMap's visitors.
 *
 * Two traps that break it, both silent:
 *
 *   Serving this from a different host, say analytics.example.com, loses the
 *   exemption even with no CNAME, because Safari caps cookies from a response
 *   whose server sits in a different /16 from the document. Keep it on the
 *   same host as the pages.
 *
 *   One shared collecting domain across many sites is what ITP classifies as a
 *   prevalent resource, after which "all website data is deleted for classified
 *   domains" that go 30 days without interaction, HttpOnly cookies included.
 *   Per site collection means none of our domains ever looks like a tracker.
 *
 * ===========================================================================
 * WHAT THE COOKIE HOLDS, AND WHY IT IS NOT AN IDENTIFIER
 * ===========================================================================
 *
 * A date and two numbers: { f: first seen, n: days visited, l: last seen }.
 * Two unrelated people with the same history carry byte for byte identical
 * cookies. The server turns it into a boolean plus a coarse band and stores
 * aggregate rows only, so no per person history exists to leak or to subpoena.
 *
 * That is what keeps this outside a consent gate. The UK regulator puts
 * "connecting a visitor ID to their site activity" and "retaining the
 * individual level information (after aggregating it)" back into consent
 * territory. Holding the memory on the visitor's device and only counts on
 * ours stays the right side of it.
 */

export interface CollectConfig {
  /** Site slug. Must appear in the Worker's SITES allowlist. */
  site: string;
  /** Per site HMAC salt. NEVER shared between sites, see the section 57 note below. */
  salt: string;
  /** Shared key the central Worker checks. */
  ingestSecret: string;
  /** Central Worker ingest URL. */
  endpoint: string;
  /**
   * A Cloudflare service binding to the collector Worker, where one is
   * available. **On Cloudflare this is not an optimisation, it is the only
   * thing that works.**
   *
   * Found while wiring the first site, 27 August 2026. A Worker cannot fetch
   * another Worker over its `*.workers.dev` hostname on the same account: the
   * edge short-circuits it and hands back a 404 that never reaches the target
   * at all. Confirmed by tailing both Workers at once, where the caller logged
   * a 404 and the collector logged nothing. It looks exactly like a routing
   * bug in your own code and it is not.
   *
   * A service binding calls the other Worker's fetch handler directly, with no
   * network hop, so it is also faster, costs no subrequest against the free
   * tier ceiling, and needs no shared secret because only a Worker that has
   * been granted the binding can call it at all.
   *
   * Sites not on the same Cloudflare account, meaning everything on Vercel,
   * use the HTTPS endpoint instead. That path works fine from outside, which
   * is why this trap stays hidden until the first Cloudflare site is wired.
   */
  binding?: { fetch(request: Request): Promise<Response> };
  /**
   * Which platform terminates the request. **Declared, never sniffed.**
   *
   * An earlier version worked this out by looking for `x-vercel-id`, which was
   * itself a spoof: Cloudflare does not strip that header, so a caller could
   * present it alongside a forged `x-real-ip` and hand a Worker any visitor
   * identity it liked. That value keys the rate limiter and feeds the counting
   * HMAC, so rotating it per request meant the limiter never fired while fake
   * unique visitors poured into a database shared with every other site. One
   * spoof traded for another.
   *
   * The site always knows what it is running on and the request never does, so
   * it is configuration. Each platform then trusts ONLY the header its own edge
   * guarantees, and every other candidate is ignored rather than ranked.
   *
   * Unset falls back to reading nothing but a literal connecting address, which
   * degrades to a shared rate limit bucket rather than to a forgeable one.
   */
  platform?: "vercel" | "cloudflare";
  /**
   * Returning versus new. Off for the two UK sites.
   *
   * The UK statistical purposes exception covers how a service is used, not who
   * uses it, and the regulator puts retaining individual level information
   * across aggregation cycles outside it. With this off nothing at all is
   * stored on the device, so the UK device storage rule is not engaged and the
   * question never arises.
   */
  returning?: boolean;
}

export interface EdgeHeaders {
  get(name: string): string | null;
}

/**
 * Per instance rate limit on the collect route.
 *
 * This endpoint is public and unauthenticated by necessity, and without a
 * limit it is an amplifier: one anonymous POST becomes one function
 * invocation, one call to the collector, and two database row writes against a
 * free tier shared by the whole estate. On Vercel's Hobby plan the penalty for
 * blowing the invocation ceiling is that the project is paused for thirty
 * days, which on a site selling tickets means the shop dark for a month.
 *
 * In memory and per instance, so it resets on deploy and does not see across
 * serverless instances. That is a real limitation and it is stated rather than
 * hidden. It still removes the single source flood, which is the case that
 * actually empties the budget. A shared store would cost a round trip on a
 * beacon that fires on every page view, which is the wrong trade here.
 */
const RATE_MAX = 60;
const RATE_WINDOW_MS = 60_000;
const hits = new Map<string, { n: number; until: number }>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  // Bound the map so a spray of forged addresses cannot grow it without limit.
  if (hits.size > 5000) hits.clear();
  const cur = hits.get(ip);
  if (!cur || now > cur.until) {
    hits.set(ip, { n: 1, until: now + RATE_WINDOW_MS });
    return false;
  }
  cur.n += 1;
  return cur.n > RATE_MAX;
}

const COOKIE = "_bza";
const OPT_OUT = "bz_optout";
const TWO_YEARS = 63072000;

interface VisitState { f: string; n: number; l: string }

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function b64encode(s: string): string {
  // btoa exists in Workers, Next edge and Node 16+. Kept in one place so an
  // adapter cannot substitute a subtly different encoding and break every
  // existing cookie in the field.
  return btoa(s);
}

function readState(raw: string | undefined): VisitState | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(atob(decodeURIComponent(raw)));
    if (typeof p?.f !== "string" || typeof p?.n !== "number") return null;
    return {
      f: p.f.slice(0, 10),
      n: Math.min(Math.max(0, Math.floor(p.n)), 9999),
      l: typeof p.l === "string" ? p.l.slice(0, 10) : p.f.slice(0, 10),
    };
  } catch {
    return null;
  }
}

function band(n: number): string {
  if (n <= 1) return "1";
  if (n === 2) return "2";
  if (n <= 5) return "3-5";
  if (n <= 15) return "6-15";
  return "16+";
}

/**
 * Redact anything in a path that could be a secret.
 *
 * Found on VenueOS, and it is the most dangerous thing this review turned up.
 * The beacon sends `location.pathname` as it stands, and VenueOS addresses a
 * patron's tab, order and reservation by an unguessable code IN THE URL, which
 * is the whole authentication for that patron. Unredacted, the analytics store
 * would have filled with live credentials, and the dashboard would have
 * displayed them in a page list.
 *
 * It is not a VenueOS problem. Every capability URL in the portfolio has this
 * shape: Tsakani's ticket and order links, any password reset, any share link,
 * any unsubscribe token. So the redaction belongs here, applied to every site,
 * rather than in one site's route where the next app repeats the mistake.
 *
 * Deliberately aggressive. A path segment that is long and mixes letters with
 * digits, a UUID, a long hex or base64ish run, or anything after a known
 * capability prefix, is replaced. Losing the distinction between two product
 * pages costs a little reporting detail. Storing one live token costs a
 * patron's order, and a page nobody can un-see it in.
 */
const CAPABILITY_PREFIX = /^(tab|vo|rsv|ord|tkt|inv|tok|key|sess|share|reset|confirm)[-_]/i;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LONG_HEX = /^[0-9a-f]{16,}$/i;
const MIXED_LONG = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z0-9_-]{12,}$/;

export function redactPath(pathname: string): string {
  const raw = (pathname || "/").slice(0, 512);
  let out = "";
  const parts = raw.split("/");
  for (let i = 0; i < parts.length; i++) {
    const seg = parts[i];
    if (!seg) { if (i > 0) out += "/"; continue; }
    // Checked per dot separated part too. VenueOS signs a table QR as
    // `{code}.{sig}`, and the dot falls outside the anchored character class,
    // so the whole thing sailed through as ordinary text. It cannot reach here
    // today because that route redirects before a document exists, but it would
    // the day anyone puts it in an href, and that is not a safe thing to leave
    // resting on a routing detail.
    const parts2 = seg.split(".");
    const secret = parts2.some(
      (q) => CAPABILITY_PREFIX.test(q) || UUID.test(q) || LONG_HEX.test(q) || MIXED_LONG.test(q),
    );
    out += (i > 0 ? "/" : "") + (secret ? "[id]" : seg);
  }
  return out || "/";
}

export function readCookie(cookieHeader: string, name: string): string | undefined {
  const m = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return m ? m[1] : undefined;
}

/**
 * The daily counting value.
 *
 * HMAC over site, day, IP and user agent. It rotates at 00:00 UTC so nothing
 * joins across days, and the site name plus a per site salt means the same
 * person on two of Brendon's sites produces two unrelated values.
 *
 * That unlinkability is not a nicety. POPIA section 57 requires prior written
 * authorisation from the Information Regulator before processing a unique
 * identifier across separate responsible parties with the aim of linking them,
 * and you may not proceed while an application is pending. The client sites are
 * separate responsible parties. Sharing a salt between two sites would put the
 * whole system inside section 57.
 *
 * The IP is used to compute this and is never stored.
 */
export async function visitorDay(
  site: string, salt: string, ip: string, ua: string,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(salt),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC", key, new TextEncoder().encode(`${site}|${today()}|${ip}|${ua}`),
  );
  return Array.from(new Uint8Array(sig).slice(0, 12))
    .map((b) => b.toString(16).padStart(2, "0")).join("");
}

function safeDecode(v: string | null): string | null {
  if (!v) return null;
  try { return decodeURIComponent(v).slice(0, 80); } catch { return v.slice(0, 80); }
}

export interface CollectResult {
  /** Set-Cookie value, or null when nothing should be written to the device. */
  setCookie: string | null;
}

/**
 * Handle one beacon. Returns the cookie to set, if any.
 *
 * Never throws. A visitor must never see analytics fail, and the caller always
 * answers 204 regardless of what happened in here.
 */
export async function collect(
  body: any,
  headers: EdgeHeaders,
  cookieHeader: string,
  cfg: CollectConfig,
  waitUntil?: (p: Promise<unknown>) => void,
): Promise<CollectResult> {
  const none: CollectResult = { setCookie: null };

  // The objection check comes first, before anything is read or computed.
  // POPIA section 11(4) is absolute, with no compelling grounds override:
  // once someone objects, processing stops.
  if (readCookie(cookieHeader, OPT_OUT) === "1") return none;

  if (!body || (body.event !== "view" && body.event !== "leave")) return none;

  // Capped like every other field. It was the one unbounded input, it feeds
  // the HMAC below, and it is fully attacker controlled.
  const ua = (headers.get("user-agent") || "").slice(0, 512);

  // IP precedence, and the order matters for integrity rather than tidiness.
  //
  // `cf-connecting-ip` is written by Cloudflare's edge and is trustworthy on a
  // Worker. On Vercel it is not a platform header at all, so it arrives
  // straight from the client untouched, and it was being read FIRST. Since the
  // IP feeds visitorDay below, and every unique visitor figure counts distinct
  // on that, anyone could have minted unlimited fake visitors with a header in
  // a loop.
  //
  // Vercel overwrites `x-forwarded-for` itself specifically to prevent
  // spoofing, so where a Vercel request marker is present its headers win.
  const onVercel = cfg.platform === "vercel";
  const ip = (onVercel
    // Vercel overwrites x-forwarded-for itself specifically to prevent
    // spoofing, and documents x-real-ip as identical to it.
    ? headers.get("x-real-ip") || (headers.get("x-forwarded-for") || "").split(",")[0].trim()
    // On Cloudflare only cf-connecting-ip is written by the edge. The others
    // are caller supplied and are deliberately not consulted at all.
    : cfg.platform === "cloudflare"
      ? headers.get("cf-connecting-ip")
      : null
  ) || "0.0.0.0";

  if (rateLimited(ip)) return none;

  const day = today();
  const wantReturning = cfg.returning !== false;

  let isReturning = 0;
  // 'off' rather than '1', so a site that never measured returning visitors
  // does not read on the dashboard as one where every visitor was new.
  let visitBand = "off";
  let setCookie: string | null = null;

  if (wantReturning) {
    const prior = readState(readCookie(cookieHeader, COOKIE));
    let state: VisitState;
    if (!prior) {
      state = { f: day, n: 1, l: day };
    } else {
      // Distinct DAYS, not requests. Ten page views in one session is one
      // visit, and counting it as ten would make the metric meaningless.
      state = { f: prior.f, n: prior.n + (prior.l !== day ? 1 : 0), l: day };
      isReturning = prior.f !== day ? 1 : 0;
    }
    visitBand = band(state.n);

    // Only on a view. Rewriting it on every leave beacon costs bytes for nothing.
    if (body.event === "view") {
      setCookie =
        `${COOKIE}=${encodeURIComponent(b64encode(JSON.stringify(state)))}; Path=/; ` +
        `Max-Age=${TWO_YEARS}; HttpOnly; Secure; SameSite=Lax`;
    }
  }

  const payload = {
    site: cfg.site,
    event: body.event,
    path: redactPath(typeof body.path === "string" ? body.path : "/"),
    occurred_at: typeof body.occurred_at === "number" ? body.occurred_at : Date.now(),
    dwell_ms: typeof body.dwell_ms === "number" ? body.dwell_ms : null,
    visitor_day: await visitorDay(cfg.site, cfg.salt, ip, ua),
    is_returning: isReturning,
    visit_band: visitBand,
    ua,
    // Coarse location from edge headers. Never a raw IP. City level is named as
    // acceptable in the UK regulator's own guidance.
    // Same precedence rule as the IP above, for the same reason.
    // Same rule as the IP: only the header this platform's edge writes.
    country: onVercel ? headers.get("x-vercel-ip-country") : headers.get("cf-ipcountry"),
    region: onVercel ? headers.get("x-vercel-ip-country-region") : headers.get("cf-region-code"),
    city: safeDecode(onVercel ? headers.get("x-vercel-ip-city") : headers.get("cf-ipcity")),
    ref_host: typeof body.ref === "string" ? body.ref.slice(0, 255) : null,
  };

  // Server to server, so no browser CORS and the site's own CSP is untouched.
  //
  // The failure handling here is deliberate and was learned the hard way while
  // wiring the first site. A rejected fetch is a network error, but a 401 or a
  // 500 from the collector RESOLVES normally, so a bare .catch() swallows it
  // and every event vanishes while the site looks perfectly healthy. That is
  // the exact silent failure this system exists to make impossible, so the
  // status is checked and anything unexpected is logged where `wrangler tail`
  // will show it. Still never thrown: a visitor must not pay for our outage.
  const req = new Request(cfg.endpoint, {
    method: "POST",
    headers: { "content-type": "application/json", "x-bz-key": cfg.ingestSecret },
    body: JSON.stringify(payload),
  });

  // A service binding where there is one, plain fetch otherwise. See the
  // `binding` note above for why this is not merely a fast path on Cloudflare.
  // Wrapped in Promise.resolve().then so a SYNCHRONOUS throw becomes a
  // rejection. Wrangler's local service binding stub throws rather than
  // rejecting, and a bare `binding.fetch(req).then(...)` lets that escape the
  // catch entirely, which took out the cookie and lost the event while logging
  // nothing at all. Exactly the silent failure this system exists to prevent.
  const send = Promise.resolve()
    .then(() => (cfg.binding ? cfg.binding.fetch(req) : fetch(req, { signal: AbortSignal.timeout(2500) })))
    .then((r) => {
      if (!r.ok) console.warn(`bz: collector returned ${r.status} for ${cfg.site}`);
    })
    .catch((e) => {
      console.warn(`bz: forward failed for ${cfg.site}: ${e && e.message ? e.message : e}`);
    });

  // Where the platform offers it, let the forward finish after the response has
  // already gone back to the visitor. A dropped event beats a slow page.
  if (waitUntil) waitUntil(send); else await send;

  return { setCookie };
}

/** The opt out. Wired to a control on each site's privacy page. */
export function optOutCookies(): string[] {
  return [
    `${OPT_OUT}=1; Path=/; Max-Age=${TWO_YEARS}; Secure; SameSite=Lax`,
    `${COOKIE}=; Path=/; Max-Age=0; Secure; SameSite=Lax`,
  ];
}

/** Undo an opt out, so withdrawing consent is as easy as giving it. */
export function optInCookies(): string[] {
  return [`${OPT_OUT}=; Path=/; Max-Age=0; Secure; SameSite=Lax`];
}
