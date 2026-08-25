"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  ShoppingBag,
  Plus,
  Edit,
  Trash2,
  X,
  Upload,
  Loader2,
  Eye,
  EyeOff,
  ArrowLeft,
  ArrowRight,
  Star,
} from "lucide-react";
import ConfirmDialog from "@/components/ConfirmDialog";
import { randToCents, centsToRand, formatCents } from "@/lib/money";
import type { Product, ProductCategory } from "@/lib/types";

/**
 * Merch admin.
 *
 * The one thing to be careful with on this page: products.price_zar is stored
 * in CENTS and this form takes RAND. Every conversion goes through lib/money,
 * nowhere else, because a stray /100 here is the difference between R450 and
 * R4.50 on the live shop.
 */

const CATEGORIES: { value: ProductCategory; label: string }[] = [
  { value: "tshirt", label: "T-shirt" },
  { value: "hoodie", label: "Hoodie" },
  { value: "hat", label: "Hat / cap" },
  { value: "cup", label: "Cup / mug" },
  { value: "accessory", label: "Accessory" },
  { value: "other", label: "Other" },
];

const SIZE_PRESETS = ["XS", "S", "M", "L", "XL", "XXL", "3XL", "One size"];
const COLOUR_PRESETS = [
  "Sand",
  "Stone",
  "Cream",
  "White",
  "Black",
  "Grey",
  "Olive",
  "Red",
  "Orange",
  "Gold",
];

interface ProductForm {
  id?: string;
  name: string;
  description: string;
  /** Rand, as typed. Empty is allowed while editing. */
  price_rand: string;
  category: ProductCategory;
  images: string[];
  sizes: string[];
  colors: string[];
  in_stock: boolean;
  is_active: boolean;
  sort_order: number | "";
  /** Colour name to its own photo. Colours with no entry fall back to the main shot. */
  color_images: Record<string, string>;
}

