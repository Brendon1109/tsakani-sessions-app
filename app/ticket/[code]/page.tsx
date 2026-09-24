import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Calendar, MapPin, Ticket as TicketIcon, MessageCircle, CheckCircle2, Clock } from "lucide-react";
import QRCodeDisplay from "@/components/QRCodeDisplay";
import { eventDateLong, eventTime } from "@/lib/date";
import type { Metadata } from "next";

/**
 * The buyer's own copy of their ticket, reachable without an account.
 *
 * The qr_code is a random uuid that appears nowhere public, so holding the link
 * is the proof of ownership. get_ticket_order deliberately returns no email or
 * phone number — this link travels in forwarded mail and screenshots, and a
 * ticket does not need to leak contact details to work at the door.
 */

export const dynamic = "force-dynamic";

// Never let a ticket into a search index.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: "Your ticket — Tsakani Sessions",
};

interface TicketOrderView {
  order_ref: string;
  buyer_name: string;
  quantity: number;
  total_zar: number;
  status: "pending" | "confirmed" | "used" | "cancelled";
  created_at: string;
  ticket_name: string;
  event_title: string;
  event_slug: string;
  event_date: string;
  venue_name: string | null;
  venue_address: string | null;
  payment_url: string | null;
  payment_note: string | null;
}

const WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "27769961477";

function httpUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

/**
 * A bare 404 is the wrong answer for someone standing at a door holding a link
 * that didn't work. They get told what to do next instead.
 */
