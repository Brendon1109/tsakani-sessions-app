/**
 * Breazy Analytics, collect route for a Next.js App Router site.
 *
 * Drop in at `app/api/e/route.ts`. Set three env vars: BZ_SITE, BZ_SALT,
 * BZ_INGEST_SECRET. Optionally BZ_ENDPOINT to point at the central Worker.
 *
 * ===========================================================================
 * THIS SITE RUNS TWO ANALYTICS PIPELINES ON PURPOSE. DO NOT MERGE THEM.
 * ===========================================================================
 *
 * `/api/track` and `lib/analytics.ts` are the older, first party pipeline, and
 * this one is its descendant: Breazy Analytics was extracted from it. They are
 * not duplicates and neither one is dead code.
 *
 *   /api/track  knows the PRODUCT. Fifteen named events with a props bag, so it
 *               can answer which event sold tickets, which tee was viewed, and
 *               which booking form was abandoned. It cannot see any other site.
 *
 *   /api/e      knows the VISIT, and knows it across every site Brendon runs.
 *               Time actually on screen, returning versus new, and one place to
 *               compare this site against the rest. It carries no product
 *               detail at all and never will.
 *
 * Deleting either one loses something the other cannot answer. If a future
 * change looks like a tidy up that collapses them, it is a feature removal
 * wearing a refactor's clothes.
 *
 * The two share exactly one thing, and deliberately: the opt out. A visitor who
 * objects on /privacy stops BOTH. See `objected()` in `lib/analytics.ts`.
 *
 * ===========================================================================
 * THIS FILE IS WHY RETURNING VERSUS NEW WORKS ON AN IPHONE.
 * ===========================================================================
 *
 * Apple's tracking prevention deletes anything a site's JavaScript stores on
 * the device after seven days without a return visit. That covers localStorage
 * and any cookie written through document.cookie. So the usual way of
 * recognising a returning visitor stops working after a week on every iPhone,
 * and somebody coming back on day eight reads as brand new.
 *
 * The one mechanism it does not cap is a cookie set by the site's OWN server,
 * in an HTTP response, on the site's own domain. That is what this route does,
 * and it is the entire reason the collect endpoint lives on each site rather
 * than centrally. A cookie set by the central Worker would be third party and
 * Safari blocks those outright. Pointing a subdomain at the Worker by CNAME
 * does not help either: WebKit's CNAME cloaking defence detects exactly that
 * and caps the result back to seven days.
 *
 * Verified on webkit.org on 27 August 2026, read directly rather than taken
 * from a summary. WebKit's own wording scopes the sweep precisely: "ITP deletes
 * all cookies created in JavaScript and all other script-writeable storage
 * after 7 days of no user interaction with the website." The types it names are
 * IndexedDB, LocalStorage, Media keys, SessionStorage, and Service Worker
 * registrations and cache. A cookie set by a server response is in none of
 * those categories, and is separately confirmed outside the storage eviction
 * policy: "Other types like cookies and HTTP cache are currently not subject to
 * the policy below."
 *
 * On VibesMap, iOS is about 40 per cent of visitors. This is not an edge case.
 *
 * ---------------------------------------------------------------------------
 * KEEP THIS ROUTE ON THE SITE'S OWN HOST. IT IS NOT A STYLE PREFERENCE.
 * ---------------------------------------------------------------------------
 *
 * Two separate WebKit rules bite the moment this endpoint moves off the host
 * that serves the pages, and both fail silently.
 *
 *   1. Safari caps cookies at seven days when a subresource response comes
 *      from an IP sharing fewer than sixteen leading bits with the main
 *      document's IP, with no CNAME needed to trigger it. Serve this from
 *      `analytics.example.com` on a different provider and iOS quietly reverts
 *      to the seven day behaviour this whole design exists to escape. A same
 *      host path on the same infrastructure, which is what `/api/e` is, shares
 *      the document's IP and is clear.
 *
 *   2. A single shared domain embedded across fourteen sites is what ITP
 *      classifies as a prevalent resource. Once classified, a domain that goes
 *      thirty operating days without user interaction has ALL its cookies
 *      deleted, HttpOnly included. Per site collection means no domain of ours
 *      ever looks like a tracker, because none of them appears as a third
 *      party anywhere.
 *
 * If this ever needs to move, put it behind the same hostname that serves the
 * HTML, or set the cookie from middleware on the main document response, which
 * is exempt from rule 1 outright.
 *
 * ===========================================================================
 * WHAT THE COOKIE HOLDS, AND WHY IT IS NOT AN IDENTIFIER
 * ===========================================================================
 *
 * A date and a counter. `{ f: "2026-03-14", n: 7 }`. First seen, and how many
 * days they have visited on.
 *
 * There is no identifier in it. Two unrelated people who first visited on the
 * same day and have returned the same number of times carry byte for byte
 * identical cookies. Nothing on the server can tell them apart, and nothing is
 * stored that could later be joined into one person's history.
 *
 * That distinction is load bearing rather than cosmetic. The UK regulator puts
 * "connecting a visitor ID to their site activity" and "retaining the
 * individual level information after aggregating it" outside the analytics
 * exception and back into consent territory. Holding a date and a count on the
 * visitor's own device, and only ever a boolean on ours, stays the right side
 * of that line.
 */

