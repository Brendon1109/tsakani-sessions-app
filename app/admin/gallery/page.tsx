"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Upload, Image as ImageIcon, Loader2, Stamp, Trash2, Star, CheckCircle2, Eye, EyeOff, Save, ExternalLink, Plus } from "lucide-react";
import { compressPhoto, formatBytes, loadLogo } from "@/lib/image-optimize";
import PhotoManager from "./PhotoManager";

interface Gallery {
  id: string;
  slug: string;
  title: string;
  event_id: string | null;
  is_public: boolean;
  drive_url: string;
  event_title: string | null;
}

interface EventOption {
  id: string;
  title: string;
  date: string;
}

function eventLabel(e: EventOption): string {
  const day = new Date(e.date).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Africa/Johannesburg",
  });
  return `${e.title.trim()}, ${day}`;
}

interface Logo {
  id: string;
  name: string;
  src: string;
  is_default: boolean;
}

const BRAND_KEY = "tsakani-gallery-brand";

/** Ships with the site, so branding works even if the logo library cannot load. */
const BUILT_IN_LOGO: Logo = {
  id: "built-in",
  name: "Tsakani Sessions, white",
  src: "/branding/tsakani-sessions-logo.png",
  is_default: true,
};

interface QueuedPhoto {
  id: string;
  /** The picked file. iOS keeps it on disk until it is read, so holding it costs nothing. */
  file: File;
  status: "waiting" | "working" | "done" | "error";
  error?: string;
}

/** Two photos in flight at once: quick on a phone, light on its memory. */
const PARALLEL = 2;

