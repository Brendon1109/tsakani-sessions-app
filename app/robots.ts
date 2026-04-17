import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL || "https://tsakani-sessions-app.vercel.app";

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/events", "/services", "/shop", "/gallery"],
        disallow: ["/admin", "/api", "/auth"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
