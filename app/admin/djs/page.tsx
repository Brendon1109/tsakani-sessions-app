"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Headphones,
  Plus,
  Edit,
  Trash2,
  X,
  Upload,
  Loader2,
  ExternalLink,
} from "lucide-react";
import ConfirmDialog from "@/components/ConfirmDialog";
import DjPhoto from "@/components/DjPhoto";
import { cleanGenres, djImage, djPhotoUrl, DJ_LINKS, type DjLinkKey } from "@/lib/djs";
import type { Dj } from "@/lib/types";

/**
 * The DJ roster. Every DJ here is on the public site at /djs, so adding is
 * publishing and removing takes them off. The page address follows the name.
 *
 * Every text field is text-base: anything under 16px makes iPhone Safari zoom
 * in on focus and leave the page cut off.
 */

interface DjForm {
  id?: string;
  /** What the row said when the form opened, so a save can tell it is stale. */
  updated_at?: string | null;
  name: string;
  description: string;
  photo_path: string | null;
  /** As typed, comma separated. Turned into tags on save. */
  genres: string;
  youtube_url: string;
  tiktok_url: string;
  instagram_url: string;
  soundcloud_url: string;
}

const emptyForm: DjForm = {
  name: "",
  description: "",
  photo_path: null,
  genres: "",
  youtube_url: "",
  tiktok_url: "",
  instagram_url: "",
  soundcloud_url: "",
};

const inputClass =
  "w-full bg-dark-300 border border-white/10 rounded-lg px-4 py-2.5 text-white text-base focus:border-gold-500 focus:outline-none";

const PLACEHOLDERS: Record<DjLinkKey, string> = {
  youtube_url: "https://www.youtube.com/watch?v=...",
  tiktok_url: "https://www.tiktok.com/@...",
  instagram_url: "https://www.instagram.com/...",
  soundcloud_url: "https://soundcloud.com/...",
};
const LINKS = DJ_LINKS.map((l) => ({ ...l, placeholder: PLACEHOLDERS[l.key] }));

