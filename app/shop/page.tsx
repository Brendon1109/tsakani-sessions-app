import { getActiveProducts } from "@/lib/queries";
import ShopClient from "./ShopClient";

export const revalidate = 300; // Cache 5 minutes — products don't change often

export default async function ShopPage() {
  const products = await getActiveProducts();
  return <ShopClient products={products} />;
}
