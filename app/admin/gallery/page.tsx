"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Upload, Image as ImageIcon, X, Loader2, CheckCircle2, Eye, EyeOff, Save, ExternalLink } from "lucide-react";
import { optimizePhoto, formatBytes, type OptimizedImage } from "@/lib/image-optimize";

interface Gallery {
  id: string;
  slug: string;
  title: string;
  event_id: string | null;
  is_public: boolean;
  drive_url: string;
}

interface ProcessedFile extends OptimizedImage {
  id: string;
  name: string;
  status: "ready" | "uploading" | "done" | "error";
  error?: string;
}

export default function AdminGalleryPage() {
  const [galleries, setGalleries] = useState<Gallery[]>([]);
  const [selectedGalleryId, setSelectedGalleryId] = useState("");
  const [files, setFiles] = useState<ProcessedFile[]>([]);
  const [optimizing, setOptimizing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [driveUrl, setDriveUrl] = useState("");
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedGallery = galleries.find((g) => g.id === selectedGalleryId);

  useEffect(() => {
    loadGalleries();
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

  async function patchGallery(patch: { is_public?: boolean; drive_url?: string }) {
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

  async function handleFiles(newFiles: FileList | null) {
    if (!newFiles || newFiles.length === 0) return;
    setOptimizing(true);

    const imageFiles = Array.from(newFiles).filter((f) =>
      f.type.startsWith("image/")
    );

    const processed: ProcessedFile[] = [];
    for (const f of imageFiles) {
      try {
        const optimized = await optimizePhoto(f);
        processed.push({
          ...optimized,
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          name: f.name,
          status: "ready",
        });
      } catch (err) {
        console.error("Optimize failed:", err);
        processed.push({
          file: f,
          originalSize: f.size,
          optimizedSize: f.size,
          preview: URL.createObjectURL(f),
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          name: f.name,
          status: "error",
          error: "Optimization failed — will upload original",
        });
      }
    }

    setFiles((prev) => [...prev, ...processed]);
    setOptimizing(false);
  }

  function removeFile(id: string) {
    setFiles((prev) => {
      const file = prev.find((f) => f.id === id);
      if (file) URL.revokeObjectURL(file.preview);
      return prev.filter((f) => f.id !== id);
    });
  }

  async function uploadAll() {
    if (!selectedGalleryId || files.length === 0) return;
    setUploading(true);

    // Upload in small parallel batches (3 at a time) to avoid overwhelming
    const batchSize = 3;
    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);
      await Promise.all(batch.map(uploadOne));
    }

    setUploading(false);
  }

  async function uploadOne(file: ProcessedFile) {
    setFiles((prev) =>
      prev.map((f) => (f.id === file.id ? { ...f, status: "uploading" } : f))
    );

    const formData = new FormData();
    formData.append("gallery_id", selectedGalleryId);
    formData.append("files", file.file, file.file.name);

    try {
      const res = await fetch("/api/gallery/upload", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        setFiles((prev) =>
          prev.map((f) => (f.id === file.id ? { ...f, status: "done" } : f))
        );
      } else {
        const data = await res.json().catch(() => ({}));
        setFiles((prev) =>
          prev.map((f) =>
            f.id === file.id
              ? { ...f, status: "error", error: data.error || "Upload failed" }
              : f
          )
        );
      }
    } catch {
      setFiles((prev) =>
        prev.map((f) =>
          f.id === file.id ? { ...f, status: "error", error: "Network error" } : f
        )
      );
    }
  }

  function clearDone() {
    setFiles((prev) => {
      prev.filter((f) => f.status === "done").forEach((f) =>
        URL.revokeObjectURL(f.preview)
      );
      return prev.filter((f) => f.status !== "done");
    });
  }

  const totalOriginal = files.reduce((s, f) => s + f.originalSize, 0);
  const totalOptimized = files.reduce((s, f) => s + f.optimizedSize, 0);
  const savings = totalOriginal > 0 ? 1 - totalOptimized / totalOriginal : 0;

  const readyCount = files.filter((f) => f.status === "ready").length;
  const doneCount = files.filter((f) => f.status === "done").length;
  const errorCount = files.filter((f) => f.status === "error").length;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold">Gallery Management</h1>
        <p className="text-gray-400 mt-1">
          Upload event photos — auto-optimized to web quality before saving
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
            <option value="">No galleries found — create an event first</option>
          ) : (
            galleries.map((g) => (
              <option key={g.id} value={g.id}>
                {g.title}
              </option>
            ))
          )}
        </select>
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

      {optimizing && (
        <div className="mt-4 bg-gold-500/5 border border-gold-500/20 rounded-xl p-4 flex items-center gap-3">
          <Loader2 size={18} className="text-gold-500 animate-spin" />
          <p className="text-sm text-gray-300">
            Optimizing photos in your browser... no server involved
          </p>
        </div>
      )}

      {files.length > 0 && (
        <div className="mt-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="font-semibold">
                {files.length} photo{files.length !== 1 ? "s" : ""} ready
                {doneCount > 0 && (
                  <span className="text-green-400 text-sm ml-2">
                    ({doneCount} uploaded)
                  </span>
                )}
                {errorCount > 0 && (
                  <span className="text-red-400 text-sm ml-2">
                    ({errorCount} failed)
                  </span>
                )}
              </h3>
              {savings > 0 && (
                <p className="text-xs text-gray-400 mt-1">
                  {formatBytes(totalOriginal)} → {formatBytes(totalOptimized)}{" "}
                  <span className="text-gold-500">
                    ({Math.round(savings * 100)}% smaller)
                  </span>
                </p>
              )}
            </div>
            <div className="flex gap-2">
              {doneCount > 0 && (
                <button
                  onClick={clearDone}
                  className="text-sm text-gray-400 hover:text-white border border-white/10 px-4 py-2 rounded-lg transition-colors"
                >
                  Clear uploaded
                </button>
              )}
              <button
                onClick={uploadAll}
                disabled={uploading || !selectedGalleryId || readyCount === 0}
                className="bg-gold-gradient text-black font-semibold px-6 py-2.5 rounded-lg hover:opacity-90 transition-opacity flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {uploading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload size={16} />
                    Upload {readyCount} photo{readyCount !== 1 ? "s" : ""}
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
            {files.map((file) => (
              <div
                key={file.id}
                className={`relative aspect-square rounded-xl overflow-hidden border-2 group ${
                  file.status === "done"
                    ? "border-green-500/40"
                    : file.status === "error"
                    ? "border-red-500/40"
                    : file.status === "uploading"
                    ? "border-gold-500/40"
                    : "border-white/10"
                }`}
              >
                <Image
                  src={file.preview}
                  alt={file.name}
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 16vw"
                  unoptimized
                />

                {file.status === "uploading" && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                    <Loader2 size={28} className="text-gold-500 animate-spin" />
                  </div>
                )}

                {file.status === "done" && (
                  <div className="absolute top-2 left-2 bg-green-500 text-white rounded-full p-1">
                    <CheckCircle2 size={14} />
                  </div>
                )}

                {file.status !== "done" && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFile(file.id);
                    }}
                    className="absolute top-2 right-2 bg-black/60 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label={`Remove ${file.name}`}
                  >
                    <X size={14} />
                  </button>
                )}

                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-2">
                  <p className="text-[10px] text-white truncate">
                    {formatBytes(file.optimizedSize)}
                    {file.originalSize !== file.optimizedSize && (
                      <span className="text-gray-400">
                        {" "}(was {formatBytes(file.originalSize)})
                      </span>
                    )}
                  </p>
                  {file.error && (
                    <p className="text-[9px] text-red-400 truncate">{file.error}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {files.length === 0 && (
        <div className="mt-10 bg-dark-500 border border-white/10 rounded-xl p-8 text-center">
          <ImageIcon size={32} className="text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">
            Drop photos to start. They&apos;ll be compressed locally before upload.
          </p>
        </div>
      )}
    </div>
  );
}