const COOKIE = "_bza";
const OPT_OUT = "bz_optout";
const TWO_YEARS = 63072000;

interface VisitState {
  /** First seen, YYYY-MM-DD. */
  f: string;
  /** Distinct days seen, capped so the cookie cannot grow. */
  n: number;
  /** Last seen, YYYY-MM-DD. Lets us count days rather than requests. */
  l: string;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function readState(raw: string | undefined): VisitState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(atob(raw));
    if (typeof parsed?.f !== "string" || typeof parsed?.n !== "number") return null;
    return {
      f: parsed.f.slice(0, 10),
      n: Math.min(Math.max(0, Math.floor(parsed.n)), 9999),
      l: typeof parsed.l === "string" ? parsed.l.slice(0, 10) : parsed.f.slice(0, 10),
    };
  } catch {
    return null;
  }
}

function writeState(s: VisitState): string {
  return btoa(JSON.stringify(s));
}

/** Coarse bands rather than an exact count, because an exact one is sharper than the question needs. */
function band(n: number): string {
  if (n <= 1) return "1";
  if (n === 2) return "2";
  if (n <= 5) return "3-5";
  if (n <= 15) return "6-15";
  return "16+";
}

/**
 * The daily counting value.
 *
 * HMAC over site, day, IP and user agent. Two properties matter:
 *
 *   It rotates at 00:00 UTC, so nothing can be joined across days. That keeps
 *   the individual level data alive only inside a single aggregation window,
 *   which is what the UK guidance asks for.
 *
 *   The site name is inside the HMAC and each site carries its own salt, so the
 *   same person on two of Brendon's sites produces two unrelated values. POPIA
 *   section 57 needs prior Regulator authorisation before linking identifiers
 *   across separate responsible parties, and the four client sites are four
 *   separate responsible parties. Unlinkability here is a property of the
 *   arithmetic rather than a promise in a policy.
 *
 * The IP is used to compute this and is never stored anywhere.
 */
