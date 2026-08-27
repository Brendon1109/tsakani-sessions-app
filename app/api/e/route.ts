/**
 * Collect route for a Next.js App Router site.
 *
 * Drop in at `app/api/e/route.ts` and copy `core.ts` beside it as
 * `app/api/e/core.ts`. Covers every Vercel Next site and the Next on Workers
 * ones (VenueOS, no-q).
 *
 * Env: BZ_SITE, BZ_SALT, BZ_INGEST_SECRET, BZ_ENDPOINT, and BZ_RETURNING=off
 * on the two UK sites.
 *
 * All the reasoning lives in core.ts. This file is plumbing only, deliberately,
 * so the cookie rules cannot drift between the three adapters.
 */

import { collect, optOutCookies, optInCookies } from "./core";

export const dynamic = "force-dynamic";

function cfg() {
  const site = process.env.BZ_SITE;
  const salt = process.env.BZ_SALT;
  const ingestSecret = process.env.BZ_INGEST_SECRET;
  if (!site || !salt || !ingestSecret) return null;
  return {
    site,
    salt,
    ingestSecret,
    endpoint: process.env.BZ_ENDPOINT || "https://breazy-analytics.breazy.workers.dev/e",
    platform: (process.env.BZ_PLATFORM as "vercel" | "cloudflare") || "vercel",
    returning: process.env.BZ_RETURNING !== "off",
  };
}

export async function POST(request: Request): Promise<Response> {
  // Always 204. A fire and forget beacon can do nothing with an error, and a
  // visitor must never see analytics fail.
  const c = cfg();
  if (!c) return new Response(null, { status: 204 });

  let body: unknown;
  try {
    body = JSON.parse(await request.text());
  } catch {
    return new Response(null, { status: 204 });
  }

  try {
    const { setCookie } = await collect(
      body,
      request.headers,
      request.headers.get("cookie") || "",
      c,
    );
    const headers = new Headers();
    if (setCookie) headers.append("set-cookie", setCookie);
    return new Response(null, { status: 204, headers });
  } catch {
    return new Response(null, { status: 204 });
  }
}

/** Object to analytics. Linked from the site's privacy page. */
export async function DELETE(): Promise<Response> {
  const headers = new Headers({ "content-type": "application/json" });
  for (const c of optOutCookies()) headers.append("set-cookie", c);
  return new Response(JSON.stringify({ analytics: "off" }), { status: 200, headers });
}

/** Withdraw the objection, so turning it back on is as easy as turning it off. */
export async function PUT(): Promise<Response> {
  const headers = new Headers({ "content-type": "application/json" });
  for (const c of optInCookies()) headers.append("set-cookie", c);
  return new Response(JSON.stringify({ analytics: "on" }), { status: 200, headers });
}
