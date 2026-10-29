"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Share2, X } from "lucide-react";
import Arena from "@/components/bat-rush/Arena";
import Leaderboard, { type Board } from "@/components/bat-rush/Leaderboard";
import { fetchBoard, setHandle, submitAura } from "@/components/bat-rush/api";
import { storyCard, shareOrDownload } from "@/components/bat-rush/cards";
import { InstagramIcon } from "@/components/SocialIcons";
import { createClient } from "@/lib/supabase/client";
import { track } from "@/lib/analytics";
import { auraBucket, rankFor, SCORE_CAP, POINTS } from "@/lib/bat-rush/rules";
import {
  BAT_RUSH_EVENT_SLUG,
  GAME_PATH,
  GUEST_BEST_KEY,
  INSTAGRAM_HANDLE,
  INSTAGRAM_URL,
} from "@/lib/bat-rush/config";
import { normaliseHandle } from "@/lib/bat-rush/handle";
import { chromeIntentUrl, inAppBrowser, isAndroid, isIOS } from "@/lib/bat-rush/in-app";
import { decodeCarry, encodeCarry } from "@/lib/bat-rush/carry";
import { BAT_PATH, GOLD, NIGHT, PUMPKIN } from "@/lib/bat-rush/shapes";

/**
 * Bat Rush. Plays with no sign in. Saving needs Google, and a guest's best
 * round waits in localStorage until they come back signed in, then saves by
 * itself. Inside Instagram or Facebook, where Google refuses to sign anyone
 * in, Save sends them to Chrome or Safari first and their aura goes with them
 * in the address. A carried aura never saves by itself: the player taps Save
 * on the other side.
 *
 * Every save is tagged with the round on screen when it was sent, so an
 * answer that comes back after Play again is never shown against the new
 * round.
 */

type Stage = "home" | "play" | "over";

interface Saved {
  s: "saved";
  round: string;
  rank: number;
  best: number;
  name: string;
}

type Save =
  | { s: "idle" }
  | { s: "saving" }
  | { s: "handle"; aura: number; bad?: boolean }
  | Saved
  | { s: "edit"; back: Saved; bad?: boolean }
  | { s: "closed" }
  | { s: "soon"; aura: number }
  | { s: "error"; aura: number }
  | { s: "inapp"; url: string; android: boolean; ios: boolean };

interface GuestBest {
  aura: number;
  at: number;
  /** Came from another browser in the address. Waits for a tap. */
  carried?: boolean;
}

/** Taps landing this soon after zero are a thumb still playing, not a choice. */
const ARM_MS = 700;
/** The story card is drawn after the reveal, so it never stutters it. */
const STORY_DELAY_MS = 900;

function readBest(): GuestBest | null {
  try {
    const v = JSON.parse(localStorage.getItem(GUEST_BEST_KEY) || "null");
    if (
      v &&
      Number.isInteger(v.aura) &&
      v.aura >= 0 &&
      v.aura <= SCORE_CAP &&
      typeof v.at === "number"
    ) {
      return { aura: v.aura, at: v.at, carried: v.carried === true };
    }
  } catch {
    // Private mode or a broken value. No best, then.
  }
  return null;
}

function writeBest(best: GuestBest | null) {
  try {
    if (best) localStorage.setItem(GUEST_BEST_KEY, JSON.stringify(best));
    else localStorage.removeItem(GUEST_BEST_KEY);
  } catch {
    // Nothing to do. The score still shows, it just will not wait for sign in.
  }
}

