"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Ticket as TicketIcon,
  X,
  Loader2,
  Check,
  MessageCircle,
  Mail,
  ExternalLink,
} from "lucide-react";
import Turnstile from "@/components/Turnstile";
import QRCodeDisplay from "@/components/QRCodeDisplay";

/**
 * Captures WHO is coming, then actually confirms it to them.
 *
 * Two earlier versions of this: first a bare wa.me link, which recorded an
 * anonymous click and nothing else, so the buyer existed only in a WhatsApp
 * thread. Then a form that took their details and immediately redirected them
 * into a chat with a number they had never seen. People found the second one
 * uncomfortable — being thrown at a stranger's WhatsApp is not a receipt — and
 * some abandoned the purchase there.
 *
 * Now the confirmation happens here: order number, QR code, what to do next,
 * and an email carrying the same thing. WhatsApp is still offered, because some
 * people prefer it, but it is a button they may press, never a redirect.
 */

interface Props {
  ticketId: string;
  ticketName: string;
  priceZar: number;
  eventTitle: string;
  eventSlug: string;
  eventDateLabel: string;
  whatsappNumber: string;
  /** 1-12, in South African local time. The month a birthday has to match. */
  eventMonth?: number;
  /** False for a night that cannot absorb free groups. */
  birthdayPackage?: boolean;
}

/** Birthday person plus four friends. Mirrors birthday_group_max() in the database. */
const BIRTHDAY_GROUP_MAX = 5;

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

interface Confirmation {
  order_ref: string;
  qr_code: string;
  total_zar: number;
  ticket_name: string;
  event_title: string;
  event_date_label: string;
  payment_url: string | null;
  payment_note: string | null;
  ticket_url: string;
  emailed: boolean;
  is_birthday_vip: boolean;
  birthday_group: number;
}

function httpUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