function TicketNotFound() {
  return (
    <main className="min-h-screen bg-dark-900 px-4 py-16 flex items-start justify-center">
      <div className="w-full max-w-md text-center">
        <p className="text-[11px] tracking-[0.25em] uppercase text-gold-500 font-bold mb-6">
          Tsakani Sessions
        </p>
        <div className="bg-dark-700 border border-white/10 rounded-2xl p-7">
          <h1 className="text-white font-bold text-xl">We can&apos;t find that ticket.</h1>
          <p className="text-gray-400 text-sm leading-relaxed mt-3">
            The link may be incomplete, or the order may have been cancelled. Check the link in
            your confirmation email &mdash; or message us with your order number and we&apos;ll
            sort it out.
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <a
              href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
                "Hi Tsakani Sessions! I'm having trouble opening my ticket link."
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full border border-gold-500/40 text-gold-500 font-semibold px-5 py-2.5 rounded-full inline-flex items-center justify-center gap-2 hover:bg-gold-500/10 transition-colors text-sm"
            >
              <MessageCircle size={14} />
              Message us on WhatsApp
            </a>
            <Link
              href="/events"
              className="w-full border border-white/10 text-gray-300 font-semibold px-5 py-2.5 rounded-full inline-flex items-center justify-center text-sm hover:bg-white/5 transition-colors"
            >
              Browse events
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

export default async function TicketPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const supabase = await createClient();
  if (!supabase) return <TicketNotFound />;

  const { data, error } = await supabase.rpc("get_ticket_order", {
    p_qr_code: decodeURIComponent(code),
  });

  const order = (Array.isArray(data) ? data[0] : data) as TicketOrderView | undefined;
  if (error || !order) return <TicketNotFound />;

  const isFree = order.total_zar <= 0;
  const confirmed = order.status === "confirmed" || order.status === "used";
  const payUrl = isFree ? null : httpUrl(order.payment_url);
  const ticketUrl = `${(process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/+$/, "")}/ticket/${code}`;

  const waMessage = encodeURIComponent(
    `Hi Tsakani Sessions! I'm asking about my ticket order ${order.order_ref} for "${order.event_title}".`
  );

  return (
    <main className="min-h-screen bg-dark-900 px-4 py-10 sm:py-16">
      <div className="max-w-lg mx-auto">
        <div className="text-center mb-6">
          <p className="text-[11px] tracking-[0.25em] uppercase text-gold-500 font-bold">
            Tsakani Sessions
          </p>
        </div>

        <div className="bg-dark-700 border border-white/10 rounded-2xl overflow-hidden">
          {/* Status strip — the one thing a buyer looks for first. */}
          <div
            className={`px-6 py-3 flex items-center gap-2 text-sm font-semibold ${
              confirmed
                ? "bg-green-500/10 text-green-400 border-b border-green-500/20"
                : "bg-gold-500/10 text-gold-500 border-b border-gold-500/20"
            }`}
          >
            {confirmed ? <CheckCircle2 size={16} /> : <Clock size={16} />}
            {order.status === "used"
              ? "Already scanned at the door"
              : confirmed
                ? "Confirmed — you're in"
                : isFree
                  ? "Reserved — nothing to pay"
                  : "Reserved — awaiting payment"}
          </div>

          <div className="p-6 sm:p-8">
            <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Order number</p>
            <p className="text-3xl font-bold text-gold-500 tracking-wider mt-1">
              {order.order_ref}
            </p>
            <p className="text-gray-400 text-sm mt-1">{order.buyer_name}</p>

            <div className="mt-7 flex justify-center">
              <QRCodeDisplay
                url={ticketUrl}
                size={200}
                label="Show this at the door"
                showUrl={false}
              />
            </div>

            <dl className="mt-7 space-y-3 border-t border-white/10 pt-5">
              <div className="flex items-start gap-3">
                <TicketIcon size={15} className="text-gold-500 mt-1 shrink-0" />
                <div>
                  <dt className="text-xs text-gray-500">Ticket</dt>
                  <dd className="text-white text-sm font-medium">
                    {order.quantity} &times; {order.ticket_name}
                    <span className="text-gold-500 ml-2">
                      {isFree ? "Free" : `R${order.total_zar.toLocaleString("en-ZA")}`}
                    </span>
                  </dd>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Calendar size={15} className="text-gold-500 mt-1 shrink-0" />
                <div>
                  <dt className="text-xs text-gray-500">When</dt>
                  <dd className="text-white text-sm font-medium">
                    {eventDateLong(order.event_date)}, {eventTime(order.event_date)}
                  </dd>
                </div>
              </div>

              {(order.venue_name || order.venue_address) && (
                <div className="flex items-start gap-3">
                  <MapPin size={15} className="text-gold-500 mt-1 shrink-0" />
                  <div>
                    <dt className="text-xs text-gray-500">Where</dt>
                    <dd className="text-white text-sm font-medium">
                      {[order.venue_name, order.venue_address].filter(Boolean).join(", ")}
                    </dd>
                  </div>
                </div>
              )}
            </dl>

            {/* A free ticket is already yours. It gets no talk of money at all. */}
            {!isFree && !confirmed && (
              <div className="mt-6 bg-gold-500/5 border border-gold-500/20 rounded-xl p-4">
                <p className="text-sm text-gray-300 leading-relaxed">
                  Your spot is held. It becomes a confirmed ticket once payment lands.
                </p>
                {order.payment_note && (
                  <p className="text-sm text-gray-400 leading-relaxed mt-2 whitespace-pre-line">
                    {order.payment_note}
                  </p>
                )}
                {payUrl && (
                  <a
                    href={payUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 bg-gold-gradient text-black font-semibold px-5 py-2.5 rounded-full inline-flex items-center justify-center gap-2 hover:opacity-90 transition-opacity w-full"
                  >
                    Pay R{order.total_zar.toLocaleString("en-ZA")} now
                  </a>
                )}
              </div>
            )}

            {isFree && !confirmed && (
              <div className="mt-6 bg-gold-500/5 border border-gold-500/20 rounded-xl p-4">
                <p className="text-sm text-gray-300 leading-relaxed">
                  <span className="text-gold-500 font-semibold">Nothing to pay.</span> This one is
                  on us — just bring this ticket to the door.
                </p>
              </div>
            )}

            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <Link
                href={`/events/${order.event_slug}`}
                className="flex-1 border border-white/10 text-gray-300 font-semibold px-5 py-2.5 rounded-full inline-flex items-center justify-center gap-2 hover:bg-white/5 transition-colors text-sm"
              >
                Event details
              </Link>
              <a
                href={`https://wa.me/${WHATSAPP_NUMBER}?text=${waMessage}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 border border-gold-500/40 text-gold-500 font-semibold px-5 py-2.5 rounded-full inline-flex items-center justify-center gap-2 hover:bg-gold-500/10 transition-colors text-sm"
              >
                <MessageCircle size={14} />
                Ask a question
              </a>
            </div>
          </div>
        </div>

        <p className="text-center text-gray-500 text-xs mt-5 leading-relaxed">
          Bookmark this page or keep the confirmation email — this link is your ticket.
        </p>
      </div>
    </main>
  );
}