export default function BatRushGame() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("home");
  const [run, setRun] = useState(0);
  const [aura, setAura] = useState(0);
  const [armed, setArmed] = useState(false);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [guestBest, setGuestBest] = useState<GuestBest | null>(null);
  const [board, setBoard] = useState<Board | null>(null);
  const [boardLoading, setBoardLoading] = useState(true);
  const [save, setSave] = useState<Save>({ s: "idle" });
  const [story, setStory] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [env, setEnv] = useState({ font: "system-ui, sans-serif", calm: false, inApp: false });
  const signedInRef = useRef<boolean | null>(null);
  const boardRef = useRef<Board | null>(null);
  const runRef = useRef(0);
  const envRef = useRef(env);
  const timers = useRef<number[]>([]);
  const playButton = useRef<HTMLButtonElement>(null);
  const resultCard = useRef<HTMLDivElement>(null);

  useEffect(() => {
    envRef.current = env;
  }, [env]);

  const loadBoard = useCallback(async () => {
    const supabase = createClient();
    if (!supabase) {
      setBoardLoading(false);
      return null;
    }
    setBoardLoading(true);
    const next = await fetchBoard(supabase, BAT_RUSH_EVENT_SLUG, Date.now());
    boardRef.current = next;
    setBoard(next);
    setBoardLoading(false);
    return next;
  }, []);

  const keepAsGuestBest = useCallback((value: number) => {
    const prev = readBest();
    const round = boardRef.current?.round;
    const stale =
      !!prev && !!round && boardRef.current?.status === "open" && prev.at < Date.parse(round.opens_at);
    // A carried best stays carried, and so waits for a tap, unless beaten here.
    if (!prev || stale || value > prev.aura) {
      const next = { aura: value, at: Date.now() };
      writeBest(next);
      setGuestBest(next);
    }
  }, []);

  const submit = useCallback(
    async (value: number, answer?: { handle: string | null; show: boolean }) => {
      const supabase = createClient();
      if (!supabase) return;
      const sentDuring = runRef.current;
      setSave({ s: "saving" });
      const result = await submitAura(supabase, {
        slug: BAT_RUSH_EVENT_SLUG,
        aura: value,
        handle: answer?.handle ?? null,
        showHandle: answer ? answer.show : null,
      });
      const stale = runRef.current !== sentDuring;

      if (result.ok) {
        const best = readBest();
        if (best && best.aura <= value) {
          writeBest(null);
          setGuestBest(null);
        }
        track("bat_rush_saved", { round: result.round });
        loadBoard();
        if (!stale) {
          setSave({ s: "saved", round: result.round, rank: result.rank, best: result.best, name: result.name });
        }
        return;
      }

      if (result.reason === "signed_out") {
        // The session ran out. Keep the score so it waits for sign in.
        signedInRef.current = false;
        setSignedIn(false);
        keepAsGuestBest(value);
      }
      if (stale) return;

      switch (result.reason) {
        case "need_handle":
          setSave({ s: "handle", aura: value });
          break;
        case "bad_handle":
          setSave({ s: "handle", aura: value, bad: true });
          break;
        case "closed":
          setSave({ s: "closed" });
          break;
        case "too_soon":
          setSave({ s: "soon", aura: value });
          break;
        case "signed_out":
          setSave({ s: "idle" });
          break;
        default:
          setSave({ s: "error", aura: value });
      }
    },
    [loadBoard, keepAsGuestBest],
  );

  // First visit: read the phone, the address and the session, then load the
  // board, and save a guest's best by itself if they just came back signed in.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ua = navigator.userAgent;
      const nextEnv = {
        font: getComputedStyle(document.body).fontFamily || "system-ui, sans-serif",
        calm: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
        inApp: inAppBrowser(ua) !== null,
      };

      let best = readBest();
      const params = new URLSearchParams(window.location.search);
      if (params.has("carry")) {
        const carried = decodeCarry(params.get("carry"), Date.now());
        params.delete("carry");
        const rest = params.toString();
        window.history.replaceState(null, "", `${window.location.pathname}${rest ? `?${rest}` : ""}`);
        if (carried && (!best || carried.aura > best.aura)) {
          best = { aura: carried.aura, at: carried.at, carried: true };
          writeBest(best);
        }
      }

      const supabase = createClient();
      const [session, current] = await Promise.all([
        supabase ? supabase.auth.getSession().then(({ data }) => data.session) : Promise.resolve(null),
        loadBoard(),
      ]);
      if (cancelled) return;

      // A best from an earlier round stays with that round.
      if (best && current?.round && current.status === "open" && best.at < Date.parse(current.round.opens_at)) {
        writeBest(null);
        best = null;
      }

      signedInRef.current = !!session;
      setEnv(nextEnv);
      setSignedIn(!!session);
      setGuestBest(best);

      if (session && best && !best.carried && current?.status === "open") {
        submit(best.aura);
      }
    })();
    const pending = timers.current;
    return () => {
      cancelled = true;
      pending.forEach((t) => window.clearTimeout(t));
    };
  }, [loadBoard, submit]);

  // No page scroll, pull to refresh or bounce behind the game.
  useEffect(() => {
    const root = document.documentElement;
    if (stage === "home") root.removeAttribute("data-bat-rush-lock");
    else root.setAttribute("data-bat-rush-lock", "");
    return () => root.removeAttribute("data-bat-rush-lock");
  }, [stage]);

  // Focus follows the screen: the result once it can be tapped, PLAY back home.
  useEffect(() => {
    if (stage === "over" && armed) resultCard.current?.focus({ preventScroll: true });
  }, [stage, armed]);

  const clearTimers = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current.length = 0;
  };

  const play = () => {
    clearTimers();
    (document.activeElement as HTMLElement | null)?.blur?.();
    runRef.current += 1;
    setRun(runRef.current);
    setStory(null);
    setArmed(false);
    setSave({ s: "idle" });
    setStage("play");
  };

  const goHome = () => {
    setStage("home");
    window.setTimeout(() => playButton.current?.focus({ preventScroll: true }), 0);
  };

  const onStart = useCallback(() => track("bat_rush_start"), []);

  const onDone = useCallback(
    ({ aura: value }: { aura: number }) => {
      const thisRun = runRef.current;
      setAura(value);
      setArmed(false);
      setStage("over");
      track("bat_rush_end", { bucket: auraBucket(value), rank: rankFor(value) });
      if (!signedInRef.current) keepAsGuestBest(value);
      loadBoard();

      timers.current.push(window.setTimeout(() => setArmed(true), ARM_MS));
      timers.current.push(
        window.setTimeout(() => {
          storyCard({ aura: value, rank: rankFor(value), font: envRef.current.font })
            .then((blob) => {
              if (runRef.current === thisRun) setStory(blob);
            })
            .catch(() => undefined);
        }, STORY_DELAY_MS),
      );
    },
    [loadBoard, keepAsGuestBest],
  );

  const saveAura = (value: number) => {
    // A carried aura is confirmed by this tap, so it may save itself after sign in.
    const held = readBest();
    if (held?.carried) {
      const confirmed = { aura: held.aura, at: held.at };
      writeBest(confirmed);
      setGuestBest(confirmed);
    }
    if (signedIn) {
      submit(value);
      return;
    }
    const carry = held?.aura ?? value;
    if (env.inApp) {
      const url = new URL(window.location.href);
      url.searchParams.set("carry", encodeCarry(carry, Date.now()));
      window.history.replaceState(null, "", `${url.pathname}${url.search}`);
      const ua = navigator.userAgent;
      setSave({ s: "inapp", url: url.href, android: isAndroid(ua), ios: isIOS(ua) });
      return;
    }
    track("bat_rush_signin");
    router.push(`/auth/signin?redirectTo=${encodeURIComponent(GAME_PATH)}`);
  };

  const answerHandle = (answer: { handle: string | null; show: boolean }) => {
    if (save.s === "handle") submit(save.aura, answer);
    if (save.s === "edit") changeHandle(save.back, answer);
  };

  const changeHandle = async (back: Saved, answer: { handle: string | null; show: boolean }) => {
    const supabase = createClient();
    if (!supabase) return;
    const result = await setHandle(supabase, { slug: BAT_RUSH_EVENT_SLUG, ...answer });
    if (result.ok) {
      setSave({ ...back, name: result.name });
      loadBoard();
    } else if (result.reason === "bad_handle") {
      setSave({ s: "edit", back, bad: true });
    } else {
      setSave(back);
    }
  };

  const postStory = async () => {
    if (!story) return;
    // In-app browsers cannot share or download a file. Show it to long press.
    if (env.inApp) {
      setPreview(URL.createObjectURL(story));
      track("bat_rush_share", { method: "preview" });
      return;
    }
    const how = await shareOrDownload(story, "tsakani-bat-rush.jpg");
    if (how !== "cancel") track("bat_rush_share", { method: how });
  };

  const closePreview = () => {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
  };

  const follow = () => track("bat_rush_instagram");

  const pending = guestBest && save.s !== "saved" && save.s !== "edit" ? guestBest : null;

  return (
    <>
      <section
        className="relative overflow-hidden px-4 pt-8 pb-16 min-h-[calc(100svh-4rem)]"
        inert={stage !== "home"}
        aria-hidden={stage !== "home"}
      >
        <div aria-hidden className="bat-rush-sky absolute inset-0" />
        <div
          aria-hidden
          className="halloween-moon absolute top-1 right-[3%] w-10 h-10 sm:w-16 sm:h-16 rounded-full opacity-60"
        />
        <div className="relative max-w-md mx-auto text-center">
          <p className="text-xs font-bold tracking-[0.3em] text-gold-500">TSAKANI HALLOWEEN</p>
          <h1 className="mt-2 text-6xl sm:text-7xl font-black tracking-tight leading-none">
            BAT <span className="text-gold-gradient">RUSH</span>
          </h1>
          <p className="mt-3 text-lg text-gray-300">Tap bats. Dodge pumpkins. 30 seconds.</p>

          <ul className="mt-6 grid grid-cols-3 gap-2" aria-label="Points">
            <li className="rounded-2xl bg-white/[0.05] border border-white/10 py-3 flex flex-col items-center gap-1.5">
              <BatIcon />
              <span className="font-black">+{POINTS.bat}</span>
            </li>
            <li className="rounded-2xl bg-[#ffd700]/10 border border-[#ffd700]/30 py-3 flex flex-col items-center gap-1.5">
              <BatIcon gold />
              <span className="font-black text-[#ffd700]">+{POINTS.gold}</span>
            </li>
            <li className="rounded-2xl bg-white/[0.05] border border-white/10 py-3 flex flex-col items-center gap-1.5">
              <PumpkinIcon />
              <span className="font-black text-[#ff6b6b]">{"−"}{-POINTS.pumpkin}</span>
            </li>
          </ul>

          <button
            ref={playButton}
            type="button"
            onClick={play}
            className="mt-7 w-full h-16 rounded-full bg-gold-gradient text-black text-2xl font-black tracking-wide active:scale-[0.98] transition-transform"
          >
            PLAY
          </button>

          {(pending || save.s !== "idle") && (
            <div className="mt-5 rounded-3xl border border-white/10 bg-white/[0.04] p-4">
              {pending && save.s === "idle" && (
                <p className="text-gray-300 mb-3">
                  Your best: <span className="font-black text-white">{pending.aura}</span> aura
                </p>
              )}
              <SavePanel
                save={save}
                signedIn={signedIn}
                onSave={() => saveAura(pending?.aura ?? aura)}
                onAnswer={answerHandle}
                onEdit={(back) => setSave({ s: "edit", back })}
              />
            </div>
          )}

          <div className="mt-5">
            <Leaderboard board={board} loading={boardLoading} onRefresh={loadBoard} />
          </div>

          <FollowButton onClick={follow} className="mt-5" />
        </div>
      </section>

      {stage !== "home" && (
        <div className="fixed inset-0 z-[60] bg-black">
          <Arena key={run} font={env.font} calm={env.calm} onStart={onStart} onDone={onDone} />

          {stage === "over" && (
            <div
              className={`absolute inset-0 overflow-y-auto overscroll-contain ${armed ? "" : "pointer-events-none"}`}
            >
              <div className="min-h-full flex flex-col justify-end px-4 pt-28 pb-[max(env(safe-area-inset-bottom),20px)]">
                <div
                  ref={resultCard}
                  tabIndex={-1}
                  aria-live="polite"
                  className="bat-rush-reveal w-full max-w-md mx-auto rounded-3xl border border-white/10 bg-black/80 p-5 text-center outline-none"
                >
                  <p className="text-xs font-bold tracking-[0.3em] text-gray-400">AURA</p>
                  <p className="text-8xl font-black tabular-nums leading-none mt-1 drop-shadow-[0_0_24px_rgba(255,138,31,0.55)]">
                    {aura}
                  </p>
                  <p className="mt-2 text-3xl font-black text-[#ff8a1f]">{rankFor(aura)}</p>

                  <div className="mt-5">
                    <SavePanel
                      save={save}
                      signedIn={signedIn}
                      onSave={() => saveAura(aura)}
                      onAnswer={answerHandle}
                      onEdit={(back) => setSave({ s: "edit", back })}
                    />
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={postStory}
                      disabled={!story}
                      className="h-14 rounded-2xl border border-white/20 font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <Share2 size={18} className="hidden min-[380px]:block shrink-0" /> Post your aura
                    </button>
                    <FollowButton onClick={follow} compact />
                  </div>
                  <p className="mt-2 text-sm text-gray-400">Tag @{INSTAGRAM_HANDLE} on your story</p>

                  <button
                    type="button"
                    onClick={play}
                    className="mt-4 w-full h-14 rounded-full border border-white/25 text-white text-xl font-black"
                  >
                    Play again
                  </button>
                  <button type="button" onClick={goHome} className="mt-2 w-full h-12 text-gray-400 font-semibold">
                    Done
                  </button>
                </div>

                <div className="w-full max-w-md mx-auto mt-4">
                  <Leaderboard board={board} loading={boardLoading} onRefresh={loadBoard} />
                </div>
              </div>
            </div>
          )}

          {preview && (
            <div className="absolute inset-0 z-10 bg-black/95 flex flex-col items-center justify-center px-6 py-8">
              <button
                type="button"
                onClick={closePreview}
                aria-label="Close"
                className="absolute top-4 right-4 w-11 h-11 rounded-full border border-white/20 flex items-center justify-center"
              >
                <X size={20} />
              </button>
              {/* eslint-disable-next-line @next/next/no-img-element -- a blob: URL from a canvas, next/image cannot load it */}
              <img src={preview} alt="Your Bat Rush story card" className="max-h-[70svh] w-auto rounded-2xl" />
              <p className="mt-4 text-lg font-bold text-center">Long press the picture to save it</p>
              <p className="text-gray-400 text-center">Then post it and tag @{INSTAGRAM_HANDLE}</p>
            </div>
          )}
        </div>
      )}
    </>
  );
}

