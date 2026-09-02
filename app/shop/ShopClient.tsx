"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ShoppingBag, MessageCircle, Minus, Plus, Landmark, CreditCard } from "lucide-react";
import { createOrderMessage } from "@/lib/whatsapp";
import { track } from "@/lib/analytics";
import Turnstile from "@/components/Turnstile";
import type { Product, CheckoutOptions } from "@/lib/types";

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

interface EftDetails {
  account_holder: string | null;
  bank_name: string | null;
  account_number: string | null;
  branch_code: string | null;
  account_type: string | null;
  payment_email: string | null;
  eft_instructions: string | null;
  reference: string;
}

type PayMethod = "paystack" | "eft" | "whatsapp";

const CART_STORAGE_KEY = "tsakani_cart_v1";

const PLACEHOLDER = "/images/tsakani-logo.png";

// Swatch colours for the names an admin can pick in /admin/products. Anything
// unknown falls back to a neutral chip, and the name is always shown next to it
// so an unrecognised colour reads as a label rather than a mystery grey circle.
const colorHex: Record<string, string> = {
  Black: "#000000",
  White: "#ffffff",
  Nude: "#d4a574",
  Sand: "#d9c7a7",
  Stone: "#c9c2b6",
  Cream: "#f0e6d2",
  Grey: "#b0b0b0",
  Olive: "#5b6236",
  Red: "#a4232b",
  Orange: "#e8602c",
  Gold: "#ffd700",
};

/**
 * Product photos in display order: the card shot first, then the rest, then any
 * per-colour shot that is not already in the list.
 *
 * Colour photos are folded into the same list rather than kept separate so the
 * thumbnail strip and the colour picker drive one index between them. Picking
 * Red and tapping Red's thumbnail are then the same action.
 */
function photosOf(product: Product): string[] {
  const colourShots = Object.values(product.color_images || {}).filter(Boolean);
  const all = [
    ...(product.image_url ? [product.image_url] : []),
    ...(product.images || []),
    ...colourShots,
  ];
  const seen = new Set<string>();
  const unique = all.filter((url) => url && !seen.has(url) && seen.add(url));
  return unique.length > 0 ? unique : [PLACEHOLDER];
}