export default function AdminDjsPage() {
  const [djs, setDjs] = useState<Dj[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<DjForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [removing, setRemoving] = useState<Dj | null>(null);
  const [listError, setListError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadDjs();
  }, []);

  async function loadDjs() {
    setLoading(true);
    const res = await fetch("/api/admin/djs");
    if (res.ok) setDjs(await res.json());
    setLoading(false);
  }

  function startNew() {
    setError("");
    setForm(emptyForm);
    setShowForm(true);
  }

  function startEdit(dj: Dj) {
    setError("");
    setForm({
      id: dj.id,
      updated_at: dj.updated_at ?? null,
      name: dj.name,
      description: dj.description || "",
      photo_path: dj.photo_path,
      genres: (dj.genres || []).join(", "),
      youtube_url: dj.youtube_url || "",
      tiktok_url: dj.tiktok_url || "",
      instagram_url: dj.instagram_url || "",
      soundcloud_url: dj.soundcloud_url || "",
    });
    setShowForm(true);
  }

  async function handleUpload(file: File | null) {
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/djs/upload", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Upload failed");
        return;
      }
      setForm((f) => ({ ...f, photo_path: data.path }));
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!form.name.trim()) {
      setError("Give the DJ a name");
      return;
    }

    setSaving(true);
    const res = await fetch("/api/admin/djs", {
      method: form.id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, genres: cleanGenres(form.genres) }),
    });

    if (res.ok) {
      setShowForm(false);
      await loadDjs();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Failed to save");
    }
    setSaving(false);
  }

  async function handleRemove(dj: Dj) {
    setListError("");
    const res = await fetch("/api/admin/djs", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: dj.id }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setListError(data.error || "Could not remove that DJ");
    }
    setRemoving(null);
    await loadDjs();
  }

  const previewUrl = djPhotoUrl(form.photo_path);

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">DJs</h1>
          <p className="text-gray-400 mt-1">
            Everyone here is live on{" "}
            <Link href="/djs" target="_blank" className="text-gold-500 hover:underline">
              /djs
            </Link>
            .
          </p>
        </div>
        <button
          onClick={startNew}
          className="bg-gold-gradient text-black font-semibold px-4 py-2.5 rounded-lg hover:opacity-90 transition-opacity flex items-center gap-2"
        >
          <Plus size={18} />
          Add DJ
        </button>
      </div>

      {listError && (
        <p className="bg-red-500/10 border border-red-500/30 text-red-300 text-sm rounded-lg px-4 py-3 mb-4">
          {listError}
        </p>
      )}

      {loading ? (
        <div className="text-center py-10 text-gray-500">Loading...</div>
      ) : djs.length === 0 ? (
        <div className="bg-dark-500 border border-white/10 rounded-xl p-12 text-center">
          <Headphones size={32} className="text-gray-600 mx-auto mb-3" />
          <h2 className="text-xl font-bold mb-2">No DJs yet</h2>
          <p className="text-gray-400 text-sm mb-6">Add one and they show on the site.</p>
          <button
            onClick={startNew}
            className="bg-gold-gradient text-black font-semibold px-4 py-2.5 rounded-lg hover:opacity-90 transition-opacity inline-flex items-center gap-2"
          >
            <Plus size={18} />
            Add DJ
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {djs.map((dj) => {
            const links = LINKS.filter((l) => dj[l.key]).map((l) => l.label);
            return (
              <div
                key={dj.id}
                className="bg-dark-500 border border-white/10 rounded-xl overflow-hidden flex"
              >
                <div className="relative w-28 shrink-0 bg-dark-300 overflow-hidden">
                  <DjPhoto image={djImage(dj)} name={dj.name} sizes="112px" decorative />
                </div>
                <div className="p-4 flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h3 className="font-bold leading-tight break-words">{dj.name}</h3>
                    <a
                      href={`/djs/${dj.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Open their page"
                      className="text-gray-500 hover:text-gold-500 shrink-0"
                    >
                      <ExternalLink size={14} />
                    </a>
                  </div>
                  <p className="text-gray-500 text-xs mb-1 line-clamp-1">
                    {dj.genres?.length ? dj.genres.join(" · ") : "No genre yet"}
                  </p>
                  <p className="text-gray-500 text-xs mb-3 line-clamp-1">
                    {links.length ? links.join(" · ") : "No links yet"}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => startEdit(dj)}
                      className="flex-1 flex items-center justify-center gap-1.5 text-sm bg-white/5 hover:bg-white/10 text-gray-200 py-2 rounded-lg transition-colors"
                    >
                      <Edit size={14} />
                      Edit
                    </button>
                    <button
                      onClick={() => setRemoving(dj)}
                      title="Remove"
                      aria-label={`Remove ${dj.name}`}
                      className="p-2 rounded-lg bg-white/5 hover:bg-red-500/20 text-gray-400 hover:text-red-300 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-sm p-4">
          <form
            onSubmit={handleSave}
            className="max-w-xl mx-auto my-8 bg-dark-500 border border-white/10 rounded-2xl"
          >
            <div className="flex items-center justify-between p-5 border-b border-white/10 sticky top-0 bg-dark-500 rounded-t-2xl z-10">
              <h2 className="text-lg font-bold">{form.id ? "Edit DJ" : "New DJ"}</h2>
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

              <div>
                <span className="block text-sm font-medium mb-2">Picture</span>
                <div className="flex items-center gap-4">
                  <div className="relative w-24 h-24 rounded-lg overflow-hidden border border-white/10 bg-dark-300 shrink-0">
                    {previewUrl ? (
                      <Image src={previewUrl} alt="Picture" fill sizes="96px" className="object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-700">
                        <Headphones size={22} />
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-start gap-2">
                    <button
                      type="button"
                      onClick={() => fileInput.current?.click()}
                      disabled={uploading}
                      className="text-sm bg-white/5 hover:bg-white/10 text-gray-200 px-3 py-2 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
                    >
                      {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                      {form.photo_path ? "Replace" : "Upload"}
                    </button>
                    {form.photo_path && (
                      <button
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, photo_path: null }))}
                        className="text-xs text-gray-500 hover:text-red-400 transition-colors"
                      >
                        Remove picture
                      </button>
                    )}
                  </div>
                </div>
                <input
                  ref={fileInput}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/avif"
                  className="hidden"
                  onChange={(e) => handleUpload(e.target.files?.[0] || null)}
                />
                <p className="text-xs text-gray-500 mt-2">
                  Square works best. No picture shows their YouTube video, or their initial.
                </p>
              </div>

              <div>
                <label htmlFor="dj-name" className="block text-sm font-medium mb-2">
                  DJ name *
                </label>
                <input
                  id="dj-name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  maxLength={80}
                  placeholder="KENDOUR"
                  className={inputClass}
                />
              </div>

              <div>
                <label htmlFor="dj-genres" className="block text-sm font-medium mb-2">
                  Genre
                </label>
                <input
                  id="dj-genres"
                  value={form.genres}
                  onChange={(e) => setForm({ ...form, genres: e.target.value })}
                  placeholder="Deep House, Amapiano"
                  className={inputClass}
                />
                {cleanGenres(form.genres).length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {cleanGenres(form.genres).map((g) => (
                      <span
                        key={g}
                        className="text-gold-500 bg-gold-500/10 text-xs font-medium px-2 py-0.5 rounded-full"
                      >
                        {g}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label htmlFor="dj-description" className="block text-sm font-medium mb-2">
                  Description
                </label>
                <textarea
                  id="dj-description"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                  maxLength={500}
                  className={`${inputClass} resize-y`}
                />
              </div>

              {LINKS.map((link) => (
                <div key={link.key}>
                  <label htmlFor={`dj-${link.key}`} className="block text-sm font-medium mb-2">
                    {link.label}
                  </label>
                  <input
                    id={`dj-${link.key}`}
                    // Text rather than url, so "instagram.com/name" without
                    // https is accepted here and fixed up by the server.
                    type="text"
                    inputMode="url"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    value={form[link.key]}
                    onChange={(e) => setForm({ ...form, [link.key]: e.target.value })}
                    placeholder={link.placeholder}
                    className={inputClass}
                  />
                </div>
              ))}
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
                {saving ? "Saving..." : form.id ? "Save changes" : "Add DJ"}
              </button>
            </div>
          </form>
        </div>
      )}

      <ConfirmDialog
        isOpen={!!removing}
        title={`Remove ${removing?.name ?? "this DJ"}?`}
        message="They come off the site straight away and their picture is deleted. Enquiries that asked for them keep the name."
        confirmLabel="Remove"
        onConfirm={() => removing && handleRemove(removing)}
        onCancel={() => setRemoving(null)}
      />
    </div>
  );
}