function SavePanel({
  save,
  signedIn,
  onSave,
  onAnswer,
  onEdit,
}: {
  save: Save;
  signedIn: boolean | null;
  onSave: () => void;
  onAnswer: (answer: { handle: string | null; show: boolean }) => void;
  onEdit: (back: Saved) => void;
}) {
  const primary =
    "w-full h-14 rounded-full bg-gold-gradient text-black text-lg font-black disabled:opacity-60 active:scale-[0.98] transition-transform";

  switch (save.s) {
    case "saving":
      return (
        <button type="button" disabled className={primary}>
          Saving
        </button>
      );
    case "handle":
      return <HandleForm bad={!!save.bad} onAnswer={onAnswer} submitLabel="Save" />;
    case "edit":
      return <HandleForm bad={!!save.bad} onAnswer={onAnswer} submitLabel="Update" />;
    case "saved":
      return (
        <div>
          <p className="text-lg font-bold">
            Saved. <span className="text-[#ff8a1f]">#{save.rank}</span> in {save.round}
          </p>
          <p className="text-sm text-gray-400 font-semibold">
            Your best {save.best}, on the board as {save.name}
          </p>
          <button
            type="button"
            onClick={() => onEdit(save)}
            className="mt-1 min-h-11 px-3 text-sm font-semibold text-gray-300 underline underline-offset-4"
          >
            Change my @
          </button>
        </div>
      );
    case "closed":
      return <p className="text-lg font-bold">Board&apos;s closed right now.</p>;
    case "soon":
    case "error":
      return (
        <>
          <p className="mb-3 font-semibold text-gray-300">
            {save.s === "soon" ? "Too quick. Try again in a few seconds." : "Couldn't save. Try again."}
          </p>
          <button type="button" onClick={onSave} className={primary}>
            Save your aura
          </button>
        </>
      );
    case "inapp":
      return <InAppStep url={save.url} android={save.android} ios={save.ios} />;
    default:
      return (
        <button type="button" onClick={onSave} disabled={signedIn === null} className={primary}>
          Save your aura
        </button>
      );
  }
}

