"use client";

import { useState } from "react";
import Image from "next/image";
import { ShoppingBag, MessageCircle, Minus, Plus } from "lucide-react";
import { createOrderMessage, openWhatsApp } from "@/lib/whatsapp";

interface CartItem {
  productId: string;
  name: string;
  size: string;
  color: string;
  quantity: number;
  price: number;
  image: string;
}

const products = [
  {
    id: "mens-tee",
    name: "Tsakani Men's Tee",
    price: 450,
    description:
      "Premium cotton tee with the Tsakani Sessions logo. Soft, comfortable, and built to last.",
    image: "/images/tsakani-logo.png",
    sizes: ["S", "M", "L", "XL", "XXL"],
    colors: [
      { name: "Black", hex: "#000000" },
      { name: "White", hex: "#ffffff" },
    ],
    category: "tshirt",
  },
  {
    id: "womens-tee",
    name: "Tsakani Women's Tee",
    price: 450,
    description:
      "Fitted premium cotton tee with the Tsakani Sessions wordmark. Stylish and comfortable.",
    image: "/images/tsakani-logo.png",
    sizes: ["XS", "S", "M", "L", "XL"],
    colors: [
      { name: "Black", hex: "#000000" },
      { name: "Nude", hex: "#d4a574" },
    ],
    category: "tshirt",
  },
  {
    id: "tsakani-cup",
    name: "Tsakani Sessions Cup",
    price: 150,
    description:
      "Reusable branded cup — perfect for events and daily use. Rep the Tsakani lifestyle.",
    image: "/images/tsakani-logo.png",
    sizes: ["One Size"],
    colors: [
      { name: "Black", hex: "#000000" },
      { name: "Gold", hex: "#ffd700" },
    ],
    category: "cup",
  },
];

export default function ShopPage() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedSizes, setSelectedSizes] = useState<Record<string, string>>(
    {}
  );
  const [selectedColors, setSelectedColors] = useState<Record<string, string>>(
    {}
  );
  const [showCart, setShowCart] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");

  const addToCart = (productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return;

    const size = selectedSizes[productId] || product.sizes[0];
    const color = selectedColors[productId] || product.colors[0].name;

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
          price: product.price,
          image: product.image,
        },
      ]);
    }
    setShowCart(true);
  };

  const updateQuantity = (index: number, delta: number) => {
    const newCart = [...cart];
    newCart[index].quantity += delta;
    if (newCart[index].quantity <= 0) {
      newCart.splice(index, 1);
    }
    setCart(newCart);
  };

  const cartTotal = cart.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  const handleCheckout = () => {
    if (!customerName || !customerPhone) return;

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

    openWhatsApp(message);
    setCart([]);
    setShowCart(false);
  };

  return (
    <div>
      {/* Header */}
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

      {/* Products */}
      <section className="pb-16 sm:pb-24 px-4">
        <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((product) => (
            <div
              key={product.id}
              className="group bg-dark-500 border border-white/10 rounded-2xl overflow-hidden hover:border-gold-500/30 transition-all duration-300"
            >
              {/* Product Image */}
              <div className="relative aspect-square bg-dark-300 flex items-center justify-center p-8">
                <Image
                  src={product.image}
                  alt={product.name}
                  width={200}
                  height={200}
                  className="object-contain opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-300"
                />
                <span className="absolute top-4 right-4 bg-gold-gradient text-black text-sm font-bold px-3 py-1 rounded-full">
                  R{product.price}
                </span>
              </div>

              {/* Product Info */}
              <div className="p-6">
                <h3 className="text-lg font-bold mb-1">{product.name}</h3>
                <p className="text-gray-400 text-sm mb-4">
                  {product.description}
                </p>

                {/* Size Selector */}
                <div className="mb-4">
                  <label className="text-xs text-gray-500 uppercase tracking-wider block mb-2">
                    Size
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {product.sizes.map((size) => (
                      <button
                        key={size}
                        onClick={() =>
                          setSelectedSizes((prev) => ({
                            ...prev,
                            [product.id]: size,
                          }))
                        }
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                          (selectedSizes[product.id] || product.sizes[0]) ===
                          size
                            ? "border-gold-500 text-gold-500 bg-gold-500/10"
                            : "border-white/10 text-gray-400 hover:border-white/30"
                        }`}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Color Selector */}
                <div className="mb-5">
                  <label className="text-xs text-gray-500 uppercase tracking-wider block mb-2">
                    Color
                  </label>
                  <div className="flex gap-2">
                    {product.colors.map((color) => (
                      <button
                        key={color.name}
                        onClick={() =>
                          setSelectedColors((prev) => ({
                            ...prev,
                            [product.id]: color.name,
                          }))
                        }
                        className={`w-8 h-8 rounded-full border-2 transition-colors ${
                          (selectedColors[product.id] ||
                            product.colors[0].name) === color.name
                            ? "border-gold-500"
                            : "border-white/20 hover:border-white/40"
                        }`}
                        style={{ backgroundColor: color.hex }}
                        title={color.name}
                      />
                    ))}
                  </div>
                </div>

                {/* Add to Cart */}
                <button
                  onClick={() => addToCart(product.id)}
                  className="w-full bg-gold-gradient text-black font-semibold py-2.5 rounded-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                >
                  <ShoppingBag size={16} />
                  Add to Cart
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Floating Cart Button */}
      {cart.length > 0 && !showCart && (
        <button
          onClick={() => setShowCart(true)}
          className="fixed bottom-6 right-6 z-40 bg-gold-gradient text-black font-semibold px-6 py-3 rounded-full shadow-lg hover:opacity-90 transition-opacity flex items-center gap-2"
        >
          <ShoppingBag size={18} />
          Cart ({cart.reduce((sum, item) => sum + item.quantity, 0)}) — R
          {cartTotal}
        </button>
      )}

      {/* Cart Sidebar */}
      {showCart && (
        <div className="fixed inset-0 z-50 flex justify-end">
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
                >
                  Close
                </button>
              </div>

              {cart.length === 0 ? (
                <p className="text-gray-400 text-center py-10">
                  Your cart is empty.
                </p>
              ) : (
                <>
                  {/* Items */}
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
                          >
                            <Minus size={14} />
                          </button>
                          <span className="text-sm font-medium w-6 text-center">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => updateQuantity(index, 1)}
                            className="w-7 h-7 rounded-md bg-dark-300 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
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

                  {/* Total */}
                  <div className="border-t border-white/10 pt-4 mb-6">
                    <div className="flex items-center justify-between text-lg font-bold">
                      <span>Total</span>
                      <span className="text-gold-500">R{cartTotal}</span>
                    </div>
                  </div>

                  {/* Customer Info */}
                  <div className="space-y-3 mb-6">
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Your name *"
                      className="w-full bg-dark-300 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm focus:border-gold-500 focus:outline-none transition-colors"
                    />
                    <input
                      type="tel"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="Phone number *"
                      className="w-full bg-dark-300 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm focus:border-gold-500 focus:outline-none transition-colors"
                    />
                  </div>

                  {/* Checkout */}
                  <button
                    onClick={handleCheckout}
                    disabled={!customerName || !customerPhone}
                    className="w-full bg-gold-gradient text-black font-semibold py-3 rounded-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <MessageCircle size={18} />
                    Order via WhatsApp
                  </button>
                  <p className="text-gray-500 text-xs text-center mt-3">
                    Your order will be sent via WhatsApp for confirmation
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