export default function AdminGalleryPage() {
  const [galleries, setGalleries] = useState<Gallery[]>([]);
  const [selectedGalleryId, setSelectedGalleryId] = useState("");
  const [queue, setQueue] = useState<QueuedPhoto[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadedBytes, setUploadedBytes] = useState(0);
  const [lastPreview, setLastPreview] = useState<string | null>(null);
  const stopRef = useRef(false);
  const [photosKey, setPhotosKey] = useState(0);
  const [logos, setLogos] = useState<Logo[]>([]);
  const [logoId, setLogoId] = useState("");
  const [brandOn, setBrandOn] = useState(true);
  const [logoMessage, setLogoMessage] = useState<string | null>(null);
  const [logoBusy, setLogoBusy] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const chosenLogo = logos.find((l) => l.id === logoId) || null;
  const [savingSettings, setSavingSettings] = useState(false);
  const [driveUrl, setDriveUrl] = useState("");
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);
  const [events, setEvents] = useState<EventOption[]>([]);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newEventId, setNewEventId] = useState("");
  const [createMessage, setCreateMessage] = useState<string | null>(null);
  const [savingNew, setSavingNew] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedGallery = galleries.find((g) => g.id === selectedGalleryId);

  useEffect(() => {
    loadGalleries();
    loadEvents();
    loadLogos();
    try {
      if (localStorage.getItem(BRAND_KEY) === "off") setBrandOn(false);
    } catch {}
  }, []);

  useEffect(() => {
    setDriveUrl(selectedGallery?.drive_url || "");
    setSettingsMessage(null);
  }, [selectedGallery?.id, selectedGallery?.drive_url]);

  async function loadGalleries() {
    const res = await fetch("/api/admin/galleries");
    if (res.ok) {
      const data = await res.json();
      setGalleries(data);
      if (data.length > 0 && !selectedGalleryId) {
        setSelectedGalleryId(data[0].id);
      }
    }
  }

  async function loadLogos(select?: string) {
    const res = await fetch("/api/admin/gallery-logos").catch(() => null);
    const listed = res?.ok ? ((await res.json()) as Logo[]) : [];
    const data = listed.length > 0 ? listed : [BUILT_IN_LOGO];
    setLogos(data);
    setLogoId((cur) => {
      if (select) return select;
      if (cur && data.some((l) => l.id === cur)) return cur;
      return data.find((l) => l.is_default)?.id || data[0]?.id || "";
    });
  }

  function setBrand(on: boolean) {
    setBrandOn(on);
    try {
      localStorage.setItem(BRAND_KEY, on ? "on" : "off");
    } catch {}
  }

  async function addLogo(file: File | undefined) {
    if (!file) return;
    setLogoBusy(true);
    setLogoMessage(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/gallery-logos", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setLogoMessage(data.error || "Could not add the logo");
        return;
      }
      await loadLogos(data.id);
    } finally {
      setLogoBusy(false);
      if (logoInputRef.current) logoInputRef.current.value = "";
    }
  }

  async function logoAction(method: "PATCH" | "DELETE", id: string) {
    if (method === "DELETE" && !confirm("Delete this logo? Photos already branded keep it.")) return;
    setLogoBusy(true);
    setLogoMessage(null);
    try {
      const res = await fetch("/api/admin/gallery-logos", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setLogoMessage(data.error || "That did not work");
      await loadLogos();
    } finally {
      setLogoBusy(false);
    }
  }

  async function loadEvents() {
    const res = await fetch("/api/admin/events");
    if (res.ok) {
      const data = (await res.json()) as EventOption[];
      setEvents(data.map((e) => ({ id: e.id, title: e.title, date: e.date })));
    }
  }

  async function createGallery() {
    if (!newTitle.trim()) {
      setCreateMessage("Give the gallery a title");
      return;
    }
    setSavingNew(true);
    setCreateMessage(null);
    try {
      const res = await fetch("/api/admin/galleries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle, event_id: newEventId || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCreateMessage(data.error || "Could not create the gallery");
        return;
      }
      setCreating(false);
      setNewTitle("");
      setNewEventId("");
      await loadGalleries();
      setSelectedGalleryId(data.id);
    } finally {
      setSavingNew(false);
    }
  }

  function pickNewEvent(id: string) {
    setNewEventId(id);
    const ev = events.find((e) => e.id === id);
    if (ev && !newTitle.trim()) setNewTitle(ev.title.trim());
  }

  async function patchGallery(patch: { is_public?: boolean; drive_url?: string; event_id?: string | null }) {
    if (!selectedGallery) return;
    setSavingSettings(true);
    setSettingsMessage(null);
    try {
      const res = await fetch("/api/admin/galleries", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedGallery.id, ...patch }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSettingsMessage(data.error || "Save failed");
        return;
      }
      if (data.warning) setSettingsMessage(data.warning);
      await loadGalleries();
    } finally {
      setSavingSettings(false);
    }
  }

  async function togglePublic() {
    if (!selectedGallery) return;
    await patchGallery({ is_public: !selectedGallery.is_public });
  }

  async function saveDriveUrl() {
    await patchGallery({ drive_url: driveUrl });
  }

  function handleFiles(newFiles: FileList | null) {
    if (!newFiles || newFiles.length === 0) return;
    // Only list the photos here. Nothing is read or compressed until upload,
    // one at a time, so a few hundred photos never sit in memory together.
    const picked = Array.from(newFiles)
      .filter((f) => f.type.startsWith("image/") || /\.(heic|heif)$/i.test(f.name))
      .map((file) => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        status: "waiting" as const,
      }));
    setQueue((prev) => [...prev, ...picked]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function showPreview(file: File) {
    setLastPreview((old) => {
      if (old) URL.revokeObjectURL(old);
      return URL.createObjectURL(file);
    });
  }

  function setStatus(id: string, status: QueuedPhoto["status"], error?: string) {
    setQueue((prev) => prev.map((q) => (q.id === id ? { ...q, status, error } : q)));
  }

  async function sendOne(galleryId: string, file: File): Promise<string | null> {
    const formData = new FormData();
    formData.append("gallery_id", galleryId);
    formData.append("files", file, file.name);
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch("/api/gallery/upload", { method: "POST", body: formData });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.uploaded > 0) return null;
        if (res.status === 401 || res.status === 403) return "Signed out, sign in again";
        if (attempt === 1) return data.error || "Upload failed";
      } catch {
        if (attempt === 1) return "Network error";
      }
    }
    return "Upload failed";
  }

  async function uploadAll() {
    const galleryId = selectedGalleryId;
    const todo = queue.filter((q) => q.status === "waiting" || q.status === "error");
    if (!galleryId || todo.length === 0) return;

    let logo: HTMLImageElement | null = null;
    if (brandOn && chosenLogo) {
      try {
        logo = await loadLogo(chosenLogo.src);
      } catch {
        setLogoMessage("Could not load the logo, so nothing was uploaded. Try again or switch branding off.");
        return;
      }
    }

    setUploading(true);
    stopRef.current = false;

    let next = 0;
    const worker = async () => {
      while (!stopRef.current && next < todo.length) {
        const item = todo[next++];
        setStatus(item.id, "working");
        let file: File;
        try {
          file = await compressPhoto(item.file, logo);
        } catch (err) {
          console.error("Compress failed:", err);
          setStatus(item.id, "error", "Could not read this photo");
          continue;
        }
        const error = await sendOne(galleryId, file);
        if (error) {
          setStatus(item.id, "error", error);
          if (error.startsWith("Signed out")) stopRef.current = true;
        } else {
          setStatus(item.id, "done");
          setUploadedBytes((b) => b + file.size);
          showPreview(file);
        }
      }
    };

    await Promise.all(Array.from({ length: PARALLEL }, worker));
    setUploading(false);
    setPhotosKey((k) => k + 1);
  }

  function clearList() {
    setQueue([]);
    setUploadedBytes(0);
    setLastPreview((old) => {
      if (old) URL.revokeObjectURL(old);
      return null;
    });
  }

  const total = queue.length;
  const doneCount = queue.filter((q) => q.status === "done").length;
  const errorCount = queue.filter((q) => q.status === "error").length;
  const leftCount = queue.filter((q) => q.status === "waiting" || q.status === "error").length;
  const pickedBytes = queue.reduce((s, q) => s + q.file.size, 0);
  const failed = queue.filter((q) => q.status === "error");

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold">Gallery Management</h1>
        <p className="text-gray-400 mt-1">
          Upload event photos, compressed to web quality on your phone before saving
        </p>
      </div>

      <div className="mb-6">
        <label className="block text-sm text-gray-400 mb-2">
          Select Gallery
        </label>
        <select
          value={selectedGalleryId}
          onChange={(e) => setSelectedGalleryId(e.target.value)}
          className="w-full sm:w-96 bg-dark-500 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:border-gold-500 focus:outline-none transition-colors"
        >
          {galleries.length === 0 ? (
            <option value="">No galleries yet, create one below</option>
          ) : (
            galleries.map((g) => (
              <option key={g.id} value={g.id}>
                {g.title}
                {g.is_public ? "" : " (hidden)"}
              </option>
            ))
          )}
        </select>

        {!creating ? (
          <button
            type="button"
            onClick={() => {
              setCreating(true);
              setCreateMessage(null);
            }}
            className="mt-3 text-sm text-gold-500 hover:text-gold-400 inline-flex items-center gap-1.5"
          >
            <Plus size={14} />
            New gallery
          </button>
        ) : (
          <div className="mt-4 bg-dark-500 border border-gold-500/20 rounded-2xl p-5 space-y-4 sm:w-96">
            <h2 className="font-bold">New gallery</h2>
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Event (optional)</label>
              <select
                value={newEventId}
                onChange={(e) => pickNewEvent(e.target.value)}
                className="w-full bg-dark-300 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-gold-500 focus:outline-none"
              >
                <option value="">Not linked to an event</option>
                {events.map((e) => (
                  <option key={e.id} value={e.id}>
                    {eventLabel(e)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Title</label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                maxLength={120}
                placeholder="Tsakani Spring Cleaning"
                className="w-full bg-dark-300 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-gold-500 focus:outline-none"
              />
            </div>
            <p className="text-xs text-gray-500">
              New galleries start hidden. Turn on Public visibility once the photos are in.
            </p>
            {createMessage && <p className="text-xs text-amber-400">{createMessage}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={createGallery}
                disabled={savingNew}
                className="bg-gold-gradient text-black font-semibold px-4 py-2 rounded-lg inline-flex items-center gap-1.5 hover:opacity-90 disabled:opacity-40"
              >
                {savingNew ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                Create
              </button>
              <button
                type="button"
                onClick={() => setCreating(false)}
                className="text-sm text-gray-400 hover:text-white border border-white/10 px-4 py-2 rounded-lg"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {selectedGallery && (
        <div className="bg-dark-500 border border-white/10 rounded-2xl p-5 sm:p-6 mb-6 space-y-5">
          <div>
            <h2 className="font-bold text-lg mb-1">Gallery Settings</h2>
            <p className="text-xs text-gray-500">
              Controls visibility on the public site for this gallery.
            </p>
          </div>

          <div className="flex items-start justify-between gap-4 pb-5 border-b border-white/5">
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm mb-0.5 flex items-center gap-2">
                {selectedGallery.is_public ? (
                  <Eye size={14} className="text-green-400" />
                ) : (
                  <EyeOff size={14} className="text-gray-500" />
                )}
                Public visibility
              </p>
              <p className="text-xs text-gray-500">
                {selectedGallery.is_public
                  ? "Visible on /gallery — preview photos appear publicly."
                  : "Hidden from /gallery. Only you can see it."}
              </p>
            </div>
            <button
              type="button"
              onClick={togglePublic}
              disabled={savingSettings}
              className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${
                selectedGallery.is_public ? "bg-green-500" : "bg-white/10"
              } ${savingSettings ? "opacity-50 cursor-not-allowed" : ""}`}
              aria-label="Toggle public visibility"
              role="switch"
              aria-checked={selectedGallery.is_public}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                  selectedGallery.is_public ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          <div className="pb-5 border-b border-white/5">
            <label className="block text-sm font-semibold mb-1.5">Linked event</label>
            <p className="text-xs text-gray-500 mb-2">
              The event these photos are from.
            </p>
            <select
              value={selectedGallery.event_id || ""}
              onChange={(e) => patchGallery({ event_id: e.target.value || null })}
              disabled={savingSettings}
              className="w-full bg-dark-300 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-gold-500 focus:outline-none disabled:opacity-50"
            >
              <option value="">Not linked to an event</option>
              {events.map((e) => (
                <option key={e.id} value={e.id}>
                  {eventLabel(e)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1.5">
              Google Drive album URL
            </label>
            <p className="text-xs text-gray-500 mb-2">
              Optional. Shown as a &quot;Full album on Drive&quot; button on the gallery section.
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="url"
                value={driveUrl}
                onChange={(e) => setDriveUrl(e.target.value)}
                placeholder="https://drive.google.com/drive/folders/..."
                className="flex-1 bg-dark-300 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-gold-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={saveDriveUrl}
                disabled={savingSettings || driveUrl === selectedGallery.drive_url}
                className="bg-gold-gradient text-black font-semibold px-4 py-2 rounded-lg inline-flex items-center justify-center gap-1.5 hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity whitespace-nowrap"
              >
                {savingSettings ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Save size={14} />
                )}
                Save
              </button>
              {selectedGallery.drive_url && (
                <a
                  href={selectedGallery.drive_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="border border-white/10 hover:border-gold-500/30 text-gray-300 px-3 py-2 rounded-lg inline-flex items-center justify-center gap-1.5 transition-colors"
                  aria-label="Open Drive folder"
                >
                  <ExternalLink size={14} />
                </a>
              )}
            </div>
          </div>

          {settingsMessage && (
            <p className="text-xs text-amber-400">{settingsMessage}</p>
          )}
        </div>
      )}

      <div className="bg-dark-500 border border-white/10 rounded-2xl p-5 sm:p-6 mb-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm mb-0.5 flex items-center gap-2">
              <Stamp size={14} className={brandOn ? "text-gold-500" : "text-gray-500"} />
              Add logo to photos
            </p>
            <p className="text-xs text-gray-500">
              {brandOn
                ? "Every photo you upload gets the logo below, bottom centre."
                : "Photos upload as they are, with no logo."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setBrand(!brandOn)}
            disabled={uploading}
            className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${
              brandOn ? "bg-green-500" : "bg-white/10"
            } ${uploading ? "opacity-50 cursor-not-allowed" : ""}`}
            aria-label="Add logo to photos"
            role="switch"
            aria-checked={brandOn}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                brandOn ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>

        {brandOn && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {logos.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => setLogoId(l.id)}
                  disabled={uploading}
                  aria-pressed={l.id === logoId}
                  className={`relative rounded-xl border-2 p-3 text-left transition-colors bg-gradient-to-br from-zinc-700 to-zinc-900 ${
                    l.id === logoId ? "border-gold-500" : "border-white/10 hover:border-white/30"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={l.src} alt={l.name} className="h-16 w-full object-contain" />
                  <p className="mt-2 text-[11px] text-gray-300 truncate">{l.name}</p>
                  {l.is_default && (
                    <span className="absolute top-1.5 right-1.5 text-[10px] bg-gold-500 text-black font-semibold px-1.5 py-0.5 rounded">
                      Default
                    </span>
                  )}
                </button>
              ))}
              <button
                type="button"
                onClick={() => logoInputRef.current?.click()}
                disabled={logoBusy || uploading}
                className="rounded-xl border-2 border-dashed border-white/15 hover:border-gold-500/40 p-3 flex flex-col items-center justify-center gap-1 text-xs text-gray-400 min-h-[104px] disabled:opacity-50"
              >
                {logoBusy ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
                Add a logo
              </button>
              <input
                ref={logoInputRef}
                type="file"
                accept="image/png,image/webp"
                className="hidden"
                onChange={(e) => addLogo(e.target.files?.[0])}
              />
            </div>

            {chosenLogo && !uploading && (
              <div className="flex flex-wrap gap-2">
                {!chosenLogo.is_default && (
                  <button
                    type="button"
                    onClick={() => logoAction("PATCH", chosenLogo.id)}
                    disabled={logoBusy}
                    className="text-xs border border-white/10 hover:border-gold-500/40 text-gray-300 px-3 py-1.5 rounded-lg inline-flex items-center gap-1.5"
                  >
                    <Star size={12} />
                    Make default
                  </button>
                )}
                {!chosenLogo.is_default && (
                  <button
                    type="button"
                    onClick={() => logoAction("DELETE", chosenLogo.id)}
                    disabled={logoBusy}
                    className="text-xs border border-white/10 hover:border-red-500/40 text-gray-400 px-3 py-1.5 rounded-lg inline-flex items-center gap-1.5"
                  >
                    <Trash2 size={12} />
                    Delete
                  </button>
                )}
              </div>
            )}

            <p className="text-xs text-gray-500">
              Use a PNG with a transparent background, under 2 MB. The default logo is picked every time you open this page.
            </p>
          </>
        )}

        {logoMessage && <p className="text-xs text-amber-400">{logoMessage}</p>}
      </div>

      <div
        onDrop={(e) => {
          e.preventDefault();
          handleFiles(e.dataTransfer.files);
        }}
        onDragOver={(e) => e.preventDefault()}
        className="bg-dark-500 border-2 border-dashed border-white/10 hover:border-gold-500/30 rounded-2xl p-8 sm:p-12 text-center transition-colors cursor-pointer"
        onClick={() => fileInputRef.current?.click()}
        role="button"
        aria-label="Upload photos"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <div className="bg-gold-500/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
          <Upload size={28} className="text-gold-500" aria-hidden="true" />
        </div>
        <h3 className="text-lg font-bold mb-2">
          Drop photos here or click to browse
        </h3>
        <p className="text-gray-400 text-sm">
          Auto-optimized to ~1MB each · 2048px max · JPG output
        </p>
      </div>

      {total > 0 && (
        <div className="mt-6 bg-dark-500 border border-white/10 rounded-2xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold">
                {doneCount} of {total} photo{total !== 1 ? "s" : ""} uploaded
              </h3>
              <p className="text-xs text-gray-400 mt-1">
                {formatBytes(pickedBytes)} picked
                {uploadedBytes > 0 && <>, {formatBytes(uploadedBytes)} after compressing</>}
              </p>
            </div>
            <div className="flex gap-2">
              {!uploading && (
                <button
                  onClick={clearList}
                  className="text-sm text-gray-400 hover:text-white border border-white/10 px-4 py-2 rounded-lg transition-colors"
                >
                  Clear
                </button>
              )}
              {uploading ? (
                <button
                  onClick={() => (stopRef.current = true)}
                  className="text-sm text-white border border-white/20 px-4 py-2 rounded-lg inline-flex items-center gap-2"
                >
                  <Loader2 size={14} className="animate-spin" />
                  Pause
                </button>
              ) : (
                <button
                  onClick={uploadAll}
                  disabled={!selectedGalleryId || leftCount === 0}
                  className="bg-gold-gradient text-black font-semibold px-5 py-2 rounded-lg hover:opacity-90 transition-opacity flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Upload size={16} />
                  {errorCount > 0 && leftCount === errorCount ? "Retry" : "Upload"} {leftCount}
                </button>
              )}
            </div>
          </div>

          <div className="h-2 rounded-full bg-white/5 overflow-hidden">
            <div
              className="h-full bg-gold-gradient transition-all"
              style={{ width: `${total ? (doneCount / total) * 100 : 0}%` }}
            />
          </div>

          {uploading && (
            <p className="text-xs text-amber-400">
              Keep this screen open and your phone awake until it finishes. Pause and Upload carry on where it stopped.
            </p>
          )}

          {lastPreview && (
            <div className="flex items-center gap-3">
              <div className="relative w-16 h-16 rounded-lg overflow-hidden border border-green-500/40 shrink-0">
                <Image src={lastPreview} alt="Last uploaded photo" fill className="object-cover" sizes="64px" unoptimized />
              </div>
              <p className="text-xs text-gray-400 flex items-center gap-1.5">
                <CheckCircle2 size={14} className="text-green-400" />
                Last photo uploaded
              </p>
            </div>
          )}

          {failed.length > 0 && !uploading && (
            <div className="text-xs text-red-400 space-y-1">
              <p>{failed.length} did not upload. Tap Retry to try them again.</p>
              {failed.slice(0, 5).map((q) => (
                <p key={q.id} className="truncate text-gray-500">
                  {q.file.name}: {q.error}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {total === 0 && (
        <div className="mt-10 bg-dark-500 border border-white/10 rounded-xl p-8 text-center">
          <ImageIcon size={32} className="text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">
            Pick as many photos as you like. Each one is compressed on your phone and uploaded one by one.
          </p>
        </div>
      )}
      {selectedGallery && (
        <div className="mt-8">
          <PhotoManager galleryId={selectedGallery.id} refreshKey={photosKey} />
        </div>
      )}
    </div>
  );
}
