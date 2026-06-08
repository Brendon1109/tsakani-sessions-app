import { organizationGraph, jsonLdScript } from "@/lib/seo";

/**
 * Site-wide schema.org graph (EntertainmentBusiness + WebSite). Rendered once
 * in the root layout so every route carries Organization/LocalBusiness entity
 * grounding for search engines and AI answer engines.
 */
export default function SiteJsonLd() {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: jsonLdScript(organizationGraph()) }}
    />
  );
}