function HandleForm({
  bad,
  onAnswer,
  submitLabel,
}: {
  bad: boolean;
  onAnswer: (answer: { handle: string | null; show: boolean }) => void;
  submitLabel: string;
}) {
  const [value, setValue] = useState("");
  const [show, setShow] = useState(false);
  const [invalid, setInvalid] = useState(bad);

  return (
    <form
      className="text-left"
      onSubmit={(e) => {
        e.preventDefault();
        const result = normaliseHandle(value);
        if (!result.ok) {
          setInvalid(true);
          return;
        }
        onAnswer({ handle: result.handle, show: show && result.handle !== null });
      }}
    >
      <label htmlFor="bat-rush-instagram" className="block font-bold mb-1">
        Your Instagram
      </label>
      <p className="text-sm text-gray-400 mb-2">So we can tag you if you win. Deleted 30 days after the party.</p>
      <div className="flex items-center rounded-2xl bg-white/10 border border-white/15 focus-within:border-[#ff8a1f]">
        <span className="pl-4 text-gray-400 text-base">@</span>
        <input
          id="bat-rush-instagram"
          type="text"
          inputMode="text"
          autoCapitalize="none"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          maxLength={31}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setInvalid(false);
          }}
          placeholder="yourhandle"
          className="flex-1 min-w-0 bg-transparent px-2 py-3.5 text-base text-white placeholder:text-gray-500 outline-none"
        />
      </div>
      {invalid && <p className="mt-1.5 text-sm text-red-400">Letters, numbers, dots and underscores only.</p>}
      <label className="mt-2 flex items-center gap-3 min-h-11 text-base">
        <input
          type="checkbox"
          checked={show}
          onChange={(e) => setShow(e.target.checked)}
          className="w-6 h-6 shrink-0 accent-[#ff8a1f]"
        />
        Show my @ on the board
      </label>
      <p className="text-sm text-gray-400">Unticked, the board shows your first name and initial.</p>
      <div className="mt-4 flex gap-2">
        <button type="submit" className="flex-1 h-14 rounded-full bg-gold-gradient text-black text-lg font-black">
          {submitLabel}
        </button>
        <button
          type="button"
          onClick={() => onAnswer({ handle: null, show: false })}
          className="h-14 px-6 rounded-full border border-white/20 font-bold"
        >
          {submitLabel === "Save" ? "Skip" : "Remove"}
        </button>
      </div>
    </form>
  );
}