export default function ShopClient({
  products,
  checkout,
}: {
  products: Product[];
  checkout: CheckoutOptions;
}) {
  const eftAvailable = checkout.eft;
  const cardAvailable = checkout.paystack;
  const router = useRouter();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartHydrated, setCartHydrated] = useState(false);
  const [selectedSizes, setSelectedSizes] = useState<Record<string, string>>({});
  const [selectedColors, setSelectedColors] = useState<Record<string, string>>({});
  const [activePhoto, setActivePhoto] = useState<Record<string, number>>({});
  const [showCart, setShowCart] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const [submitting, setSubmitting] = useState<PayMethod | null>(null);
  const [checkoutError, setCheckoutError] = useState("");

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
    if (!product || product.in_stock === false) return;

    // A mug has no size and a one-colour hoodie has no colour choice, so an
    // empty string here is a real value meaning "not applicable" rather than a
    // missing selection. The server treats it the same way.
    const size = product.sizes?.length
      ? selectedSizes[productId] || product.sizes[0]
      : "";
    const color = product.colors?.length
      ? selectedColors[productId] || product.colors[0]
      : "";
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
          image: product.image_url || PLACEHOLDER,
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

  const handleCheckout = async (method: PayMethod) => {
    if (!customerName || !customerPhone) return;
    if (method === "paystack" && !customerEmail) {
      setCheckoutError("Card payment needs your email for the receipt.");
      return;
    }
    setCheckoutError("");
    setSubmitting(method);

    try {
      // Only product IDs and choices go up. Prices, sizes and colours are
      // resolved server side from the products table.
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_name: customerName,
          customer_phone: customerPhone,
          customer_email: customerEmail || null,
          payment_method: method,
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
        setCheckoutError(data.error || "Order failed. Please try again.");
        setSubmitting(null);
        return;
      }

      track("order_submitted", {
        value: cartTotal,
        items: cart.reduce((sum, item) => sum + item.quantity, 0),
        method,
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
        reference: data.payment_reference || null,
        paidByEft: method === "eft",
      });

      // Stash what the success page needs. The bank details ride along here
      // rather than being fetched again, because the only thing entitled to
      // see them is the browser that just placed this order.
      try {
        sessionStorage.setItem(
          PENDING_ORDER_KEY,
          JSON.stringify({
            message,
            total: cartTotal,
            method,
            reference: data.payment_reference || null,
            hasEmail: !!customerEmail,
            eft: (data.eft as EftDetails | null) || null,
            paystackUrl: data.paystack_url || null,
            paystackNote: data.paystack_note || null,
          })
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
      setCheckoutError(
        "Something went wrong. Please check your connection and try again."
      );
    } finally {
      setSubmitting(null);
    }
  };

  const captchaRequired = !!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const canCheckout =
    !!customerName &&
    !!customerPhone &&
    (!captchaRequired || !!captchaToken) &&
    !submitting;

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
              const photos = photosOf(product);
              const shown = Math.min(activePhoto[product.id] || 0, photos.length - 1);
              const soldOut = product.in_stock === false;
              const chosenColour = product.colors?.length
                ? selectedColors[product.id] || product.colors[0]
                : "";
              // A product can have five colourways and one mockup. Say so,
              // rather than showing a sand hoodie to somebody who picked red
              // and letting them think the picker is broken.
              const photoFollowsColour = !!product.color_images?.[chosenColour];
              return (
                <div
                  key={product.id}
                  className="group bg-dark-500 border border-white/10 rounded-2xl overflow-hidden hover:border-gold-500/30 transition-all duration-300"
                >
                  <div className="relative aspect-square bg-dark-300 flex items-center justify-center p-6">
                    <Image
                      src={photos[shown]}
                      alt={product.name}
                      width={400}
                      height={400}
                      className={`object-contain max-h-full w-auto transition-all duration-300 ${
                        soldOut
                          ? "opacity-40 grayscale"
                          : "opacity-90 group-hover:opacity-100 group-hover:scale-105"
                      }`}
                    />
                    <span className="absolute top-4 right-4 bg-gold-gradient text-black text-sm font-bold px-3 py-1 rounded-full">
                      R{priceInRand.toLocaleString("en-ZA")}
                    </span>
                    {soldOut && (
                      <span className="absolute top-4 left-4 bg-black/80 text-white text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full">
                        Sold out
                      </span>
                    )}
                  </div>

                  {photos.length > 1 && (
                    <div className="flex gap-2 px-6 pt-4" role="group" aria-label={`${product.name} photos`}>
                      {photos.map((photo, index) => (
                        <button
                          key={photo}
                          onClick={() =>
                            setActivePhoto((prev) => ({ ...prev, [product.id]: index }))
                          }
                          aria-label={`Show photo ${index + 1} of ${product.name}`}
                          aria-pressed={index === shown}
                          className={`relative w-12 h-12 rounded-lg overflow-hidden border transition-colors ${
                            index === shown
                              ? "border-gold-500"
                              : "border-white/10 hover:border-white/30"
                          }`}
                        >
                          <Image
                            src={photo}
                            alt=""
                            fill
                            sizes="48px"
                            className="object-cover"
                          />
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="p-6">
                    <h3 className="text-lg font-bold mb-1">{product.name}</h3>
                    {product.description && (
                      <p className="text-gray-400 text-sm mb-4">{product.description}</p>
                    )}

                    {product.sizes?.length > 0 && (
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
                    )}

                    {product.colors?.length > 0 && (
                      <div className="mb-5">
                        <label className="text-xs text-gray-500 uppercase tracking-wider block mb-2">
                          Colour:{" "}
                          <span className="text-gray-200 normal-case tracking-normal font-medium">
                            {chosenColour}
                          </span>
                        </label>
                        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={`${product.name} colour`}>
                          {product.colors.map((color) => {
                            const selected =
                              (selectedColors[product.id] || product.colors[0]) === color;
                            return (
                              <button
                                key={color}
                                onClick={() => {
                                  setSelectedColors((prev) => ({
                                    ...prev,
                                    [product.id]: color,
                                  }));
                                  // Only jump the photo when this colour
                                  // actually has one. Otherwise leave whatever
                                  // the buyer was looking at alone.
                                  const shot = product.color_images?.[color];
                                  const index = shot ? photos.indexOf(shot) : -1;
                                  if (index >= 0) {
                                    setActivePhoto((prev) => ({
                                      ...prev,
                                      [product.id]: index,
                                    }));
                                  }
                                }}
                                role="radio"
                                aria-checked={selected}
                                className={`flex items-center gap-2 pl-1.5 pr-3 py-1.5 rounded-lg border text-xs transition-colors ${
                                  selected
                                    ? "border-gold-500 text-gold-500 bg-gold-500/10"
                                    : "border-white/10 text-gray-400 hover:border-white/30"
                                }`}
                              >
                                <span
                                  className="w-5 h-5 rounded-full border border-white/20 shrink-0"
                                  style={{ backgroundColor: colorHex[color] || "#666" }}
                                  aria-hidden="true"
                                />
                                {color}
                              </button>
                            );
                          })}
                        </div>
                        {!photoFollowsColour && (
                          <p className="text-xs text-gray-500 mt-2">
                            Photo shows another colourway. Your order is for{" "}
                            <span className="text-gray-300">{chosenColour}</span>.
                          </p>
                        )}
                      </div>
                    )}

                    <button
                      onClick={() => addToCart(product.id)}
                      disabled={soldOut}
                      className="w-full bg-gold-gradient text-black font-semibold py-2.5 rounded-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <ShoppingBag size={16} aria-hidden="true" />
                      {soldOut ? "Sold out" : "Add to Cart"}
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
          Cart ({cart.reduce((sum, item) => sum + item.quantity, 0)}) — R{cartTotal.toLocaleString("en-ZA")}
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
                          {(item.size || item.color) && (
                            <p className="text-gray-500 text-xs">
                              {[item.size, item.color].filter(Boolean).join(" / ")}
                            </p>
                          )}
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
                          R{(item.price * item.quantity).toLocaleString("en-ZA")}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="border-t border-white/10 pt-4 mb-6">
                    <div className="flex items-center justify-between text-lg font-bold">
                      <span>Total</span>
                      <span className="text-gold-500">
                        R{cartTotal.toLocaleString("en-ZA")}
                      </span>
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
                      placeholder={
                        cardAvailable
                          ? "Email * (for your receipt)"
                          : eftAvailable
                          ? "Email (optional, we send the bank details here too)"
                          : "Email (optional, for confirmation)"
                      }
                      aria-label="Email"
                      autoComplete="email"
                      maxLength={254}
                      className="w-full bg-dark-300 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm focus:border-gold-500 focus:outline-none transition-colors"
                    />
                  </div>

                  <div className="mb-5">
                    <Turnstile onToken={setCaptchaToken} />
                  </div>

                  {checkoutError && (
                    <p className="mb-4 bg-red-500/10 border border-red-500/30 text-red-300 text-sm rounded-lg px-4 py-3">
                      {checkoutError}
                    </p>
                  )}

                  {cardAvailable && (
                    <>
                      <button
                        onClick={() => handleCheckout("paystack")}
                        disabled={!canCheckout}
                        className="w-full bg-gold-gradient text-black font-semibold py-3 rounded-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <CreditCard size={18} aria-hidden="true" />
                        {submitting === "paystack" ? "Placing order..." : "Pay by card"}
                      </button>
                      <p className="text-gray-500 text-xs text-center mt-3 mb-4">
                        Card, Apple Pay or instant EFT through Paystack. Your
                        reference shows on the next screen.
                      </p>
                    </>
                  )}

                  {eftAvailable && (
                    <>
                      <button
                        onClick={() => handleCheckout("eft")}
                        disabled={!canCheckout}
                        className={`w-full font-semibold py-3 rounded-lg transition-opacity flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                          cardAvailable
                            ? "border border-gold-500/40 text-gold-500 hover:bg-gold-500/10"
                            : "bg-gold-gradient text-black hover:opacity-90"
                        }`}
                      >
                        <Landmark size={18} aria-hidden="true" />
                        {submitting === "eft" ? "Placing order..." : "Pay by EFT"}
                      </button>
                      <p className="text-gray-500 text-xs text-center mt-3 mb-4">
                        Our bank details and your reference show on the next
                        screen. Pay, then send us your proof of payment on
                        WhatsApp.
                      </p>
                    </>
                  )}

                  <button
                    onClick={() => handleCheckout("whatsapp")}
                    disabled={!canCheckout}
                    className={`w-full flex items-center justify-center gap-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                      cardAvailable || eftAvailable
                        ? "border border-white/15 text-gray-300 hover:text-white hover:border-white/30 font-medium py-2.5"
                        : "bg-gold-gradient text-black font-semibold py-3 hover:opacity-90"
                    }`}
                  >
                    <MessageCircle size={16} aria-hidden="true" />
                    {submitting === "whatsapp"
                      ? "Submitting..."
                      : cardAvailable || eftAvailable
                      ? "Rather chat on WhatsApp"
                      : "Order via WhatsApp"}
                  </button>
                  {!cardAvailable && !eftAvailable && (
                    <p className="text-gray-500 text-xs text-center mt-3">
                      Your order is saved and sent via WhatsApp for confirmation
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
