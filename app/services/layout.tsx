import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Services — DJ, Live Performance & Event Content",
  description:
    "Book Tsakani Sessions for DJ sets, live performance, full event experiences, and professional event videography across Cape Town and South Africa.",
  alternates: { canonical: "/services" },
  openGraph: {
    title: "Tsakani Sessions Services — DJ, Live Performance & Content",
    description:
      "DJ sets, live performance, and event content creation across Cape Town and South Africa.",
    url: "/services",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Tsakani Sessions Services — DJ, Live Performance & Content",
    description:
      "DJ sets, live performance, and event content creation across Cape Town and South Africa.",
  },
};

export default function ServicesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
