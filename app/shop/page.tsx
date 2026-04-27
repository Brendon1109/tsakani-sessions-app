import type { Metadata } from "next";
import { getActiveProducts } from "@/lib/queries";
import ShopClient from "./ShopClient";

export const revalidate = 300; // Cache 5 minutes — products don't change often

export const metadata: Metadata = {
  title: "Shop — Tsakani Sessions Merch",
  description:
    "Official Tsakani Sessions merch. Tees, hoodies, and accessories that carry the Cape Town DJ collective's energy. Pay quickly via WhatsApp.",
  alternates: { canonical: "/shop" },
  openGraph: {
    title: "Tsakani Sessions Shop — Official Merch",
    description:
      "Official Tsakani Sessions merch. Tees, hoodies, and accessories.",
    url: "/shop",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Tsakani Sessions Shop — Official Merch",
    description: "Official Tsakani Sessions merch from the Cape Town DJ collective.",
  },
};

export default async function ShopPage() {
  const products = await getActiveProducts();
  return <ShopClient products={products} />;
}
