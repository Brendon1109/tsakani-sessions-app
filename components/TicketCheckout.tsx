"use client";

import { useState } from "react";
import { MessageCircle, X, Loader2 } from "lucide-react";
import Turnstile from "@/components/Turnstile";

/**
 * Captures WHO is coming before handing off to WhatsApp.
 *
 * The button used to be a bare link straight to wa.me. That recorded an
 * anonymous ticket_buy_click and nothing else, so the buyer existed only in a
 * WhatsApp thread and ticket_orders stayed empty. Now we take their details,
 * write a real order, and then open WhatsApp with the reference already in the
 * message, so the team can match the chat to the order.
 *
 * WhatsApp is still where payment is confirmed. Nothing about that changes.
 */

interface Props {
  ticketId: string;
  ticketName: string;
  priceZar: number;
  eventTitle: string;
  eventSlug: string;
  eventDateLabel: string;
  whatsappNumber: string;
}

export default function TicketCheckout({
  ticketId,
  ticketName,
  priceZar,
  eventTitle,
  eventSlug,
  eventDateLabel,
  whatsappNumber,
}: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [joinList, setJoinList] = useState(true);
  const [captchaToken, setCaptchaToken] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const captchaRequired = !!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const isFree = priceZar === 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticket_id: ticketId,
          buyer_name: name.trim(),
          buyer_email: email.trim(),
          buyer_phone: phone.trim() || null,
          quantity,
          captcha_token: captchaToken,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        // The order was NOT captured, so do not send them to WhatsApp
        // pretending it was.
        setError(data.error || "We couldn't reserve that. Please try again.");
        setSubmitting(false);
        return;
      }

      // Opted in to hear about future events. Best effort: their ticket is
      // already safely recorded and must not fail because of the mailing list.
      if (joinList) {
        fetch("/api/newsletter", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: email.trim(),
            consent_events: true,
            consent_merch: false,
            captcha_token: captchaToken,
          }),
        }).catch(() => {});
      }

      const ref = String(data.order_id).slice(0, 8).toUpperCase();
      const message = encodeURIComponent(
        `Hi Tsakani Sessions! I'd like to buy ${quantity} x ${ticketName} (R${data.total_zar}) for "${eventTitle}" on ${eventDateLabel}.\n\nName: ${name.trim()}\nOrder ref: ${ref}`,
      );
      window.location.href = `https://wa.me/${whatsappNumber}?text=${message}`;
    } catch {
      setError("Something went wrong. Please check your connection and try again.");
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-track="ticket_buy_click"
        data-track-props={JSON.stringify({ event: eventSlug, ticket: ticketName, price: priceZar })}
        className="bg-gold-gradient text-black font-semibold px-5 py-2.5 rounded-full inline-flex items-center justify-center gap-2 hover:opacity-90 transition-opacity whitespace-nowrap"
      >
        <MessageCircle size={14} />
        {isFree ? "Get free ticket" : "Buy on WhatsApp"}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ticket-checkout-title"
          onClick={() => !submitting && setOpen(false)}
        >
          <div
            className="bg-dark-700 border border-white/10 rounded-2xl w-full max-w-md p-6 relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={submitting}
              aria-label="Close"
              className="absolute top-4 right-4 text-gray-400 hover:text-white disabled:opacity-40"
            >
              <X size={18} />
            </button>

            <h2 id="ticket-checkout-title" className="text-white font-bold text-lg pr-6">
              {isFree ? "Get your free ticket" : `Buy ${ticketName}`}
            </h2>
            <p className="text-gray-400 text-sm mt-1">
              {eventTitle}, {eventDateLabel}
            </p>

            <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-xs text-gray-400">Your name</span>
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  className="bg-dark-800 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-gold-500"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-xs text-gray-400">Email</span>
                <input
                  required
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  className="bg-dark-800 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-gold-500"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-xs text-gray-400">WhatsApp number</span>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  autoComplete="tel"
                  placeholder="082 123 4567"
                  className="bg-dark-800 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-gold-500"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-xs text-gray-400">How many?</span>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
                  className="bg-dark-800 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-gold-500 w-24"
                />
              </label>

              <label className="flex items-start gap-2 text-xs text-gray-400 mt-1">
                <input
                  type="checkbox"
                  checked={joinList}
                  onChange={(e) => setJoinList(e.target.checked)}
                  className="mt-0.5"
                />
                <span>Tell me about future Tsakani Sessions events. You can opt out anytime.</span>
              </label>

              {captchaRequired && <Turnstile onToken={setCaptchaToken} />}

              {error && (
                <p className="text-red-400 text-sm bg-red-400/10 rounded-lg px-3 py-2">{error}</p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="bg-gold-gradient text-black font-semibold px-5 py-3 rounded-full inline-flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-60 mt-1"
              >
                {submitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Reserving
                  </>
                ) : (
                  <>
                    <MessageCircle size={16} />
                    Confirm on WhatsApp
                  </>
                )}
              </button>

              <p className="text-[11px] text-gray-500 text-center">
                We&apos;ll open WhatsApp with your order reference so the team can confirm payment.
              </p>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
