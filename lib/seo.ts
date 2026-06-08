/**
 * Single source of truth for Tsakani Sessions brand facts and the JSON-LD
 * structured-data graph used for AI Search Optimization (AISO) and local SEO.
 *
 * Keep these values in sync with the static marketing site (index.html) so
 * both properties describe the SAME schema.org entity (@id).
 */

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://tsakanisessions.co.za";

export const ORG_ID = `${SITE_URL}/#organization`;
export const WEBSITE_ID = `${SITE_URL}/#website`;

export const BUSINESS = {
  name: "Tsakani Sessions",
  alternateName: "Tsakani Sessions DJ Entertainment",
  slogan: "Two Tales of Happiness, Friendship & Brotherhood",
  description:
    "Tsakani Sessions is a Cape Town-based DJ entertainment and live-music event brand offering DJ performances, full event experiences, and content creation across Cape Town and the Western Cape, South Africa.",
  telephone: "+27769961477",
  email: "tsakanisessions@gmail.com",
  // Cape Town city centre — service-area business, no fixed storefront address.
  geo: { latitude: -33.9249, longitude: 18.4241 },
  sameAs: [
    "https://www.instagram.com/tsakani_sessions",
    "https://youtube.com/@tsakanisessions",
    "https://www.tiktok.com/@tsakani_sessions",
  ],
} as const;

export const SERVICES = [
  {
    name: "Full Tsakani Experience",
    description:
      "Complete cultural movement experience with live DJs, fresh acts, content creation and interactive vibe zones — full production and equipment included.",
  },
  {
    name: "DJ & Live Performance",
    description:
      "Curated lineup of local DJs and emerging artists who bring soul and stories to your event.",
  },
  {
    name: "Content & Documentation",
    description:
      "Authentic event videography, photography and social-media content with post-production.",
  },
] as const;

export const FAQS: { question: string; answer: string }[] = [
  {
    question: "What is Tsakani Sessions?",
    answer:
      "Tsakani Sessions is a Cape Town-based DJ entertainment and live-music event brand — more than an event, a cultural movement built around music, connection and joy, themed on 'Two Tales of Happiness, Friendship & Brotherhood.'",
  },
  {
    question: "What services does Tsakani Sessions offer?",
    answer:
      "Three packages: the Full Tsakani Experience (live DJs, rising local talent, content creation, interactive vibe zones, full production and equipment), DJ & Live Performance (curated local and emerging DJs and acts), and Content & Documentation (event videography, photography and social-media content).",
  },
  {
    question: "How do I book Tsakani Sessions?",
    answer:
      "Choose a service on the website and submit the booking form, or message us on WhatsApp at +27 76 996 1477. Your request opens a pre-filled WhatsApp message so we can confirm the details.",
  },
  {
    question: "What areas does Tsakani Sessions serve?",
    answer:
      "We are based in Cape Town and serve events across Cape Town and the Western Cape, South Africa.",
  },
  {
    question: "How much does Tsakani Sessions cost?",
    answer:
      "Pricing depends on the package, event size and requirements — submit a booking request for a tailored quote. Official merch tees are R450 and event tickets come in Early Bird, General and VIP tiers.",
  },
  {
    question: "Does Tsakani Sessions sell merchandise?",
    answer:
      "Yes — official Tsakani Sessions tees (men's and women's, R450 each) in Black, White or Nude, sizes S to L, ordered via the Shop with checkout over WhatsApp.",
  },
];

/**
 * The site-wide schema.org @graph: a single EntertainmentBusiness (which is
 * also an Organization + LocalBusiness) node plus a WebSite node. Rendered once
 * in the root layout so every route inherits brand/entity grounding.
 */
export function organizationGraph(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "EntertainmentBusiness",
        "@id": ORG_ID,
        name: BUSINESS.name,
        alternateName: BUSINESS.alternateName,
        url: SITE_URL,
        logo: {
          "@type": "ImageObject",
          url: `${SITE_URL}/images/tsakani-logo.png`,
        },
        image: `${SITE_URL}/og-image.jpg`,
        description: BUSINESS.description,
        slogan: BUSINESS.slogan,
        telephone: BUSINESS.telephone,
        email: BUSINESS.email,
        priceRange: "$$",
        currenciesAccepted: "ZAR",
        knowsLanguage: ["en-ZA"],
        address: {
          "@type": "PostalAddress",
          addressLocality: "Cape Town",
          addressRegion: "Western Cape",
          addressCountry: "ZA",
        },
        areaServed: [
          { "@type": "City", name: "Cape Town" },
          { "@type": "AdministrativeArea", name: "Western Cape" },
          { "@type": "Country", name: "South Africa" },
        ],
        geo: {
          "@type": "GeoCoordinates",
          latitude: BUSINESS.geo.latitude,
          longitude: BUSINESS.geo.longitude,
        },
        contactPoint: {
          "@type": "ContactPoint",
          telephone: BUSINESS.telephone,
          contactType: "customer service",
          areaServed: "ZA",
          availableLanguage: ["en"],
        },
        sameAs: BUSINESS.sameAs,
        hasOfferCatalog: {
          "@type": "OfferCatalog",
          name: "Tsakani Sessions Services",
          itemListElement: SERVICES.map((s) => ({
            "@type": "Offer",
            itemOffered: {
              "@type": "Service",
              name: s.name,
              description: s.description,
            },
          })),
        },
      },
      {
        "@type": "WebSite",
        "@id": WEBSITE_ID,
        url: SITE_URL,
        name: BUSINESS.name,
        inLanguage: "en-ZA",
        publisher: { "@id": ORG_ID },
      },
    ],
  };
}

export function faqPageJsonLd(
  faqs: { question: string; answer: string }[] = FAQS,
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "@id": `${SITE_URL}/faq#faq`,
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  };
}

/**
 * Serialize a JSON-LD object for safe embedding inside a <script> tag.
 * JSON.stringify does NOT escape `<`, so a data-driven field containing the
 * literal "</script>" would terminate the tag early (broken structured data /
 * stored-XSS vector). Escaping `<`, `>` and `&` to their \uXXXX forms keeps the
 * JSON valid and parseable while preventing tag-breakout.
 */
export function jsonLdScript(obj: unknown): string {
  return JSON.stringify(obj)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}

export function breadcrumbJsonLd(
  items: { name: string; path: string }[],
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: `${SITE_URL}${item.path}`,
    })),
  };
}
