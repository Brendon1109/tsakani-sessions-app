"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ScanLine,
  Search,
  RotateCcw,
  Users,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Wallet,
  CameraOff,
  RefreshCw,
  UserPlus,
  MessageCircle,
  Loader2,
} from "lucide-react";
import DoorScanner from "@/components/DoorScanner";
import { waNumber } from "@/lib/whatsapp";

/**
 * Door mode.
 *
 * The admin tickets table can also check people in, but it is a back-office
 * screen: every event at once, 25 rows a page, find the name, click. At an
 * actual entrance that is a queue. This screen does one night, reads the QR
 * that is already on every ticket, and is built to be used one-handed on a
 * phone in the dark by someone who is talking to a guest, not reading.
 *
 * Two rules shape most of what follows:
 *
 *  1. A scan admits ONE guest. Orders are mostly for one person, so that is the
 *     no-tap path — but a party of five must never all be marked present because
 *     one of them walked past the camera. The rest are added deliberately.
 *  2. The search box is not a fallback, it is half the tool. WhatsApp bookings
 *     have no QR at all, and phones die. Typing four characters has to work as
 *     well as scanning does.
 */

interface EventOption {
  id: string;
  title: string;
  date: string;
  slug: string;
}

interface Guest {
  id: string;
  order_ref: string | null;
  buyer_name: string;
  buyer_email: string | null;
  buyer_phone: string | null;
  quantity: number;
  checked_in_count: number;
  status: string;
  total_zar: number;
  checked_in_at: string | null;
  created_at: string;
  source: string | null;
  ticket_name: string | null;
  ticket_url: string | null;
  is_birthday_vip?: boolean | null;
  /** Numbers printed on any complimentary slips issued against this booking. */
  comp_refs?: string[];
}

interface TicketType {
  id: string;
  name: string;
  price_zar: number;
}

interface AddedGuest {
  order_ref: string;
  buyer_name: string;
  quantity: number;
  ticket_url: string | null;
  over_capacity: boolean;
  sold: number;
  capacity: number;
  phone: string | null;
}

interface CheckInResult {
  outcome:
    | "checked_in"
    | "already_in"
    | "unpaid"
    | "birthday_id_check"
    | "cancelled"
    | "wrong_event"
    | "not_found"
    | "undone";
  is_birthday_vip?: boolean | null;
  birthday_day?: number | null;
  birthday_month?: number | null;
  order_id?: string | null;
  order_ref?: string | null;
  buyer_name?: string | null;
  quantity?: number | null;
  checked_in_count?: number | null;
  total_zar?: number | null;
  ticket_name?: string | null;
  event_title?: string | null;
  checked_in_at?: string | null;
  first_seen_at?: string | null;
  /** Set locally when the guest arrived via the search box rather than the camera. */
  code?: string;
}

