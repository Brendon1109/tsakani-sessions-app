"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Printer, Gift, AlertTriangle, MessageCircle } from "lucide-react";
import QRCodeDisplay from "@/components/QRCodeDisplay";

/**
 * Printable complimentary tickets.
 *
 * The team issues numbered paper slips and records them in a register. Paper
 * has no QR, so a comp guest is the one person at the door whose ticket has to
 * be typed rather than scanned. That is a fine fallback and a poor default,
 * especially since comps go to the people the team most wants to wave through.
 *
 * Printing the slip with the QR of its booking makes a comp ticket behave like
 * every other ticket. Cut along the cards, hand them out, scan them back.
 */

interface EventOption {
  id: string;
  title: string;
  date: string;
}

interface Slip {
  ref: string;
  holder_name: string | null;
  notes: string | null;
  order_ref: string | null;
  buyer_name: string | null;
  quantity: number | null;
  status: string | null;
  ticket_url: string | null;
}

const EVENT_KEY = "tsakani.comp.eventId";

function shortRef(ref: string): string {
  return ref.replace("TSK-COMP-", "");
}

export default function CompTicketsPage() {
  const [events, setEvents] = useState<EventOption[]>([]);
  const [eventId, setEventId] = useState<string | null>(null);
  const [eventTitle, setEventTitle] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [slips, setSlips] = useState<Slip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/comp-tickets");
        if (!res.ok) throw new Error();
        const body = await res.json();
        const list: EventOption[] = body.events ?? [];
        setEvents(list);
        const saved = window.localStorage.getItem(EVENT_KEY);
        const nearest = [...list].sort(
          (a, b) =>
            Math.abs(new Date(a.date).getTime() - Date.now()) -
            Math.abs(new Date(b.date).getTime() - Date.now())
        )[0];
        setEventId(list.find((e) => e.id === saved)?.id || nearest?.id || null);
      } catch {
        setError("Could not load events.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const load = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/admin/comp-tickets?event_id=${encodeURIComponent(id)}`);
      if (!res.ok) throw new Error();
      const body = await res.json();
      setSlips(body.slips ?? []);
      setEventTitle(body.event?.title?.trim() || "");
      setEventDate(body.event?.date || "");
      setError(null);
    } catch {
      setError("Could not load comp tickets.");
    }
  }, []);

  useEffect(() => {
    if (!eventId) return;
    window.localStorage.setItem(EVENT_KEY, eventId);
    load(eventId);
  }, [eventId, load]);

  const printable = useMemo(() => slips.filter((s) => s.ticket_url), [slips]);
  const unlinked = useMemo(() => slips.filter((s) => !s.ticket_url), [slips]);

  const dateLabel = eventDate
    ? new Date(eventDate).toLocaleDateString("en-ZA", {
        weekday: "long",
        day: "numeric",
        month: "long",
      })
    : "";

  if (loading) return <div className="text-center py-16 text-gray-500">Loading…</div>;

  return (
    <div className="max-w-5xl mx-auto">
      {/* Everything in this block is screen furniture. It must not reach paper. */}
      <div className="print:hidden">
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <Gift className="text-gold-500" size={26} />
            Comp tickets
          </h1>
          <p className="text-gray-400 mt-1 text-sm">
            Print these and a comp guest gets scanned like everyone else, instead of reading a
            number off a slip at the door.
          </p>
        </div>

        <select
          value={eventId || ""}
          onChange={(e) => setEventId(e.target.value)}
          className="w-full sm:w-auto bg-dark-500 border border-white/10 rounded-xl px-4 py-3 text-white mb-5"
        >
          {events.map((e) => (
            <option key={e.id} value={e.id}>
              {e.title.trim()} — {new Date(e.date).toLocaleDateString("en-ZA")}
            </option>
          ))}
        </select>

        {error && (
          <div className="mb-4 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 mb-6">
          <button
            onClick={() => window.print()}
            disabled={printable.length === 0}
            className="bg-gold-gradient text-black font-bold px-5 py-3 rounded-xl inline-flex items-center gap-2 disabled:opacity-40"
          >
            <Printer size={18} />
            Print {printable.length} scannable {printable.length === 1 ? "ticket" : "tickets"}
          </button>
          <span className="text-sm text-gray-500">
            {slips.length} slips on the register for this event
          </span>
        </div>

        {unlinked.length > 0 && (
          <div className="mb-6 rounded-xl border border-amber-400/30 bg-amber-400/10 p-4">
            <p className="text-sm font-semibold text-amber-300 flex items-center gap-2">
              <AlertTriangle size={16} />
              {unlinked.length} {unlinked.length === 1 ? "slip has" : "slips have"} no booking
              behind {unlinked.length === 1 ? "it" : "them"}
            </p>
            <p className="text-xs text-gray-300 mt-1.5 leading-relaxed">
              These cannot be printed with a QR, because there is no ticket to point at. Add the
              guest from the Door screen and the slip becomes printable. Until then the door can
              still find them by typing the number.
            </p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {unlinked.map((s) => (
                <li
                  key={s.ref}
                  className="text-xs bg-black/30 border border-white/10 rounded-lg px-2.5 py-1.5"
                >
                  <span className="font-mono text-gold-500">#{shortRef(s.ref)}</span>
                  {s.holder_name ? <span className="text-gray-300"> · {s.holder_name}</span> : null}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Sending the link beats printing when we have a number: it costs
            nothing, arrives instantly, and cannot be left on a desk. */}
        {printable.some((s) => s.buyer_name) && (
          <p className="text-xs text-gray-500 mb-6 leading-relaxed">
            Not near a printer? Any comp guest with a WhatsApp number can be sent their ticket
            straight from the Door screen — same QR, no paper.
          </p>
        )}
      </div>

      {/* ── The sheet ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 print:grid-cols-2 print:gap-3">
        {printable.map((slip) => (
          <div
            key={slip.ref}
            className="rounded-xl border border-white/15 bg-dark-500 p-4 flex gap-4 items-center
                       print:bg-white print:text-black print:border-black/40 print:break-inside-avoid"
          >
            <div className="shrink-0">
              {slip.ticket_url && (
                <QRCodeDisplay url={slip.ticket_url} size={128} showUrl={false} />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500 print:text-black/60">
                Tsakani Sessions · Complimentary
              </p>
              <p className="text-2xl font-bold text-gold-500 print:text-black leading-tight mt-0.5">
                #{shortRef(slip.ref)}
              </p>
              <p className="text-sm font-semibold text-white print:text-black mt-1 truncate">
                {slip.holder_name || slip.buyer_name || "Guest"}
              </p>
              <p className="text-xs text-gray-400 print:text-black/70 mt-0.5">
                {slip.order_ref}
                {slip.quantity && slip.quantity > 1 ? ` · admits ${slip.quantity}` : ""}
              </p>
              {dateLabel && (
                <p className="text-xs text-gray-500 print:text-black/70 mt-1">
                  {eventTitle} · {dateLabel}
                </p>
              )}
              {slip.status === "used" && (
                <p className="text-[11px] text-amber-400 print:text-black mt-1 font-semibold">
                  Already checked in
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {printable.length === 0 && (
        <div className="print:hidden text-center py-12 text-gray-500 border border-white/10 rounded-xl">
          <Gift size={28} className="mx-auto mb-3 text-gray-600" />
          <p className="text-sm">
            No comp slips are linked to a booking for this event yet.
          </p>
        </div>
      )}

      {/* Screen-only reminder that survives being forgotten about. */}
      {printable.length > 0 && (
        <p className="print:hidden text-xs text-gray-600 mt-6 leading-relaxed flex items-start gap-2">
          <MessageCircle size={14} className="mt-0.5 shrink-0" />
          Each QR is that guest&apos;s real ticket — the same one the door scans for a website
          booking. Scanning a printed slip twice is caught the same way, so a copied slip does not
          get a second person in.
        </p>
      )}
    </div>
  );
}
