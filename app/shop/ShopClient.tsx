"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ShoppingBag, MessageCircle, Minus, Plus } from "lucide-react";
import { createOrderMessage } from "@/lib/whatsapp";
import { track } from "@/lib/analytics";
import Turnstile from "@/components/Turnstile";
import type { Product } from "@/lib/types";

const PENDING_ORDER_KEY = "tsakani_pending_order_v1";

interface CartItem {
  productId: string;
  name: string;
  size: string;
  color: string;
  quantity: number;
  price: number;
  image: string;
}

const CART_STORAGE_KEY = "tsakani_cart_v1";

export default function ShopClient({ products }: { products: Product[] }) {
  const router = useRouter();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartHydrated, setCartHydrated] = useState(false);
  const [selectedSizes, setSelectedSizes] = useState<Record<string, string>>({});
  const [selectedColors, setSelectedColors] = useState<Record<string, string>>({});
  const [showCart, setShowCart] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const colorHex: Record<string, string> = {
    Black: "#000000",
    White: "#ffffff",
    Nude: "#d4a574",
    Gold: "#ffd700",
  };

  // Hydrate cart from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(CART_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) setCart(parsed);
      }
    } catch {
      // ignore
    }
    setCartHydrated(true);
  }, []);

  // Persist cart to localStorage whenever it changes
  useEffect(() => {
    if (!cartHydrated) return;
    try {
      if (cart.length === 0) localStorage.removeItem(CART_STORAGE_KEY);
      else localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    } catch {
      // ignore quota errors
    }
  }, [cart, cartHydrated]);

  const addToCart = (productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return;

    const size = selectedSizes[productId] || product.sizes[0];
    const color = selectedColors[productId] || product.colors[0];
    const priceInRand = product.price_zar / 100;

    track("add_to_cart", { product: product.name, size, color });

    const existingIndex = cart.findIndex(
      (item) =>
        item.productId === productId &&
        item.size === size &&
        item.color === color
    );

    if (existingIndex >= 0) {
      const newCart = [...cart];
      newCart[existingIndex].quantity += 1;
      setCart(newCart);
    } else {
      setCart([
        ...cart,
        {
          productId,
          name: product.name,
          size,
          color,
          quantity: 1,
          price: priceInRand,
          image: product.image_url || "/images/tsakani-logo.png",
        },
      ]);
    }
    setShowCart(true);
  };

  const updateQuantity = (index: number, delta: number) => {
    const newCart = [...cart];
    newCart[index].quantity += delta;
    if (newCart[index].quantity <= 0) newCart.splice(index, 1);
    setCart(newCart);
  };

  const cartTotal = cart.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  const handleCheckout = async () => {
    if (!customerName || !customerPhone) return;
    setSubmitting(true);

    try {
      // Send only product IDs and sizes — server looks up prices from DB
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_name: customerName,
          customer_phone: customerPhone,
          customer_email: customerEmail || null,
          items: cart.map((item) => ({
            product_id: item.productId,
            size: item.size,
            color: item.color,
            qty: item.quantity,
          })),
          captcha_token: captchaToken,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        alert(data.error || "Order failed. Please try again.");
        setSubmitting(false);
        return;
      }

      track("order_submitted", {
        value: cartTotal,
        items: cart.reduce((sum, item) => sum + item.quantity, 0),
      });

      const message = createOrderMessage({
        customerName,
        customerPhone,
        items: cart.map((item) => ({
          name: item.name,
          size: item.size,
          color: item.color,
          quantity: item.quantity,
          price: item.price,
        })),
        total: cartTotal,
      });

      // Stash the WhatsApp payload so the success page can offer a deliberate
      // "Send via WhatsApp" button instead of opening it automatically and
      // losing context if the user closes the tab.
      try {
        sessionStorage.setItem(
          PENDING_ORDER_KEY,
          JSON.stringify({ message, total: cartTotal })
        );
      } catch {
        // ignore quota errors — success page will degrade gracefully
      }

      setCart([]);
      setShowCart(false);
      setCustomerName("");
      setCustomerPhone("");
      setCustomerEmail("");
      setCaptchaToken("");
      router.push(
        `/shop/success?orderId=${encodeURIComponent(data.id)}&total=${cartTotal}`
      );
    } catch {
      alert("Something went wrong. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const captchaRequired = !!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const canCheckout =
    customerName && customerPhone && (!captchaRequired || captchaToken) && !submitting;

  return (
    <div>
      <section className="py-16 sm:py-24 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl font-bold mb-4">
            <span className="text-gold-gradient">Merch</span> Store
          </h1>
          <p className="text-gray-400 max-w-xl mx-auto text-lg">
            Rep the Tsakani Sessions lifestyle. Premium merch for the culture.
          </p>
        </div>
      </section>

      <section className="pb-16 sm:pb-24 px-4">
        {products.length === 0 ? (
          <div className="max-w-2xl mx-auto bg-dark-500 border border-white/10 rounded-2xl p-12 text-center">
            <ShoppingBag size={36} className="text-gold-500 mx-auto mb-4" aria-hidden="true" />
            <h2 className="text-xl font-bold mb-2">No Products Yet</h2>
            <p className="text-gray-400">Check back soon for merch drops.</p>
          </div>
        ) : (
          <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.map((product) => {
              const priceInRand = product.price_zar / 100;
              return (
                <div
                  key={product.id}
                  className="group bg-dark-500 border border-white/10 rounded-2xl overflow-hidden hover:border-gold-500/30 transition-all duration-300"
                >
                  <div className="relative aspect-square bg-dark-300 flex items-center justify-center p-8">
                    <Image
                      src={product.image_url || "/images/tsakani-logo.png"}
                      alt={product.name}
                      width={200}
                      height={200}
                      className="object-contain opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-300"
                    />
                    <span className="absolute top-4 right-4 bg-gold-gradient text-black text-sm font-bold px-3 py-1 rounded-full">
                      R{priceInRand}
                    </span>
                  </div>

                  <div className="p-6">
                    <h3 className="text-lg font-bold mb-1">{product.name}</h3>
                    <p className="text-gray-400 text-sm mb-4">{product.description}</p>

                    <div className="mb-4">
                      <label className="text-xs text-gray-500 uppercase tracking-wider block mb-2">
                        Size
                      </label>
                      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={`${product.name} size`}>
                        {product.sizes.map((size) => {
                          const selected =
                            (selectedSizes[product.id] || product.sizes[0]) === size;
                          return (
                            <button
                              key={size}
                              onClick={() =>
                                setSelectedSizes((prev) => ({
                                  ...prev,
                                  [product.id]: size,
                                }))
                              }
                              role="radio"
                              aria-checked={selected}
                              className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                                selected
                                  ? "border-gold-500 text-gold-500 bg-gold-500/10"
                                  : "border-white/10 text-gray-400 hover:border-white/30"
                              }`}
                            >
                              {size}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="mb-5">
                      <label className="text-xs text-gray-500 uppercase tracking-wider block mb-2">
                        Color
                      </label>
                      <div className="flex gap-2" role="radiogroup" aria-label={`${product.name} color`}>
                        {product.colors.map((color) => {
                          const selected =
                            (selectedColors[product.id] || product.colors[0]) === color;
                          return (
                            <button
                              key={color}
                              onClick={() =>
                                setSelectedColors((prev) => ({
                                  ...prev,
                                  [product.id]: color,
                                }))
                              }
                              role="radio"
                              aria-checked={selected}
                              aria-label={color}
                              className={`w-8 h-8 rounded-full border-2 transition-colors ${
                                selected
                                  ? "border-gold-500"
                                  : "border-white/20 hover:border-white/40"
                              }`}
                              style={{ backgroundColor: colorHex[color] || "#666" }}
                              title={color}
                            />
                          );
                        })}
                      </div>
                    </div>

                    <button
                      onClick={() => addToCart(product.id)}
                      className="w-full bg-gold-gradient text-black font-semibold py-2.5 rounded-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                    >
                      <ShoppingBag size={16} aria-hidden="true" />
                      Add to Cart
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {cart.length > 0 && !showCart && (
        <button
          onClick={() => setShowCart(true)}
          className="fixed bottom-6 right-6 z-40 bg-gold-gradient text-black font-semibold px-6 py-3 rounded-full shadow-lg hover:opacity-90 transition-opacity flex items-center gap-2"
          aria-label={`Open cart with ${cart.reduce((sum, item) => sum + item.quantity, 0)} items`}
        >
          <ShoppingBag size={18} aria-hidden="true" />
          Cart ({cart.reduce((sum, item) => sum + item.quantity, 0)}) — R{cartTotal}
        </button>
      )}

      {showCart && (
        <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="Shopping cart">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowCart(false)}
          />
          <div className="relative w-full max-w-md bg-dark-500 border-l border-gold-500/20 h-full overflow-y-auto animate-slide-down">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold">Your Cart</h3>
                <button
                  onClick={() => setShowCart(false)}
                  className="text-gray-400 hover:text-white transition-colors text-sm"
                  aria-label="Close cart"
                >
                  Close
                </button>
              </div>

              {cart.length === 0 ? (
                <p className="text-gray-400 text-center py-10">Your cart is empty.</p>
              ) : (
                <>
                  <div className="space-y-4 mb-6">
                    {cart.map((item, index) => (
                      <div
                        key={`${item.productId}-${item.size}-${item.color}`}
                        className="flex items-center gap-4 bg-dark-300/50 rounded-xl p-4"
                      >
                        <div className="flex-1">
                          <p className="font-medium text-sm">{item.name}</p>
                          <p className="text-gray-500 text-xs">
                            {item.size} / {item.color}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => updateQuantity(index, -1)}
                            className="w-7 h-7 rounded-md bg-dark-300 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
                            aria-label={`Decrease ${item.name} quantity`}
                          >
                            <Minus size={14} />
                          </button>
                          <span className="text-sm font-medium w-6 text-center" aria-live="polite">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => updateQuantity(index, 1)}
                            className="w-7 h-7 rounded-md bg-dark-300 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
                            aria-label={`Increase ${item.name} quantity`}
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                        <p className="text-gold-500 font-semibold text-sm w-16 text-right">
                          R{item.price * item.quantity}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="border-t border-white/10 pt-4 mb-6">
                    <div className="flex items-center justify-between text-lg font-bold">
                      <span>Total</span>
                      <span className="text-gold-500">R{cartTotal}</span>
                    </div>
                  </div>

                  <div className="space-y-3 mb-4">
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Your name *"
                      aria-label="Your name"
                      autoComplete="name"
                      maxLength={100}
                      className="w-full bg-dark-300 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm focus:border-gold-500 focus:outline-none transition-colors"
                    />
                    <input
                      type="tel"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="Phone number *"
                      aria-label="Phone number"
                      autoComplete="tel"
                      maxLength={20}
                      className="w-full bg-dark-300 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm focus:border-gold-500 focus:outline-none transition-colors"
                    />
                    <input
                      type="email"
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      placeholder="Email (optional, for confirmation)"
                      aria-label="Email"
                      autoComplete="email"
                      maxLength={254}
                      className="w-full bg-dark-300 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm focus:border-gold-500 focus:outline-none transition-colors"
                    />
                  </div>

                  <div className="mb-6">
                    <Turnstile onToken={setCaptchaToken} />
                  </div>

                  <button
                    onClick={handleCheckout}
                    disabled={!canCheckout}
                    className="w-full bg-gold-gradient text-black font-semibold py-3 rounded-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <MessageCircle size={18} aria-hidden="true" />
                    {submitting ? "Submitting..." : "Order via WhatsApp"}
                  </button>
                  <p className="text-gray-500 text-xs text-center mt-3">
                    Your order is saved and sent via WhatsApp for confirmation
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
