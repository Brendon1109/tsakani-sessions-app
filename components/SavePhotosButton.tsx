"use client";

import { useState } from "react";
import { Download, Loader2, Check } from "lucide-react";
import { fetchPhotos, saveFiles, shareFiles, type SavePhoto } from "@/lib/photo-download";

interface Props {
  /** Read at tap time, so a selection that changed is always current. */
  photos: () => SavePhoto[];
  zipName: string;
  label: string;
  className?: string;
  iconOnly?: boolean;
}

type State = "idle" | "working" | "tap" | "done" | "error";

export default function SavePhotosButton({ photos, zipName, label, className, iconOnly }: Props) {
  const [state, setState] = useState<State>("idle");
  const [ready, setReady] = useState<File[] | null>(null);

  async function finish(outcome: Awaited<ReturnType<typeof saveFiles>>) {
    if (outcome === "needs-tap") {
      setState("tap");
      return;
    }
    setReady(null);
    setState(outcome === "cancelled" ? "idle" : "done");
    if (outcome !== "cancelled") setTimeout(() => setState("idle"), 2500);
  }

  async function onClick(e: React.MouseEvent) {
    e.stopPropagation();
    if (state === "working") return;
    try {
      if (state === "tap" && ready) {
        // A fresh tap, so the share sheet is allowed now.
        await finish(await shareFiles(ready));
        return;
      }
      const list = photos();
      if (list.length === 0) return;
      setState("working");
      const files = await fetchPhotos(list);
      setReady(files);
      await finish(await saveFiles(files, zipName));
    } catch (err) {
      console.error("Save failed:", err);
      setReady(null);
      setState("error");
      setTimeout(() => setState("idle"), 3000);
    }
  }

  const text =
    state === "working"
      ? "Preparing..."
      : state === "tap"
        ? "Tap to save"
        : state === "done"
          ? "Saved"
          : state === "error"
            ? "Could not save, try again"
            : label;

  const icon =
    state === "working" ? (
      <Loader2 size={18} className="animate-spin" />
    ) : state === "done" ? (
      <Check size={18} />
    ) : (
      <Download size={18} />
    );

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={iconOnly ? text : undefined}
      aria-busy={state === "working"}
      className={className}
    >
      {icon}
      {(!iconOnly || state === "tap") && <span>{text}</span>}
    </button>
  );
}