const EVENT_KEY = "tsakani.door.eventId";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function timeOf(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("en-ZA", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function eventDayLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("en-ZA", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

/**
 * The link that hands a guest their ticket in the chat they already booked in.
 *
 * Returns null when there is no usable number or no ticket link, and the button
 * is hidden rather than disabled. A dead "Send on WhatsApp" is worse than none:
 * the team taps it, sees a chat open, and believes the ticket went out.
 */
function whatsappTicketLink(guest: {
  buyer_name: string;
  buyer_phone: string | null;
  ticket_url: string | null;
  order_ref: string | null;
}, eventTitle: string): string | null {
  const number = waNumber(guest.buyer_phone);
  if (!number || !guest.ticket_url) return null;
  const firstName = (guest.buyer_name || "there").trim().split(" ")[0];
  const message =
    `Hi ${firstName}! 🎟️ Here's your ticket for ${eventTitle || "Tsakani Sessions"}.\n\n` +
    `Order ${guest.order_ref}\n${guest.ticket_url}\n\n` +
    `Open that link and show the QR code at the door — we scan it and you're straight in. See you there! 🎶`;
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

export default function DoorPage() {
  const [events, setEvents] = useState<EventOption[]>([]);
  const [eventId, setEventId] = useState<string | null>(null);
  const [eventTitle, setEventTitle] = useState<string>("");
  const [guests, setGuests] = useState<Guest[]>([]);
  const [tickets, setTickets] = useState<TicketType[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [added, setAdded] = useState<AddedGuest | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<CheckInResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);

  // ── Loading the night ─────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/door");
        if (!res.ok) throw new Error("Could not load events");
        const body = await res.json();
        const list: EventOption[] = body.events ?? [];
        setEvents(list);

        // Remember the choice: a door phone gets locked, backgrounded and
        // reopened constantly, and re-picking the event every time is exactly
        // the friction this screen exists to remove.
        const saved =
          typeof window !== "undefined" ? window.localStorage.getItem(EVENT_KEY) : null;
        const nearest = pickNearest(list);
        const chosen = list.find((e) => e.id === saved)?.id || nearest?.id || null;
        setEventId(chosen);
      } catch {
        setError("Could not load events. Check your connection and pull to refresh.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const loadGuests = useCallback(
    async (id: string, quiet = false) => {
      if (!quiet) setRefreshing(true);
      try {
        const res = await fetch(`/api/admin/door?event_id=${encodeURIComponent(id)}`);
        if (!res.ok) throw new Error();
        const body = await res.json();
        setGuests(body.guests ?? []);
        setTickets(body.tickets ?? []);
        setEventTitle(body.event?.title?.trim() || "");
        setError(null);
      } catch {
        // Quiet failures are the poll; do not stamp an error over a working
        // screen because one background refresh missed.
        if (!quiet) setError("Could not load the guest list.");
      } finally {
        setRefreshing(false);
      }
    },
    []
  );

  useEffect(() => {
    if (!eventId) return;
    window.localStorage.setItem(EVENT_KEY, eventId);
    loadGuests(eventId);
    // Other doors are checking people in too. Poll so the count on this phone
    // is not quietly stale all night.
    const poll = setInterval(() => loadGuests(eventId, true), 20000);
    return () => clearInterval(poll);
  }, [eventId, loadGuests]);

  // ── Checking someone in ───────────────────────────────────
  const submit = useCallback(
    async (payload: {
      code: string;
      count?: number;
      allow_unpaid?: boolean;
      id_checked?: boolean;
    }) => {
      if (!eventId) return;
      setBusy(true);
      try {
        const res = await fetch("/api/admin/door", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code: payload.code,
            event_id: eventId,
            count: payload.count ?? 1,
            allow_unpaid: payload.allow_unpaid ?? false,
            id_checked: payload.id_checked ?? false,
          }),
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error || "Check-in failed");
        setResult({ ...body, code: payload.code });
        // Reconcile against the server rather than patching the row locally —
        // another door may have moved it since this list was fetched.
        loadGuests(eventId, true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Check-in failed");
      } finally {
        setBusy(false);
      }
    },
    [eventId, loadGuests]
  );

  const undo = useCallback(
    async (orderId: string) => {
      if (!eventId) return;
      setBusy(true);
      try {
        const res = await fetch("/api/admin/door", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "undo", order_id: orderId }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || "Could not undo");
        }
        setResult(null);
        loadGuests(eventId, true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not undo");
      } finally {
        setBusy(false);
      }
    },
    [eventId, loadGuests]
  );

  const addGuest = useCallback(
    async (form: {
      ticket_id: string;
      buyer_name: string;
      buyer_phone: string;
      quantity: number;
      source: "whatsapp" | "door";
    }) => {
      if (!eventId) return;
      setBusy(true);
      setError(null);
      try {
        const res = await fetch("/api/admin/door", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "add_guest", ...form }),
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error || "Could not add that guest");
        setAdded({
          order_ref: body.order_ref,
          buyer_name: form.buyer_name,
          quantity: body.quantity,
          ticket_url: body.ticket_url,
          over_capacity: body.over_capacity,
          sold: body.sold,
          capacity: body.capacity,
          phone: form.buyer_phone || null,
        });
        setAddOpen(false);
        loadGuests(eventId, true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not add that guest");
      } finally {
        setBusy(false);
      }
    },
    [eventId, loadGuests]
  );

  // A scan while a result is on screen would replace it before it was read.
  const onScan = useCallback(
    (code: string) => {
      if (busy || result) return;
      submit({ code, count: 1 });
    },
    [busy, result, submit]
  );

  useEffect(() => {
    if (result) resultRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [result]);

  // ── Counts and search ─────────────────────────────────────
  const stats = useMemo(() => {
    let expected = 0;
    let inside = 0;
    for (const g of guests) {
      expected += g.quantity || 1;
      inside += g.checked_in_count || 0;
    }
    return { expected, inside, orders: guests.length };
  }, [guests]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return guests
      .filter((g) => {
        const ref = (g.order_ref || "").toLowerCase();
        // "28", "0028" and "tsk-comp-0028" all have to find the slip holder —
        // whoever is on the door types the shortest thing that could work.
        const compHit = (g.comp_refs ?? []).some((c) => {
          const lower = c.toLowerCase();
          const digits = c.replace(/\D/g, "");
          return (
            lower.includes(q) ||
            (/^\d{1,4}$/.test(q) && digits === q.padStart(4, "0"))
          );
        });
        return (
          compHit ||
          g.buyer_name?.toLowerCase().includes(q) ||
          ref.includes(q) ||
          // "CBA7" — the tail is what people read out, and it is unambiguous
          // enough within one event.
          ref.replace("ts-", "").endsWith(q) ||
          g.buyer_email?.toLowerCase().includes(q) ||
          (g.buyer_phone || "").replace(/\D/g, "").includes(q.replace(/\D/g, "") || " ")
        );
      })
      .slice(0, 25);
  }, [guests, query]);

  const recent = useMemo(
    () =>
      guests
        .filter((g) => g.checked_in_at)
        .sort((a, b) => (b.checked_in_at || "").localeCompare(a.checked_in_at || ""))
        .slice(0, 8),
    [guests]
  );

  if (loading) {
    return <div className="text-center py-16 text-gray-500">Loading door…</div>;
  }

  return (
    <div className="max-w-2xl mx-auto pb-24">
      {/* ── Header: who is in, out of how many ── */}
      <div className="mb-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <ScanLine className="text-gold-500 shrink-0" size={24} />
              Door
            </h1>
            <p className="text-gray-400 text-sm mt-0.5 truncate">
              {eventTitle || "Pick tonight's event"}
            </p>
          </div>
          <button
            onClick={() => eventId && loadGuests(eventId)}
            disabled={!eventId || refreshing}
            className="shrink-0 text-gray-400 hover:text-white p-2 rounded-lg hover:bg-white/5 disabled:opacity-40"
            aria-label="Refresh guest list"
          >
            <RefreshCw size={18} className={refreshing ? "animate-spin" : ""} />
          </button>
        </div>

        <select
          value={eventId || ""}
          onChange={(e) => {
            setEventId(e.target.value);
            setResult(null);
            setQuery("");
          }}
          className="mt-3 w-full bg-dark-500 border border-white/10 rounded-xl px-4 py-3 text-white text-base focus:border-gold-500 focus:outline-none"
        >
          {events.map((e) => (
            <option key={e.id} value={e.id}>
              {e.title.trim()} — {eventDayLabel(e.date)}
            </option>
          ))}
        </select>
      </div>

      {eventId && (
        <div className="grid grid-cols-3 gap-2 mb-5">
          <Stat label="Inside" value={stats.inside} accent />
          <Stat label="Expected" value={stats.expected} />
          <Stat label="Still out" value={Math.max(0, stats.expected - stats.inside)} />
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-300 flex items-start justify-between gap-3">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-200 shrink-0">
            Dismiss
          </button>
        </div>
      )}

      {/* ── The result of the last scan ── */}
      {result && (
        <div ref={resultRef} className="mb-5">
          <ResultCard
            result={result}
            busy={busy}
            onDismiss={() => setResult(null)}
            onAddMore={(n) => result.code && submit({ code: result.code, count: n })}
            onAdmitUnpaid={() =>
              result.code && submit({ code: result.code, count: 1, allow_unpaid: true })
            }
            onIdConfirmed={() =>
              result.code &&
              submit({
                code: result.code,
                // The whole birthday group arrives together — that is the point
                // of the package — so confirming the ID admits all of them.
                count: result.quantity ?? 1,
                id_checked: true,
              })
            }
            onUndo={() => result.order_id && undo(result.order_id)}
          />
        </div>
      )}

      {/* ── A guest we just created, and the link to send them ── */}
      {added && (
        <div className="mb-5 rounded-2xl border-2 border-gold-500/40 bg-gold-500/10 p-5">
          <div className="flex items-start gap-3">
            <CheckCircle2 size={28} className="text-gold-500 shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="text-lg font-bold text-gold-400">Added to the list</p>
              <p className="text-white text-xl font-bold mt-1 break-words">{added.buyer_name}</p>
              <p className="text-gray-400 text-sm mt-0.5">
                {added.order_ref} · {added.quantity}{" "}
                {added.quantity === 1 ? "guest" : "guests"}
              </p>
              {added.over_capacity && (
                <p className="text-amber-300 text-sm mt-2 flex items-start gap-1.5">
                  <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                  Over capacity — {added.sold} booked against {added.capacity} places. They&apos;re
                  in, but the room is fuller than planned.
                </p>
              )}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {(() => {
              const link = whatsappTicketLink(
                {
                  buyer_name: added.buyer_name,
                  buyer_phone: added.phone,
                  ticket_url: added.ticket_url,
                  order_ref: added.order_ref,
                },
                eventTitle
              );
              return link ? (
                <a
                  href={link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 min-w-[11rem] bg-gold-gradient text-black font-bold px-4 py-3 rounded-xl flex items-center justify-center gap-2"
                >
                  <MessageCircle size={17} />
                  Send their ticket
                </a>
              ) : (
                <p className="flex-1 min-w-[11rem] text-xs text-gray-400 leading-relaxed py-2">
                  No usable WhatsApp number, so there is nothing to send. They can still be found by
                  name at the door.
                </p>
              );
            })()}
            <button
              onClick={() => setAdded(null)}
              className="flex-1 min-w-[7rem] bg-white/5 border border-white/10 text-white font-semibold px-4 py-3 rounded-xl hover:bg-white/10"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* ── Adding someone who never booked on the site ── */}
      {addOpen && (
        <AddGuestForm
          tickets={tickets}
          busy={busy}
          initialName={query.trim()}
          onCancel={() => setAddOpen(false)}
          onSubmit={addGuest}
        />
      )}

      {/* ── Camera ── */}
      <div className="mb-5">
        {scanning ? (
          <>
            <DoorScanner onCode={onScan} paused={busy || !!result} />
            <button
              onClick={() => setScanning(false)}
              className="mt-3 w-full border border-white/10 text-gray-300 font-semibold px-5 py-3 rounded-xl hover:bg-white/5 flex items-center justify-center gap-2"
            >
              <CameraOff size={16} />
              Stop camera
            </button>
          </>
        ) : (
          <button
            onClick={() => setScanning(true)}
            disabled={!eventId}
            className="w-full bg-gold-gradient text-black font-bold text-lg px-5 py-5 rounded-2xl flex items-center justify-center gap-3 disabled:opacity-40"
          >
            <ScanLine size={22} />
            Scan tickets
          </button>
        )}

        {!addOpen && (
          <button
            onClick={() => setAddOpen(true)}
            disabled={!eventId || tickets.length === 0}
            className="mt-3 w-full border border-white/10 text-gray-200 font-semibold px-5 py-3.5 rounded-xl hover:bg-white/5 flex items-center justify-center gap-2 disabled:opacity-40"
          >
            <UserPlus size={17} />
            Add a guest
          </button>
        )}
      </div>

      {/* ── Search: WhatsApp bookings, flat batteries, awkward QR codes ── */}
      <div className="mb-5">
        <div className="relative">
          <Search
            size={18}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Name, order number, phone…"
            // A door phone is used one-handed; iOS zooms the page on any input
            // under 16px, and the zoom does not come back.
            className="w-full bg-dark-500 border border-white/10 rounded-xl pl-11 pr-4 py-3.5 text-white text-base placeholder:text-gray-600 focus:border-gold-500 focus:outline-none"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
          />
        </div>

        {query.trim() && (
          <div className="mt-3 space-y-2">
            {matches.length === 0 ? (
              // The dead end that sent the team to a PDF. Someone who booked on
              // WhatsApp is genuinely not in the list, so "no match" has to
              // offer the way forward rather than just report the absence.
              <div className="rounded-xl border border-white/10 bg-dark-500 px-4 py-4">
                <p className="text-gray-400 text-sm">
                  Nobody on tonight&apos;s list matches &ldquo;{query.trim()}&rdquo;.
                </p>
                <p className="text-gray-500 text-xs mt-1 leading-relaxed">
                  If they booked on WhatsApp they were never on it. Add them and they get a real
                  ticket you can scan next time.
                </p>
                <button
                  onClick={() => setAddOpen(true)}
                  disabled={tickets.length === 0}
                  className="mt-3 w-full bg-gold-gradient text-black font-bold px-4 py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-40"
                >
                  <UserPlus size={17} />
                  Add {query.trim().slice(0, 24)}
                </button>
              </div>
            ) : (
              matches.map((g) => (
                <GuestRow
                  key={g.id}
                  guest={g}
                  busy={busy}
                  eventTitle={eventTitle}
                  onCheckIn={(n) =>
                    submit({
                      code: g.order_ref || g.id,
                      count: n,
                      // Searching someone up and tapping their name is already
                      // the deliberate decision the unpaid prompt exists to
                      // force, so it does not ask a second time here.
                      allow_unpaid: g.status === "pending",
                    })
                  }
                  onUndo={() => undo(g.id)}
                />
              ))
            )}
          </div>
        )}
      </div>

      {/* ── Last few through the door, with an undo ── */}
      {!query.trim() && recent.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-400 mb-2 flex items-center gap-2">
            <Users size={15} />
            Just came in
          </h2>
          <div className="space-y-2">
            {recent.map((g) => (
              <GuestRow
                key={g.id}
                guest={g}
                busy={busy}
                eventTitle={eventTitle}
                onUndo={() => undo(g.id)}
                compact
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** The event most likely to be tonight's: nearest to now in either direction. */
function pickNearest(list: EventOption[]): EventOption | undefined {
  if (list.length === 0) return undefined;
  const now = Date.now();
  return [...list].sort(
    (a, b) =>
      Math.abs(new Date(a.date).getTime() - now) - Math.abs(new Date(b.date).getTime() - now)
  )[0];
}

function Stat({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div className="bg-dark-500 border border-white/10 rounded-xl px-3 py-3 text-center">
      <p className={`text-2xl font-bold ${accent ? "text-gold-500" : "text-white"}`}>{value}</p>
      <p className="text-[11px] uppercase tracking-wider text-gray-500 mt-0.5">{label}</p>
    </div>
  );
}

/**
 * The whole point of the screen: one glance, at arm's length, tells the person
 * on the door whether this guest walks in. Colour carries it, the words confirm
 * it, and nothing else competes.
 */
function ResultCard({
  result,
  busy,
  onDismiss,
  onAddMore,
  onAdmitUnpaid,
  onIdConfirmed,
  onUndo,
}: {
  result: CheckInResult;
  busy: boolean;
  onDismiss: () => void;
  onAddMore: (n: number) => void;
  onAdmitUnpaid: () => void;
  onIdConfirmed: () => void;
  onUndo: () => void;
}) {
  const qty = result.quantity ?? 1;
  const inCount = result.checked_in_count ?? 0;
  const remaining = Math.max(0, qty - inCount);
  const name = result.buyer_name || "Guest";

  const skin = {
    checked_in: {
      wrap: "border-green-400/40 bg-green-400/10",
      text: "text-green-300",
      icon: <CheckCircle2 size={30} className="text-green-400" />,
      title: "Let them in",
    },
    already_in: {
      wrap: "border-amber-400/40 bg-amber-400/10",
      text: "text-amber-300",
      icon: <AlertTriangle size={30} className="text-amber-400" />,
      title: "Already inside",
    },
    unpaid: {
      wrap: "border-amber-400/40 bg-amber-400/10",
      text: "text-amber-300",
      icon: <Wallet size={30} className="text-amber-400" />,
      title: "Not paid yet",
    },
    birthday_id_check: {
      wrap: "border-gold-500/50 bg-gold-500/10",
      text: "text-gold-400",
      icon: <span className="text-3xl leading-none">🎂</span>,
      title: "Birthday group — check ID",
    },
    cancelled: {
      wrap: "border-red-400/40 bg-red-400/10",
      text: "text-red-300",
      icon: <XCircle size={30} className="text-red-400" />,
      title: "Cancelled ticket",
    },
    wrong_event: {
      wrap: "border-red-400/40 bg-red-400/10",
      text: "text-red-300",
      icon: <XCircle size={30} className="text-red-400" />,
      title: "Different event",
    },
    not_found: {
      wrap: "border-red-400/40 bg-red-400/10",
      text: "text-red-300",
      icon: <XCircle size={30} className="text-red-400" />,
      title: "Not recognised",
    },
    undone: {
      wrap: "border-white/20 bg-white/5",
      text: "text-gray-300",
      icon: <RotateCcw size={30} className="text-gray-400" />,
      title: "Check-in undone",
    },
  }[result.outcome];

  return (
    <div className={`rounded-2xl border-2 p-5 ${skin.wrap}`}>
      <div className="flex items-start gap-3">
        <div className="shrink-0 mt-0.5">{skin.icon}</div>
        <div className="min-w-0 flex-1">
          <p className={`text-lg font-bold ${skin.text}`}>{skin.title}</p>

          {result.outcome === "not_found" ? (
            <p className="text-gray-300 text-sm mt-1 leading-relaxed">
              That code isn&apos;t a ticket for any event. Try searching their name below.
            </p>
          ) : (
            <>
              <p className="text-white text-xl font-bold mt-1 break-words">{name}</p>
              <p className="text-gray-400 text-sm mt-0.5">
                {result.order_ref}
                {result.ticket_name ? ` · ${result.ticket_name}` : ""}
              </p>
            </>
          )}

          {result.outcome === "birthday_id_check" && (
            <div className="mt-2">
              <p className="text-gray-200 text-sm leading-relaxed">
                Claims a birthday in{" "}
                <span className="font-bold text-white">
                  {result.birthday_month ? MONTH_NAMES[result.birthday_month - 1] : "—"}
                  {result.birthday_day ? ` ${result.birthday_day}` : ""}
                </span>
                . Check their ID says the same month before letting the group in.
              </p>
              <p className="text-gold-400/90 text-sm mt-2">
                Free entry for {qty}, a table, and a shout-out.
              </p>
            </div>
          )}

          {result.outcome === "checked_in" && result.is_birthday_vip && (
            <p className="text-gold-400 text-sm mt-2 font-semibold">
              🎂 Birthday group — table and shout-out
            </p>
          )}

          {result.outcome === "checked_in" && (
            <p className="text-gray-200 text-sm mt-2">
              {qty > 1 ? (
                <>
                  <span className="font-semibold text-white">
                    {inCount} of {qty}
                  </span>{" "}
                  from this booking are in
                  {remaining > 0 ? ` — ${remaining} still outside` : ""}
                </>
              ) : (
                "Single ticket — all done"
              )}
            </p>
          )}

          {result.outcome === "already_in" && (
            <p className="text-gray-200 text-sm mt-2">
              All {qty} came in at {timeOf(result.checked_in_at)}. If this is a different
              person, they need their own ticket.
            </p>
          )}

          {result.outcome === "unpaid" && (
            <p className="text-gray-200 text-sm mt-2">
              Owes{" "}
              <span className="font-bold text-white">
                R{(result.total_zar ?? 0).toLocaleString("en-ZA")}
              </span>{" "}
              for {qty} {qty === 1 ? "ticket" : "tickets"}. Take payment, then let them in.
            </p>
          )}

          {result.outcome === "wrong_event" && (
            <p className="text-gray-200 text-sm mt-2">
              This ticket is for {result.event_title?.trim() || "another event"}, not tonight.
            </p>
          )}

          {result.outcome === "cancelled" && (
            <p className="text-gray-200 text-sm mt-2">
              This booking was cancelled, so the seat went back on sale.
            </p>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {result.outcome === "checked_in" && remaining > 0 && (
          <>
            <button
              onClick={() => onAddMore(1)}
              disabled={busy}
              className="flex-1 min-w-[7rem] bg-white/10 text-white font-semibold px-4 py-3 rounded-xl hover:bg-white/20 disabled:opacity-40"
            >
              +1 more
            </button>
            {remaining > 1 && (
              <button
                onClick={() => onAddMore(remaining)}
                disabled={busy}
                className="flex-1 min-w-[7rem] bg-white/10 text-white font-semibold px-4 py-3 rounded-xl hover:bg-white/20 disabled:opacity-40"
              >
                All {remaining} more
              </button>
            )}
          </>
        )}

        {result.outcome === "unpaid" && (
          <button
            onClick={onAdmitUnpaid}
            disabled={busy}
            className="flex-1 min-w-[10rem] bg-gold-gradient text-black font-bold px-4 py-3 rounded-xl disabled:opacity-40"
          >
            Paid at door — let in
          </button>
        )}

        {result.outcome === "birthday_id_check" && (
          <button
            onClick={onIdConfirmed}
            disabled={busy}
            className="flex-1 min-w-[11rem] bg-gold-gradient text-black font-bold px-4 py-3 rounded-xl disabled:opacity-40"
          >
            ID checks out — let them in
          </button>
        )}

        {result.outcome === "checked_in" && result.order_id && (
          <button
            onClick={onUndo}
            disabled={busy}
            className="px-4 py-3 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 font-medium disabled:opacity-40 flex items-center gap-1.5"
          >
            <RotateCcw size={15} />
            Undo
          </button>
        )}

        <button
          onClick={onDismiss}
          className="flex-1 min-w-[7rem] bg-white/5 border border-white/10 text-white font-semibold px-4 py-3 rounded-xl hover:bg-white/10"
        >
          Next guest
        </button>
      </div>
    </div>
  );
}

/**
 * Putting a guest who booked another way into the same list as everyone else.
 *
 * Only the name is required. A WhatsApp booking often arrives as "can I bring 3
 * people" and a first name, and a form that insists on an email would send the
 * team straight back to keeping a separate list — which is the entire problem
 * this is here to end.
 */
function AddGuestForm({
  tickets,
  busy,
  initialName,
  onCancel,
  onSubmit,
}: {
  tickets: TicketType[];
  busy: boolean;
  initialName: string;
  onCancel: () => void;
  onSubmit: (form: {
    ticket_id: string;
    buyer_name: string;
    buyer_phone: string;
    quantity: number;
    source: "whatsapp" | "door";
  }) => void;
}) {
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState("");
  const [qty, setQty] = useState<number | "">(1);
  const [ticketId, setTicketId] = useState(tickets[0]?.id || "");
  const [source, setSource] = useState<"whatsapp" | "door">("whatsapp");

  const qtyValue = qty === "" ? 1 : qty;
  const chosen = tickets.find((t) => t.id === ticketId);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim() || !ticketId) return;
        onSubmit({
          ticket_id: ticketId,
          buyer_name: name.trim(),
          buyer_phone: phone.trim(),
          quantity: Math.max(1, Math.min(20, Math.floor(qtyValue))),
          source,
        });
      }}
      className="mb-5 rounded-2xl border border-gold-500/30 bg-dark-500 p-5"
    >
      <h2 className="font-bold text-white text-lg flex items-center gap-2">
        <UserPlus size={19} className="text-gold-500" />
        Add a guest
      </h2>
      <p className="text-gray-500 text-xs mt-1 leading-relaxed">
        They get a real order number and a QR code, so they show up in this list and can be scanned
        like anyone else.
      </p>

      <div className="mt-4 flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-gray-400">Their name</span>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="off"
            className="bg-dark-800 border border-white/10 rounded-lg px-3 py-3 text-white text-base focus:outline-none focus:border-gold-500"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-gray-400">
            WhatsApp number <span className="text-gray-600">(so we can send their ticket)</span>
          </span>
          <input
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="082 123 4567"
            autoComplete="off"
            className="bg-dark-800 border border-white/10 rounded-lg px-3 py-3 text-white text-base focus:outline-none focus:border-gold-500"
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-gray-400">How many</span>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={20}
              value={qty}
              onChange={(e) => {
                const raw = e.target.value;
                if (raw === "") return setQty("");
                const n = Number(raw);
                if (!Number.isNaN(n)) setQty(Math.max(1, Math.min(20, Math.floor(n))));
              }}
              onBlur={() => setQty(Math.max(1, Math.min(20, Math.floor(qtyValue))))}
              className="bg-dark-800 border border-white/10 rounded-lg px-3 py-3 text-white text-base focus:outline-none focus:border-gold-500"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs text-gray-400">Ticket</span>
            <select
              value={ticketId}
              onChange={(e) => setTicketId(e.target.value)}
              className="bg-dark-800 border border-white/10 rounded-lg px-3 py-3 text-white text-base focus:outline-none focus:border-gold-500"
            >
              {tickets.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} {t.price_zar > 0 ? `· R${t.price_zar}` : "· Free"}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex gap-2">
          {(["whatsapp", "door"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSource(s)}
              className={`flex-1 px-3 py-2.5 rounded-lg text-sm font-semibold border ${
                source === s
                  ? "border-gold-500 bg-gold-500/10 text-gold-400"
                  : "border-white/10 text-gray-400 hover:bg-white/5"
              }`}
            >
              {s === "whatsapp" ? "Booked on WhatsApp" : "Walk-up at door"}
            </button>
          ))}
        </div>

        {chosen && chosen.price_zar > 0 && (
          <p className="text-xs text-amber-300/90 leading-relaxed">
            {chosen.name} is R{chosen.price_zar} each — R{chosen.price_zar * qtyValue} total. Adding
            them here marks it as paid, so only do this once you have the money.
          </p>
        )}
      </div>

      <div className="mt-4 flex gap-2">
        <button
          type="submit"
          disabled={busy || !name.trim() || !ticketId}
          className="flex-1 bg-gold-gradient text-black font-bold px-4 py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-40"
        >
          {busy ? <Loader2 size={17} className="animate-spin" /> : <UserPlus size={17} />}
          Add guest
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-5 py-3 rounded-xl border border-white/10 text-gray-300 font-semibold hover:bg-white/5"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

/** One person in the search results, sized for a thumb rather than a mouse. */
function GuestRow({
  guest,
  busy,
  eventTitle,
  onCheckIn,
  onUndo,
  compact = false,
}: {
  guest: Guest;
  busy: boolean;
  eventTitle: string;
  onCheckIn?: (count: number) => void;
  onUndo?: () => void;
  compact?: boolean;
}) {
  const qty = guest.quantity || 1;
  const inCount = guest.checked_in_count || 0;
  const remaining = Math.max(0, qty - inCount);
  const fullyIn = remaining === 0;
  const waLink = whatsappTicketLink(guest, eventTitle);

  return (
    <div
      className={`rounded-xl border px-4 py-3 ${
        fullyIn ? "border-green-400/25 bg-green-400/[0.06]" : "border-white/10 bg-dark-500"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-white truncate">
            {guest.is_birthday_vip ? "🎂 " : ""}
            {guest.buyer_name}
          </p>
          <p className="text-xs text-gray-500 mt-0.5 truncate">
            <span className="font-mono text-gold-500/80">{guest.order_ref}</span>
            {(guest.comp_refs ?? []).length > 0
              ? ` · comp ${(guest.comp_refs ?? [])
                  .map((c) => c.replace("TSK-COMP-", "#"))
                  .join(", ")}`
              : ""}
            {qty > 1 ? ` · ${inCount}/${qty} in` : ""}
            {guest.status === "pending" ? " · unpaid" : ""}
            {guest.source && guest.source !== "website" ? ` · ${guest.source}` : ""}
            {fullyIn && guest.checked_in_at ? ` · ${timeOf(guest.checked_in_at)}` : ""}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Their ticket, in the chat they booked in. Also the fix for anyone
              who lost the confirmation email. */}
          {waLink && (
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-green-400/80 hover:text-green-300 p-2 rounded-lg hover:bg-white/5"
              aria-label={`Send ${guest.buyer_name} their ticket on WhatsApp`}
              title="Send their ticket on WhatsApp"
            >
              <MessageCircle size={16} />
            </a>
          )}

          {!compact && onCheckIn && !fullyIn && (
            <>
              <button
                onClick={() => onCheckIn(1)}
                disabled={busy}
                className="bg-gold-gradient text-black font-bold text-sm px-4 py-2.5 rounded-lg disabled:opacity-40 whitespace-nowrap"
              >
                {qty > 1 ? "+1" : "Check in"}
              </button>
              {remaining > 1 && (
                <button
                  onClick={() => onCheckIn(remaining)}
                  disabled={busy}
                  className="bg-white/10 text-white font-semibold text-sm px-3 py-2.5 rounded-lg hover:bg-white/20 disabled:opacity-40 whitespace-nowrap"
                >
                  All {remaining}
                </button>
              )}
            </>
          )}

          {fullyIn && (
            <span className="text-green-400 text-xs font-semibold flex items-center gap-1">
              <CheckCircle2 size={15} />
              In
            </span>
          )}

          {onUndo && inCount > 0 && (
            <button
              onClick={onUndo}
              disabled={busy}
              className="text-gray-500 hover:text-white p-2 rounded-lg hover:bg-white/5 disabled:opacity-40"
              aria-label={`Undo check-in for ${guest.buyer_name}`}
            >
              <RotateCcw size={15} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