function InAppStep({ url, android, ios }: { url: string; android: boolean; ios: boolean }) {
  const [copied, setCopied] = useState<"yes" | "no" | null>(null);
  return (
    <div className="text-left">
      <p className="text-lg font-black">Open in {ios ? "Safari" : "Chrome"} to save</p>
      {android && (
        <a
          href={chromeIntentUrl(url)}
          className="mt-3 w-full h-14 rounded-full bg-gold-gradient text-black text-lg font-black flex items-center justify-center"
        >
          Open in Chrome
        </a>
      )}
      {ios && (
        <p className="mt-2 text-gray-300">
          Tap <span className="font-black text-white">{"•••"}</span> at the top, then{" "}
          <span className="font-black text-white">Open in browser</span>.
        </p>
      )}
      {!android && !ios && <p className="mt-2 text-gray-300">Open this page in Chrome or Safari.</p>}
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied("yes");
          } catch {
            setCopied("no");
          }
        }}
        className="mt-3 w-full h-12 rounded-full border border-white/20 font-bold flex items-center justify-center gap-2"
      >
        <Copy size={16} /> {copied === "yes" ? "Copied" : "Copy link"}
      </button>
      {copied === "no" && (
        <p className="mt-2 text-sm text-red-400">Couldn&apos;t copy. Use the menu at the top instead.</p>
      )}
      <p className="mt-2 text-sm text-gray-400">Your aura comes with you for 30 minutes.</p>
    </div>
  );
}