async function visitorDay(site: string, salt: string, ip: string, ua: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(salt),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${site}|${today()}|${ip}|${ua}`),
  );
  return Array.from(new Uint8Array(sig).slice(0, 12))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function POST(request: Request): Promise<Response> {
  // Always 204. A fire and forget beacon can do nothing useful with an error,
  // and a visitor must never see analytics fail.
  const ok = (headers?: HeadersInit) => new Response(null, { status: 204, headers });

  const site = process.env.BZ_SITE;
  const salt = process.env.BZ_SALT;
  const secret = process.env.BZ_INGEST_SECRET;
  const endpoint = process.env.BZ_ENDPOINT || "https://breazy-analytics.breazy.workers.dev/e";
  if (!site || !salt || !secret) return ok();

  const cookies = request.headers.get("cookie") || "";

  // The objection check comes first, before anything is read or computed.
  // POPIA section 11(4) is absolute: once someone objects there is no
  // balancing test to fall back on, processing simply stops.
  if (cookies.includes(`${OPT_OUT}=1`)) return ok();

  // Parsed as Record<string, unknown> rather than `any`. Every field is still
  // validated with a typeof at its use site exactly as before, so behaviour is
  // unchanged; this only stops the untyped value spreading. `any` trips this
  // repo's @typescript-eslint/no-explicit-any rule and CI runs lint.
  let body: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(await request.text());
    if (typeof parsed !== "object" || parsed === null) return ok();
    body = parsed as Record<string, unknown>;
  } catch {
    return ok();
  }

  const event = typeof body.event === "string" ? body.event : "";
  if (event !== "view" && event !== "leave") return ok();

  const ua = request.headers.get("user-agent") || "";
  const ip =
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-real-ip") ||
    (request.headers.get("x-forwarded-for") || "").split(",")[0].trim() ||
    "0.0.0.0";

  // ---------------------------------------------------------------------
  // Returning versus new.
  //
  // BZ_RETURNING=off disables it entirely: no cookie is read, none is set, and
  // nothing at all is stored on the visitor's device. Views, time on page and
  // daily visitor counts all still work, because none of those need memory
  // between days.
  //
  // That switch exists for the two UK sites. The UK statistical purposes
  // exception covers how a service is used, not who uses it, and the regulator
  // puts retaining individual level information across aggregation cycles back
  // into consent. Recognising a returning visitor is exactly that. With this
  // off, the site stores nothing on the device, so the UK device storage rule
  // is not engaged at all and no notice-plus-opt-out argument is even needed.
  //
  // The band is recorded as 'off' rather than defaulting to '1', because a
  // site that never measured returning visitors must not read on the dashboard
  // as a site where every visitor was new.
  // ---------------------------------------------------------------------
  const day = today();
  const returningEnabled = process.env.BZ_RETURNING !== "off";

  const headers = new Headers();
  let isReturning: 0 | 1 = 0;
  let visitBand = "off";

  if (returningEnabled) {
    const raw = cookies.match(new RegExp(`(?:^|; )${COOKIE}=([^;]+)`))?.[1];
    const prior = readState(raw ? decodeURIComponent(raw) : undefined);

    let state: VisitState;
    if (!prior) {
      state = { f: day, n: 1, l: day };
      isReturning = 0;
    } else {
      // Count distinct DAYS, not requests. Ten page views in one session is one
      // visit, and treating it as ten would make every metric here meaningless.
      const newDay = prior.l !== day;
      state = { f: prior.f, n: prior.n + (newDay ? 1 : 0), l: day };
      isReturning = prior.f !== day ? 1 : 0;
    }
    visitBand = band(state.n);

    // Only refresh the cookie on a view. Doing it on every leave beacon too
    // would rewrite it several times per page for no gain.
    if (event === "view") {
      headers.append(
        "set-cookie",
        `${COOKIE}=${encodeURIComponent(writeState(state))}; Path=/; Max-Age=${TWO_YEARS}; ` +
          `HttpOnly; Secure; SameSite=Lax`,
      );
    }
  }

  const payload = {
    site,
    event,
    path: typeof body.path === "string" ? body.path.slice(0, 512) : "/",
    occurred_at: typeof body.occurred_at === "number" ? body.occurred_at : Date.now(),
    dwell_ms: typeof body.dwell_ms === "number" ? body.dwell_ms : null,
    visitor_day: await visitorDay(site, salt, ip, ua),
    is_returning: isReturning,
    visit_band: visitBand,
    ua,
    // Coarse location from edge headers. Never a raw IP. City level is named
    // as acceptable in the UK regulator's own guidance.
    country: request.headers.get("x-vercel-ip-country") || request.headers.get("cf-ipcountry"),
    region: request.headers.get("x-vercel-ip-country-region"),
    city: safeDecode(request.headers.get("x-vercel-ip-city")),
    ref_host: typeof body.ref === "string" ? body.ref.slice(0, 255) : null,
  };

  // Server to server, so no browser CORS is involved and the site's own
  // Content-Security-Policy is untouched. Deliberately not awaited beyond a
  // short timeout: a slow central Worker must never hold a visitor's request.
  try {
    await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json", "x-bz-key": secret },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(2000),
    });
  } catch {
    // A dropped event is strictly better than a slow page.
  }

  return ok(headers);
}

function safeDecode(v: string | null): string | null {
  if (!v) return null;
  try {
    return decodeURIComponent(v).slice(0, 80);
  } catch {
    return v.slice(0, 80);
  }
}

/** The opt out control. A site links this from its privacy page. */
export async function DELETE(): Promise<Response> {
  const headers = new Headers();
  headers.append("set-cookie", `${OPT_OUT}=1; Path=/; Max-Age=${TWO_YEARS}; Secure; SameSite=Lax`);
  headers.append("set-cookie", `${COOKIE}=; Path=/; Max-Age=0; Secure; SameSite=Lax`);
  return new Response(JSON.stringify({ opted_out: true }), {
    status: 200,
    headers: (headers.set("content-type", "application/json"), headers),
  });
}

/**
 * The other half of the control: turning counting back on.
 *
 * Withdrawing an objection has to be as easy as making it, otherwise the opt
 * out is a one way door and the page has to tell the visitor so. It clears the
 * objection cookie and nothing else, so the next view starts a fresh `_bza`
 * with today as its first seen date. The old visit history is not restored,
 * because it was deleted when they objected and we do not keep a copy.
 *
 * Not a POST, because POST on this route is the ingest path.
 */
export async function PUT(): Promise<Response> {
  const headers = new Headers({ "content-type": "application/json" });
  headers.append("set-cookie", `${OPT_OUT}=; Path=/; Max-Age=0; Secure; SameSite=Lax`);
  return new Response(JSON.stringify({ opted_out: false }), { status: 200, headers });
}
