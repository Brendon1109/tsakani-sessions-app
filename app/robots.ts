import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL || "https://tsakanisessions.co.za";

  // /ticket and /unsubscribe carry a per-person token in the URL. Both pages
  // also send noindex, but keeping crawlers away from the path entirely means a
  // link leaked into a public page never gets fetched in the first place.
  const disallow = [
    "/admin",
    "/admin/",
    "/api",
    "/api/",
    "/auth",
    "/auth/",
    "/ticket",
    "/ticket/",
    "/unsubscribe",
  ];

  // AI answer engines & search crawlers we explicitly welcome for AISO.
  // (They already match the "*" rule, but an explicit Allow signals intent and
  // future-proofs against any tightening of the catch-all.)
  const aiCrawlers = [
    "GPTBot",
    "OAI-SearchBot",
    "ChatGPT-User",
    "ClaudeBot",
    "anthropic-ai",
    "Claude-Web",
    "PerplexityBot",
    "Perplexity-User",
    "Google-Extended",
    "Applebot",
    "Applebot-Extended",
    "Amazonbot",
  ];

  return {
    rules: [
      { userAgent: "*", allow: "/", disallow },
      ...aiCrawlers.map((userAgent) => ({ userAgent, allow: "/", disallow })),
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