export default function TicketCheckout({
  ticketId,
  ticketName,
  priceZar,
  eventTitle,
  eventSlug,
  eventDateLabel,
  whatsappNumber,
  eventMonth,
  birthdayPackage = true,
}: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  // "" until they choose. Asked only when the offer is actually available, so
  // nobody hands over a birthday for nothing.
  const [birthMonth, setBirthMonth] = useState<string>("");
  const [birthDay, setBirthDay] = useState<string>("");
  // number | "" : the field is allowed to sit empty *while editing* so it can be
  // cleared and retyped. A plain number input that snaps an empty value back to
  // 1 on every keystroke makes it impossible to backspace and change the count.
  const [quantity, setQuantity] = useState<number | "">(1);
  const [joinList, setJoinList] = useState(true);
  const [captchaToken, setCaptchaToken] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const captchaRequired = !!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const isFree = priceZar === 0;

  // The offer only exists if this event is in some month, the event allows it,
  // and there is something to give — a night that is already free cannot make
  // entry any freer, so pitching "free entry" there would be noise.
  const birthdayOffered = birthdayPackage && !!eventMonth;
  const monthMatches = !!eventMonth && Number(birthMonth) === eventMonth;
  const qualifies = birthdayOffered && monthMatches;

  // Ticket count is 1–20. Kept as a helper so the field, the +/- steppers and
  // the submit handler all clamp the same way.
  const clampQty = (n: number) => Math.max(1, Math.min(20, Math.floor(n)));
  const qtyValue = quantity === "" ? 1 : quantity;

  // When the modal swaps the form out for the confirmation, the element that had
  // focus (the submit button) is unmounted and focus falls back to <body>. A
  // screen reader user would hear nothing at all — the best news in the flow,
  // silently. Move focus to the heading instead, which announces it.
  useEffect(() => {
    if (confirmation) headingRef.current?.focus();
  }, [confirmation]);

  // Escape closes, as any dialog should.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !submitting) close();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, submitting, confirmation]);

  function close() {
    setOpen(false);
    // Keep the confirmation until the modal is fully dismissed, then reset, so
    // reopening starts a fresh order instead of re-showing the last receipt.
    if (confirmation) {
      setConfirmation(null);
      setName("");
      setEmail("");
      setPhone("");
      setQuantity(1);
      setCaptchaToken("");
      setBirthMonth("");
      setBirthDay("");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    // Enter can submit without ever blurring the field, so normalise here too:
    // an empty or out-of-range count becomes a valid one for the request and
    // for the confirmation screen that reads `quantity` back.
    const qty = clampQty(qtyValue);
    if (qty !== quantity) setQuantity(qty);

    try {
      const res = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticket_id: ticketId,
          buyer_name: name.trim(),
          buyer_email: email.trim(),
          buyer_phone: phone.trim() || null,
          quantity: qty,
          captcha_token: captchaToken,
          birthday_month: birthMonth ? Number(birthMonth) : null,
          birthday_day: birthDay ? Number(birthDay) : null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        // The order was NOT captured, so do not show them a confirmation
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

      setConfirmation(data as Confirmation);
      setSubmitting(false);
    } catch {
      setError("Something went wrong. Please check your connection and try again.");
      setSubmitting(false);
    }
  }

  const payUrl = confirmation && confirmation.total_zar > 0 ? httpUrl(confirmation.payment_url) : null;
  const confirmedFree = confirmation ? confirmation.total_zar <= 0 : isFree;

  const waMessage = confirmation
    ? encodeURIComponent(
        `Hi Tsakani Sessions! I've booked ${quantity} x ${confirmation.ticket_name} for "${eventTitle}" on ${eventDateLabel}.\n\nName: ${name.trim()}\nOrder: ${confirmation.order_ref}`
      )
    : "";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-track="ticket_buy_click"
        data-track-props={JSON.stringify({ event: eventSlug, ticket: ticketName, price: priceZar })}
        className="bg-gold-gradient text-black font-semibold px-5 py-2.5 rounded-full inline-flex items-center justify-center gap-2 hover:opacity-90 transition-opacity whitespace-nowrap"
      >
        <TicketIcon size={14} />
        {isFree ? "Get free ticket" : "Get ticket"}
      </button>

      {open && (
        <div
          /* items-start, not items-center: the confirmation state is much taller
             than the form, and centring content taller than the viewport pushes
             its top edge above scrollTop=0 where it can never be scrolled to —
             the buyer would lose the heading, the tick and the close button. */
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/80 p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ticket-checkout-title"
          onClick={() => !submitting && close()}
        >
          <div
            className="bg-dark-700 border border-white/10 rounded-2xl w-full max-w-md p-6 relative my-8"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={close}
              disabled={submitting}
              aria-label="Close"
              className="absolute top-4 right-4 text-gray-400 hover:text-white disabled:opacity-40"
            >
              <X size={18} />
            </button>

            {confirmation ? (
              /* ── Confirmed ──────────────────────────────── */
              <div>
                <div className="w-12 h-12 rounded-full bg-gold-500/10 border border-gold-500/25 flex items-center justify-center">
                  <Check size={22} className="text-gold-500" />
                </div>

                <h2
                  id="ticket-checkout-title"
                  ref={headingRef}
                  tabIndex={-1}
                  className="text-white font-bold text-xl mt-4 pr-6 focus:outline-none"
                >
                  {confirmedFree ? "You're on the list" : "We've got you"}
                  {name.trim() ? `, ${name.trim().split(" ")[0]}` : ""}.
                </h2>
                <p className="text-gray-400 text-sm mt-1.5 leading-relaxed">
                  Your {confirmedFree ? "free ticket" : "ticket"} to{" "}
                  <span className="text-white">{confirmation.event_title || eventTitle}</span> is
                  booked.
                </p>

                <div className="mt-5 bg-dark-800 border border-white/10 rounded-xl p-4 text-center">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500">
                    Order number
                  </p>
                  <p className="text-2xl font-bold text-gold-500 tracking-wider mt-1">
                    {confirmation.order_ref}
                  </p>
                  <div className="mt-4 flex justify-center">
                    <QRCodeDisplay
                      url={confirmation.ticket_url}
                      size={160}
                      label="Show this at the door"
                      showUrl={false}
                    />
                  </div>
                  <div className="mt-4 pt-3 border-t border-white/10 text-sm text-gray-300">
                    {quantity} &times; {confirmation.ticket_name}
                    <span className="text-gold-500 ml-2 font-semibold">
                      {confirmedFree
                        ? "Free"
                        : `R${confirmation.total_zar.toLocaleString("en-ZA")}`}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {confirmation.event_date_label || eventDateLabel}
                  </p>
                </div>

                {/* The two perks the database cannot deliver are spelled out
                    here, because the buyer has to know to expect them — and to
                    bring ID, which is the one thing that can cost them the
                    package on the night. */}
                {confirmation.is_birthday_vip && (
                  <div className="mt-4 bg-gold-500/10 border border-gold-500/30 rounded-xl p-4">
                    <p className="text-sm font-bold text-gold-500">
                      🎂 Happy birthday month, {name.trim().split(" ")[0] || "friend"}!
                    </p>
                    <ul className="text-sm text-gray-300 leading-relaxed mt-2 space-y-1">
                      <li>
                        • You and your{" "}
                        {Math.max(0, quantity === "" ? 0 : quantity - 1)} guest
                        {quantity !== 1 ? "s" : ""} are in <strong>free</strong>
                      </li>
                      <li>• A table is reserved for your group</li>
                      <li>• The DJ gives you a shout-out on the night</li>
                    </ul>
                    <p className="text-xs text-gold-400/90 mt-3 leading-relaxed">
                      Bring your ID — the door checks it against your birthday before letting the
                      group in.
                    </p>
                  </div>
                )}

                {/* A free ticket is already theirs. Never mention paying. */}
                {confirmedFree ? (
                  <div className="mt-4 bg-gold-500/5 border border-gold-500/20 rounded-xl p-4">
                    <p className="text-sm text-gray-300 leading-relaxed">
                      <span className="text-gold-500 font-semibold">Nothing to pay.</span> This one
                      is on us — just bring this ticket to the door.
                    </p>
                  </div>
                ) : (
                  <div className="mt-4 bg-gold-500/5 border border-gold-500/20 rounded-xl p-4">
                    <p className="text-sm text-gray-300 leading-relaxed">
                      <span className="text-gold-500 font-semibold">Your spot is held.</span> It
                      becomes a confirmed ticket once payment lands.
                    </p>
                    {confirmation.payment_note && (
                      <p className="text-sm text-gray-400 leading-relaxed mt-2 whitespace-pre-line">
                        {confirmation.payment_note}
                      </p>
                    )}
                    {payUrl ? (
                      <a
                        href={payUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        data-track="ticket_payment_click"
                        data-track-props={JSON.stringify({ event: eventSlug })}
                        className="mt-4 w-full bg-gold-gradient text-black font-semibold px-5 py-2.5 rounded-full inline-flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
                      >
                        Pay R{confirmation.total_zar.toLocaleString("en-ZA")} now
                        <ExternalLink size={14} />
                      </a>
                    ) : (
                      !confirmation.payment_note && (
                        <p className="text-sm text-gray-400 leading-relaxed mt-2">
                          We&apos;ll be in touch shortly with payment details. Quote your order
                          number.
                        </p>
                      )
                    )}
                  </div>
                )}

                <p className="text-xs text-gray-500 mt-4 flex items-start gap-2 leading-relaxed">
                  <Mail size={13} className="mt-0.5 shrink-0" />
                  {confirmation.emailed ? (
                    <span>
                      We&apos;ve emailed your ticket to{" "}
                      <span className="text-gray-400">{email.trim()}</span>. Check your spam folder
                      if it&apos;s not there in a minute.
                    </span>
                  ) : (
                    <span>
                      Save your order number — we couldn&apos;t send the email just now, but your
                      booking is safe.
                    </span>
                  )}
                </p>

                <div className="mt-5 flex flex-col gap-2">
                  <Link
                    href={`/ticket/${confirmation.qr_code}`}
                    className="w-full border border-white/10 text-gray-200 font-semibold px-5 py-2.5 rounded-full inline-flex items-center justify-center gap-2 hover:bg-white/5 transition-colors text-sm"
                  >
                    <TicketIcon size={14} />
                    Open my ticket
                  </Link>
                  {/* Offered, never forced. */}
                  <a
                    href={`https://wa.me/${whatsappNumber}?text=${waMessage}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-track="ticket_whatsapp_optional"
                    className="w-full border border-gold-500/30 text-gold-500 font-semibold px-5 py-2.5 rounded-full inline-flex items-center justify-center gap-2 hover:bg-gold-500/10 transition-colors text-sm"
                  >
                    <MessageCircle size={14} />
                    Message us on WhatsApp
                  </a>
                  <button
                    type="button"
                    onClick={close}
                    className="text-gray-500 hover:text-gray-300 text-sm py-1 transition-colors"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              /* ── Form ───────────────────────────────────── */
              <>
                <h2 id="ticket-checkout-title" className="text-white font-bold text-lg pr-6">
                  {isFree ? "Get your free ticket" : `Get ${ticketName}`}
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
                    <span className="text-[11px] text-gray-500">
                      We send your ticket and QR code here.
                    </span>
                  </label>

                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-gray-400">
                      WhatsApp number <span className="text-gray-600">(optional)</span>
                    </span>
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
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        aria-label="One fewer ticket"
                        onClick={() => setQuantity(clampQty(qtyValue - 1))}
                        disabled={qtyValue <= 1}
                        className="w-10 h-10 shrink-0 rounded-lg border border-white/10 bg-dark-800 text-white text-xl leading-none flex items-center justify-center hover:border-gold-500 focus:outline-none focus:border-gold-500 disabled:opacity-40 disabled:hover:border-white/10"
                      >
                        &minus;
                      </button>
                      <input
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={20}
                        value={quantity}
                        onChange={(e) => {
                          const raw = e.target.value;
                          // Let the field go empty mid-edit so it can be cleared
                          // and retyped; clamp on blur/submit, not per keystroke.
                          if (raw === "") {
                            setQuantity("");
                            return;
                          }
                          const n = Number(raw);
                          if (Number.isNaN(n)) return;
                          setQuantity(clampQty(n));
                        }}
                        onBlur={() => setQuantity(clampQty(qtyValue))}
                        className="bg-dark-800 border border-white/10 rounded-lg px-3 py-2 text-white text-center focus:outline-none focus:border-gold-500 w-16"
                      />
                      <button
                        type="button"
                        aria-label="One more ticket"
                        // From an empty field, land on 1 rather than jumping to 2.
                        onClick={() => setQuantity(quantity === "" ? 1 : clampQty(quantity + 1))}
                        disabled={qtyValue >= 20}
                        className="w-10 h-10 shrink-0 rounded-lg border border-white/10 bg-dark-800 text-white text-xl leading-none flex items-center justify-center hover:border-gold-500 focus:outline-none focus:border-gold-500 disabled:opacity-40 disabled:hover:border-white/10"
                      >
                        +
                      </button>
                    </div>
                  </label>

                  {/* ── Birthday package ──────────────────────
                      Pitched before it is asked for. "When is your birthday?"
                      on a ticket form reads as data collection; the offer first
                      makes it obvious why we want it and what they get back. */}
                  {birthdayOffered && (
                    <div
                      className={`rounded-xl border p-3.5 transition-colors ${
                        qualifies
                          ? "border-gold-500/50 bg-gold-500/10"
                          : "border-white/10 bg-dark-800"
                      }`}
                    >
                      <p className="text-sm font-semibold text-gold-500 flex items-center gap-1.5">
                        🎂 Birthday month?
                      </p>
                      <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                        If this event falls in your birthday month, you and up to{" "}
                        {BIRTHDAY_GROUP_MAX - 1} friends come in <strong>free</strong>, we hold a
                        table for you, and the DJ gives you a shout-out.
                      </p>

                      <div className="flex gap-2 mt-3">
                        <select
                          value={birthMonth}
                          onChange={(e) => setBirthMonth(e.target.value)}
                          aria-label="Birthday month"
                          className="flex-1 bg-dark-900 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-gold-500"
                        >
                          <option value="">Month</option>
                          {MONTHS.map((m, i) => (
                            <option key={m} value={i + 1}>
                              {m}
                            </option>
                          ))}
                        </select>
                        <select
                          value={birthDay}
                          onChange={(e) => setBirthDay(e.target.value)}
                          aria-label="Birthday day"
                          className="w-24 bg-dark-900 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-gold-500"
                        >
                          <option value="">Day</option>
                          {Array.from({ length: 31 }, (_, i) => (
                            <option key={i + 1} value={i + 1}>
                              {i + 1}
                            </option>
                          ))}
                        </select>
                      </div>

                      {qualifies && (
                        <p className="text-xs text-gold-400 mt-2.5 leading-relaxed">
                          <strong>It&apos;s your month!</strong>{" "}
                          {qtyValue > BIRTHDAY_GROUP_MAX ? (
                            <>
                              The package covers {BIRTHDAY_GROUP_MAX} people — set &ldquo;How
                              many?&rdquo; to {BIRTHDAY_GROUP_MAX} or fewer to claim it.
                            </>
                          ) : (
                            <>
                              Bring up to {BIRTHDAY_GROUP_MAX - 1} friends free. Bring ID on the
                              night — the door checks it.
                            </>
                          )}
                        </p>
                      )}
                      {birthMonth && !monthMatches && (
                        <p className="text-xs text-gray-500 mt-2.5 leading-relaxed">
                          Not this one — but book a Tsakani Sessions in {MONTHS[Number(birthMonth) - 1]} and
                          it&apos;s yours.
                        </p>
                      )}
                    </div>
                  )}

                  <label className="flex items-start gap-2 text-xs text-gray-400 mt-1">
                    <input
                      type="checkbox"
                      checked={joinList}
                      onChange={(e) => setJoinList(e.target.checked)}
                      className="mt-0.5"
                    />
                    <span>
                      Tell me about future Tsakani Sessions events. You can opt out anytime.
                    </span>
                  </label>

                  {captchaRequired && <Turnstile onToken={setCaptchaToken} />}

                  {error && (
                    <p className="text-red-400 text-sm bg-red-400/10 rounded-lg px-3 py-2">
                      {error}
                    </p>
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
                        <TicketIcon size={16} />
                        {isFree ? "Get my free ticket" : "Reserve my ticket"}
                      </>
                    )}
                  </button>

                  <p className="text-[11px] text-gray-500 text-center leading-relaxed">
                    You&apos;ll get your order number and QR code right away, and a copy by email.
                  </p>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
