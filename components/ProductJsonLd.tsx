import type { Product } from "@/lib/types";
import { SITE_URL, ORG_ID, jsonLdScript } from "@/lib/seo";

/**
 * ItemList of Product structured data for the shop, making merch eligible for
 * product rich results. Prices are stored in cents (price_zar) and rendered in
 * Rand to match the displayed price.
 */
export default function ProductJsonLd({ products }: { products: Product[] }) {
  if (!products || products.length === 0) return null;

  const schema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Tsakani Sessions Merch",
    itemListElement: products.map((p, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: {
        "@type": "Product",
        name: p.name,
        description: p.description || `Official Tsakani Sessions ${p.name}.`,
        image: p.image_url || `${SITE_URL}/og-image.jpg`,
        brand: { "@id": ORG_ID },
        offers: {
          "@type": "Offer",
          price: (p.price_zar / 100).toFixed(2),
          priceCurrency: "ZAR",
          availability: p.is_active
            ? "https://schema.org/InStock"
            : "https://schema.org/OutOfStock",
          url: `${SITE_URL}/shop`,
        },
      },
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: jsonLdScript(schema) }}
    />
  );
}
