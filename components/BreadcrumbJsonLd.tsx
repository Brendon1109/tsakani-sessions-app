import { breadcrumbJsonLd, jsonLdScript } from "@/lib/seo";

/**
 * BreadcrumbList structured data. Pass the trail as {name, path} items, e.g.
 *   <BreadcrumbJsonLd items={[{name:"Home",path:"/"},{name:"Events",path:"/events"}]} />
 */
export default function BreadcrumbJsonLd({
  items,
}: {
  items: { name: string; path: string }[];
}) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: jsonLdScript(breadcrumbJsonLd(items)),
      }}
    />
  );
}