const emptyForm: ProductForm = {
  name: "",
  description: "",
  price_rand: "",
  category: "tshirt",
  images: [],
  sizes: [],
  colors: [],
  in_stock: true,
  is_active: true,
  sort_order: 0,
  color_images: {},
};

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadProducts();
  }, []);

  async function loadProducts() {
    setLoading(true);
    const res = await fetch("/api/admin/products");
    if (res.ok) setProducts(await res.json());
    setLoading(false);
  }

  function startNew() {
    setError("");
    setForm({ ...emptyForm, sort_order: products.length });
    setShowForm(true);
  }

  function startEdit(product: Product) {
    setError("");
    setForm({
      id: product.id,
      name: product.name,
      description: product.description || "",
      price_rand: centsToRand(product.price_zar),
      category: product.category,
      // image_url is the main shot and lives at position zero of the strip, so
      // the admin reorders one list instead of juggling two fields.
      images: [
        ...(product.image_url ? [product.image_url] : []),
        ...(product.images || []).filter((url) => url !== product.image_url),
      ],
      sizes: product.sizes || [],
      colors: product.colors || [],
      in_stock: product.in_stock !== false,
      is_active: product.is_active !== false,
      sort_order: product.sort_order ?? 0,
      color_images: product.color_images || {},
    });
    setShowForm(true);
  }

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError("");
    try {
      for (const file of Array.from(files).slice(0, 8)) {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/admin/products/upload", {
          method: "POST",
          body: fd,
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Upload failed");
          break;
        }
        setForm((f) => ({ ...f, images: [...f.images, data.url].slice(0, 8) }));
      }
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function uploadColourPhoto(colour: string, file: File | null) {
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/products/upload", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Upload failed");
        return;
      }
      setForm((f) => ({
        ...f,
        color_images: { ...f.color_images, [colour]: data.url },
      }));
    } finally {
      setUploading(false);
    }
  }

  function moveImage(index: number, delta: number) {
    setForm((f) => {
      const next = [...f.images];
      const target = index + delta;
      if (target < 0 || target >= next.length) return f;
      [next[index], next[target]] = [next[target], next[index]];
      return { ...f, images: next };
    });
  }

  function toggleFromList(key: "sizes" | "colors", value: string) {
    setForm((f) => {
      const on = f[key].includes(value);
      const next = on ? f[key].filter((v) => v !== value) : [...f[key], value];
      if (key !== "colors" || !on) return { ...f, [key]: next };
      // Turning a colour off drops its photo with it, otherwise the form keeps
      // posting a picture for a colour nobody can buy.
      const images = { ...f.color_images };
      delete images[value];
      return { ...f, colors: next, color_images: images };
    });
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const cents = randToCents(form.price_rand);
    if (cents === null) {
      setError("Enter a price in Rand, for example 450");
      return;
    }
    if (!form.name.trim()) {
      setError("Give the product a name");
      return;
    }

    setSaving(true);
    const body = {
      id: form.id,
      name: form.name,
      description: form.description,
      price_zar: cents,
      category: form.category,
      image_url: form.images[0] || null,
      images: form.images,
      sizes: form.sizes,
      colors: form.colors,
      in_stock: form.in_stock,
      is_active: form.is_active,
      sort_order: form.sort_order === "" ? 0 : form.sort_order,
      color_images: form.color_images,
    };

    const res = await fetch("/api/admin/products", {
      method: form.id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      setShowForm(false);
      await loadProducts();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Failed to save");
    }
    setSaving(false);
  }

  async function quickToggle(product: Product, patch: Partial<Product>) {
    const res = await fetch("/api/admin/products", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: product.id, ...patch }),
    });
    if (res.ok) await loadProducts();
  }

  async function handleDelete(id: string) {
    const res = await fetch("/api/admin/products", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (res.ok) await loadProducts();
    setDeleteId(null);
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Merch</h1>
          <p className="text-gray-400 mt-1">
            What shows on the shop. Photos, price, sizes and colours.
          </p>
        </div>
        <button
          onClick={startNew}
          className="bg-gold-gradient text-black font-semibold px-4 py-2.5 rounded-lg hover:opacity-90 transition-opacity flex items-center gap-2"
        >
          <Plus size={18} />
          Add product
        </button>
      </div>

      {loading ? (
        <div className="text-center py-10 text-gray-500">Loading...</div>
      ) : products.length === 0 ? (
        <div className="bg-dark-500 border border-white/10 rounded-xl p-12 text-center">
          <ShoppingBag size={32} className="text-gray-600 mx-auto mb-3" />
          <h2 className="text-xl font-bold mb-2">No products yet</h2>
          <p className="text-gray-400 text-sm max-w-md mx-auto mb-6">
            Add your first piece and it appears on the shop straight away. The
            shop shows the &quot;No Products Yet&quot; card until something here
            is switched on.
          </p>
          <button
            onClick={startNew}
            className="bg-gold-gradient text-black font-semibold px-4 py-2.5 rounded-lg hover:opacity-90 transition-opacity inline-flex items-center gap-2"
          >
            <Plus size={18} />
            Add product
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {products.map((product) => (
            <div
              key={product.id}
              className={`bg-dark-500 border rounded-xl overflow-hidden transition-colors ${
                product.is_active ? "border-white/10" : "border-white/5 opacity-60"
              }`}
            >
              <div className="relative aspect-[4/3] bg-dark-300 flex items-center justify-center">
                {product.image_url ? (
                  <Image
                    src={product.image_url}
                    alt={product.name}
                    fill
                    sizes="(max-width: 768px) 100vw, 33vw"
                    className="object-contain p-4"
                  />
                ) : (
                  <ShoppingBag size={28} className="text-gray-700" />
                )}
                <span className="absolute top-3 right-3 bg-gold-gradient text-black text-xs font-bold px-2.5 py-1 rounded-full">
                  {formatCents(product.price_zar)}
                </span>
                {!product.in_stock && (
                  <span className="absolute top-3 left-3 bg-red-500/20 text-red-300 text-xs font-semibold px-2.5 py-1 rounded-full">
                    Sold out
                  </span>
                )}
              </div>

              <div className="p-4">
                <div className="flex items-start justify-between gap-3 mb-1">
                  <h3 className="font-bold leading-tight">{product.name}</h3>
                  <span className="text-xs text-gray-500 capitalize shrink-0">
                    {product.category}
                  </span>
                </div>
                <p className="text-gray-500 text-xs mb-3 line-clamp-2">
                  {product.description || "No description"}
                </p>

                <div className="flex flex-wrap gap-1.5 mb-4 text-[11px] text-gray-400">
                  {product.sizes?.length ? (
                    <span className="bg-white/5 rounded px-2 py-0.5">
                      {product.sizes.join(" · ")}
                    </span>
                  ) : null}
                  {product.colors?.length ? (
                    <span className="bg-white/5 rounded px-2 py-0.5">
                      {product.colors.join(" · ")}
                    </span>
                  ) : null}
                  {(product.images?.length || 0) > 1 ? (
                    <span className="bg-white/5 rounded px-2 py-0.5">
                      {product.images.length} photos
                    </span>
                  ) : null}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => startEdit(product)}
                    className="flex-1 flex items-center justify-center gap-1.5 text-sm bg-white/5 hover:bg-white/10 text-gray-200 py-2 rounded-lg transition-colors"
                  >
                    <Edit size={14} />
                    Edit
                  </button>
                  <button
                    onClick={() =>
                      quickToggle(product, { is_active: !product.is_active })
                    }
                    title={product.is_active ? "Hide from shop" : "Show on shop"}
                    className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 transition-colors"
                  >
                    {product.is_active ? <Eye size={16} /> : <EyeOff size={16} />}
                  </button>
                  <button
                    onClick={() =>
                      quickToggle(product, { in_stock: !product.in_stock })
                    }
                    title={product.in_stock ? "Mark sold out" : "Back in stock"}
                    className={`px-2.5 py-2 rounded-lg text-xs font-medium transition-colors ${
                      product.in_stock
                        ? "bg-white/5 hover:bg-white/10 text-gray-300"
                        : "bg-red-500/15 text-red-300 hover:bg-red-500/25"
                    }`}
                  >
                    {product.in_stock ? "In stock" : "Sold out"}
                  </button>
                  <button
                    onClick={() => setDeleteId(product.id)}
                    title="Delete"
                    className="p-2 rounded-lg bg-white/5 hover:bg-red-500/20 text-gray-400 hover:text-red-300 transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-sm p-4">
          <form
            onSubmit={handleSave}
            className="max-w-2xl mx-auto my-8 bg-dark-500 border border-white/10 rounded-2xl"
          >
            <div className="flex items-center justify-between p-5 border-b border-white/10 sticky top-0 bg-dark-500 rounded-t-2xl z-10">
              <h2 className="text-lg font-bold">
                {form.id ? "Edit product" : "New product"}
              </h2>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="text-gray-400 hover:text-white"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-5 space-y-5">
              {error && (
                <p className="bg-red-500/10 border border-red-500/30 text-red-300 text-sm rounded-lg px-4 py-3">
                  {error}
                </p>
              )}

              {/* Photos */}
              <div>
                <label className="block text-sm font-medium mb-2">Photos</label>
                <div className="flex flex-wrap gap-3 mb-3">
                  {form.images.map((url, index) => (
                    <div
                      key={url}
                      className="relative w-24 h-24 rounded-lg overflow-hidden border border-white/10 bg-dark-300 group"
                    >
                      <Image
                        src={url}
                        alt={`Photo ${index + 1}`}
                        fill
                        sizes="96px"
                        className="object-cover"
                      />
                      {index === 0 && (
                        <span className="absolute top-1 left-1 bg-gold-gradient text-black text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5">
                          <Star size={9} />
                          Main
                        </span>
                      )}
                      <div className="absolute inset-x-0 bottom-0 flex justify-between bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => moveImage(index, -1)}
                          className="p-1 text-gray-300 hover:text-white disabled:opacity-30"
                          disabled={index === 0}
                          aria-label="Move photo earlier"
                        >
                          <ArrowLeft size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setForm((f) => ({
                              ...f,
                              images: f.images.filter((_, i) => i !== index),
                            }))
                          }
                          className="p-1 text-gray-300 hover:text-red-400"
                          aria-label="Remove photo"
                        >
                          <Trash2 size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveImage(index, 1)}
                          className="p-1 text-gray-300 hover:text-white disabled:opacity-30"
                          disabled={index === form.images.length - 1}
                          aria-label="Move photo later"
                        >
                          <ArrowRight size={13} />
                        </button>
                      </div>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={() => fileInput.current?.click()}
                    disabled={uploading || form.images.length >= 8}
                    className="w-24 h-24 rounded-lg border border-dashed border-white/20 hover:border-gold-500/50 text-gray-500 hover:text-gold-500 flex flex-col items-center justify-center gap-1 transition-colors disabled:opacity-40"
                  >
                    {uploading ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : (
                      <>
                        <Upload size={18} />
                        <span className="text-[11px]">Add</span>
                      </>
                    )}
                  </button>
                </div>
                <input
                  ref={fileInput}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/avif"
                  multiple
                  className="hidden"
                  onChange={(e) => handleUpload(e.target.files)}
                />
                <p className="text-xs text-gray-500">
                  First photo is the one on the shop card. JPG, PNG, WebP or
                  AVIF, up to 8MB each.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Name *</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  maxLength={120}
                  placeholder="Tsakani Sessions Bear Hoodie"
                  className="w-full bg-dark-300 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm focus:border-gold-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Description
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  rows={3}
                  maxLength={2000}
                  placeholder="Heavyweight cotton hoodie, bear graphic front and back."
                  className="w-full bg-dark-300 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm focus:border-gold-500 focus:outline-none resize-y"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Price (Rand) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">
                      R
                    </span>
                    <input
                      value={form.price_rand}
                      onChange={(e) =>
                        setForm({ ...form, price_rand: e.target.value })
                      }
                      inputMode="decimal"
                      required
                      placeholder="450"
                      className="w-full bg-dark-300 border border-white/10 rounded-lg pl-7 pr-4 py-2.5 text-white text-sm focus:border-gold-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Category
                  </label>
                  <select
                    value={form.category}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        category: e.target.value as ProductCategory,
                      })
                    }
                    className="w-full bg-dark-300 border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm focus:border-gold-500 focus:outline-none"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Position
                  </label>
                  <input
                    type="number"
                    value={form.sort_order}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        sort_order:
                          e.target.value === "" ? "" : Number(e.target.value),
                      })
                    }
                    className="w-full bg-dark-300 border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm focus:border-gold-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Sizes</label>
                <div className="flex flex-wrap gap-2">
                  {SIZE_PRESETS.map((size) => {
                    const on = form.sizes.includes(size);
                    return (
                      <button
                        key={size}
                        type="button"
                        onClick={() => toggleFromList("sizes", size)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                          on
                            ? "border-gold-500 text-gold-500 bg-gold-500/10"
                            : "border-white/10 text-gray-400 hover:border-white/30"
                        }`}
                      >
                        {size}
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Leave all off for something with no size, a mug or a bucket
                  hat. Buyers then pick nothing.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Colours</label>
                <div className="flex flex-wrap gap-2">
                  {COLOUR_PRESETS.map((colour) => {
                    const on = form.colors.includes(colour);
                    return (
                      <button
                        key={colour}
                        type="button"
                        onClick={() => toggleFromList("colors", colour)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                          on
                            ? "border-gold-500 text-gold-500 bg-gold-500/10"
                            : "border-white/10 text-gray-400 hover:border-white/30"
                        }`}
                      >
                        {colour}
                      </button>
                    );
                  })}
                </div>

                {form.colors.length > 0 && (
                  <div className="mt-4 bg-dark-300/40 border border-white/10 rounded-lg p-4">
                    <p className="text-sm font-medium mb-1">Photo per colour</p>
                    <p className="text-xs text-gray-500 mb-4 leading-relaxed">
                      Give a colour its own shot and the shop swaps the picture
                      when a buyer picks it. Leave one blank and the card keeps
                      the main photo and says in words which colour was chosen,
                      so nobody thinks the picker is broken.
                    </p>
                    <div className="space-y-2">
                      {form.colors.map((colour) => {
                        const shot = form.color_images[colour];
                        return (
                          <div key={colour} className="flex items-center gap-3">
                            <div className="relative w-12 h-12 rounded-lg overflow-hidden border border-white/10 bg-dark-300 shrink-0">
                              {shot ? (
                                <Image
                                  src={shot}
                                  alt={colour}
                                  fill
                                  sizes="48px"
                                  className="object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-700">
                                  <ShoppingBag size={16} />
                                </div>
                              )}
                            </div>
                            <span className="text-sm flex-1">{colour}</span>
                            {shot && (
                              <button
                                type="button"
                                onClick={() =>
                                  setForm((f) => {
                                    const next = { ...f.color_images };
                                    delete next[colour];
                                    return { ...f, color_images: next };
                                  })
                                }
                                className="text-xs text-gray-500 hover:text-red-400 transition-colors"
                              >
                                Remove
                              </button>
                            )}
                            <label className="text-xs text-gold-500 hover:text-gold-400 cursor-pointer transition-colors">
                              {shot ? "Replace" : "Add photo"}
                              <input
                                type="file"
                                accept="image/jpeg,image/png,image/webp,image/avif"
                                className="hidden"
                                onChange={(e) =>
                                  uploadColourPhoto(colour, e.target.files?.[0] || null)
                                }
                              />
                            </label>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-5 pt-1">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={(e) =>
                      setForm({ ...form, is_active: e.target.checked })
                    }
                    className="w-4 h-4 accent-yellow-500"
                  />
                  Show on the shop
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.in_stock}
                    onChange={(e) =>
                      setForm({ ...form, in_stock: e.target.checked })
                    }
                    className="w-4 h-4 accent-yellow-500"
                  />
                  In stock
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 p-5 border-t border-white/10">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2.5 text-sm text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || uploading}
                className="bg-gold-gradient text-black font-semibold px-5 py-2.5 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2"
              >
                {saving && <Loader2 size={16} className="animate-spin" />}
                {saving ? "Saving..." : form.id ? "Save changes" : "Add product"}
              </button>
            </div>
          </form>
        </div>
      )}

      <ConfirmDialog
        isOpen={!!deleteId}
        title="Delete this product?"
        message="It comes off the shop immediately. Orders that already reference it keep their own copy of the name and price, so nothing in the order history changes."
        confirmLabel="Delete"
        onConfirm={() => deleteId && handleDelete(deleteId)}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
