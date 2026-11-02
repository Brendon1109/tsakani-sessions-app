"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Loader2, Trash2, X, CheckSquare } from "lucide-react";

interface Photo {
  id: string;
  url: string;
}

/** Enough to scroll through, few enough that a phone only loads what it shows. */
const PAGE = 30;

export default function PhotoManager({
  galleryId,
  refreshKey,
}: {
  galleryId: string;
  /** Bump to reload, after an upload finishes. */
  refreshKey: number;
}) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [shown, setShown] = useState(PAGE);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/gallery-photos?gallery_id=${galleryId}`);
      const data = await res.json().catch(() => []);
      setPhotos(res.ok && Array.isArray(data) ? data : []);
      if (!res.ok) setMessage(data.error || "Could not load the photos");
    } finally {
      setLoading(false);
    }
  }, [galleryId]);

  useEffect(() => {
    setShown(PAGE);
    setSelecting(false);
    setSelected(new Set());
    setMessage(null);
    load();
  }, [load, refreshKey]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const visible = photos.slice(0, shown);
  const allVisibleSelected = visible.length > 0 && visible.every((p) => selected.has(p.id));

  function toggleAllVisible() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) visible.forEach((p) => next.delete(p.id));
      else visible.forEach((p) => next.add(p.id));
      return next;
    });
  }

  async function remove(ids: string[]) {
    if (ids.length === 0) return;
    const ok = confirm(
      ids.length === 1
        ? "Delete this photo? It comes off the site and cannot be brought back."
        : `Delete ${ids.length} photos? They come off the site and cannot be brought back.`
    );
    if (!ok) return;
    setDeleting(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/gallery-photos", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(data.error || "Delete failed");
        return;
      }
      const gone = new Set(ids);
      setPhotos((prev) => prev.filter((p) => !gone.has(p.id)));
      setSelected(new Set());
      setSelecting(false);
      setMessage(`${data.deleted} photo${data.deleted === 1 ? "" : "s"} deleted.`);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="bg-dark-500 border border-white/10 rounded-2xl p-5 sm:p-6 mb-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="font-bold text-lg">Photos in this gallery</h2>
          <p className="text-xs text-gray-500">
            {loading ? "Loading..." : `${photos.length} photo${photos.length === 1 ? "" : "s"}`}
          </p>
        </div>
        {photos.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {selecting && (
              <button
                type="button"
                onClick={toggleAllVisible}
                className="text-sm text-gray-300 border border-white/10 px-3 py-2 rounded-lg"
              >
                {allVisibleSelected ? "Unselect shown" : "Select shown"}
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setSelecting(!selecting);
                setSelected(new Set());
              }}
              className="text-sm text-gray-300 border border-white/10 px-3 py-2 rounded-lg inline-flex items-center gap-1.5"
            >
              {selecting ? <X size={14} /> : <CheckSquare size={14} />}
              {selecting ? "Cancel" : "Select"}
            </button>
            {selecting && (
              <button
                type="button"
                onClick={() => remove([...selected])}
                disabled={selected.size === 0 || deleting}
                className="text-sm bg-red-600 hover:bg-red-500 text-white font-semibold px-3 py-2 rounded-lg inline-flex items-center gap-1.5 disabled:opacity-40"
              >
                {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                Delete {selected.size || ""}
              </button>
            )}
          </div>
        )}
      </div>

      {message && <p className="text-xs text-amber-400 mb-3">{message}</p>}

      {!loading && photos.length === 0 && (
        <p className="text-sm text-gray-500">No photos yet. Upload some below.</p>
      )}

      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
        {visible.map((p) => {
          const on = selected.has(p.id);
          return (
            <div
              key={p.id}
              className={`relative aspect-square rounded-lg overflow-hidden border-2 ${
                on ? "border-red-500" : "border-transparent"
              }`}
            >
              <button
                type="button"
                onClick={() => (selecting ? toggle(p.id) : window.open(p.url, "_blank", "noopener"))}
                aria-pressed={selecting ? on : undefined}
                aria-label={selecting ? "Select photo" : "Open photo"}
                className="absolute inset-0"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
              </button>
              {selecting ? (
                <span
                  className={`pointer-events-none absolute top-1.5 right-1.5 w-6 h-6 rounded-full flex items-center justify-center border-2 ${
                    on ? "bg-red-500 border-red-500 text-white" : "bg-black/40 border-white/70"
                  }`}
                >
                  {on && <Check size={14} />}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => remove([p.id])}
                  disabled={deleting}
                  aria-label="Delete photo"
                  className="absolute top-1.5 right-1.5 bg-black/60 hover:bg-red-600 text-white p-1.5 rounded-full"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {shown < photos.length && (
        <button
          type="button"
          onClick={() => setShown((n) => n + PAGE)}
          className="mt-4 w-full text-sm text-gray-300 border border-white/10 hover:border-gold-500/30 py-2.5 rounded-lg"
        >
          Show more ({photos.length - shown} left)
        </button>
      )}
    </div>
  );
}