function FollowButton({
  onClick,
  compact,
  className = "",
}: {
  onClick: () => void;
  compact?: boolean;
  className?: string;
}) {
  return (
    <a
      href={INSTAGRAM_URL}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onClick}
      className={`${className} h-14 font-bold flex items-center justify-center gap-2 bg-gradient-to-r from-[#7c3aed] via-[#db2777] to-[#ff8a1f] text-white ${
        compact ? "rounded-2xl" : "w-full rounded-full"
      }`}
    >
      <InstagramIcon size={18} />
      {compact ? "Follow" : `Follow @${INSTAGRAM_HANDLE}`}
    </a>
  );
}

function BatIcon({ gold = false }: { gold?: boolean }) {
  return (
    <svg viewBox="-2 -2 104 44" className="w-12 h-5" aria-hidden>
      <path d={BAT_PATH} fill={gold ? GOLD : NIGHT} stroke={gold ? "#fffbe6" : PUMPKIN} strokeWidth={3} />
    </svg>
  );
}

function PumpkinIcon() {
  return (
    <svg viewBox="0 0 40 40" className="w-6 h-6" aria-hidden>
      <rect x="18" y="3" width="4" height="7" fill="#4d5b16" />
      <ellipse cx="13" cy="23" rx="9" ry="13" fill={PUMPKIN} />
      <ellipse cx="27" cy="23" rx="9" ry="13" fill={PUMPKIN} />
      <ellipse cx="20" cy="23" rx="9" ry="14" fill="#ff9d3f" />
      <path d="M12 21l3-5 3 5zM22 21l3-5 3 5zM12 27q8 6 16 0l-3 2-2-2-3 2-3-2-2 2z" fill="#ffe27a" />
    </svg>
  );
}
