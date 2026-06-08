"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Check, MessageCircle, ShoppingBag, Copy } from "lucide-react";

const STORAGE_KEY = "tsakani_pending_order_v1";
const WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "27769961477";

interface PendingOrder {
  message: string;
  total: number;
}

function SuccessContent() {
  const params = useSearchParams();
  const orderId = params.get("orderId") || "";
  const totalParam = params.get("total");
  const [payload, setPayload] = useState<PendingOrder | null>(null);
  const [sent, setSent] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) setPayload(JSON.parse(raw) as PendingOrder);
    } catch {
      // ignore — fall back to query-param total
    }
  }, []);

  const totalRand = payload?.total ?? (totalParam ? Number(totalParam) : null);

  function sendWhatsApp() {
    if (!payload) return;
    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
      payload.message
    )}`;
    window.open(url, "_blank");
    setSent(true);
    // Clear only after the user has actually clicked through
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }

  async function copyOrderId() {
    if (!orderId) return;
    try {
      await navigator.clipboard.writeText(orderId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore — clipboard might be unavailable
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
      <div className="bg-dark-500 border border-gold-500/20 rounded-2xl p-8 sm:p-10">
        <div className="flex items-start gap-4 mb-6">
          <div className="bg-gold-500/15 w-12 h-12 rounded-full flex items-center justify-center shrink-0">
            <Check size={24} className="text-gold-500" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold mb-1">
              Order received
            </h1>
            <p className="text-gray-400 text-sm leading-relaxed">
              We&apos;ve saved your order. Send it through on WhatsApp so we
              can confirm availability and payment details.
            </p>
          </div>
        </div>

        {orderId && (
          <div className="bg-dark-300/60 border border-white/10 rounded-xl p-4 mb-5">
            <p className="text-xs uppercase tracking-wider text-gray-500 mb-1">
              Your order ID
            </p>
            <div className="flex items-center justify-between gap-3">
              <code className="text-gold-500 font-mono text-sm break-all">
                {orderId}
              </code>
              <button
                onClick={copyOrderId}
                className="shrink-0 flex items-center gap-1.5 text-xs text-gray-400 hover:text-gold-500 transition-colors"
                aria-label="Copy order ID"
              >
                <Copy size={13} aria-hidden="true" />
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <p className="text-gray-500 text-xs mt-2">
              Keep this handy in case you need to reference your order.
            </p>
          </div>
        )}

        {totalRand !== null && (
          <div className="flex items-center justify-between mb-6 bg-dark-300/40 rounded-xl px-4 py-3">
            <span className="text-gray-400 text-sm">Total</span>
            <span className="text-gold-500 font-bold text-lg">
              R{totalRand}
            </span>
          </div>
        )}

        {!sent ? (
          payload ? (
            <button
              onClick={sendWhatsApp}
              data-track="order_whatsapp_sent"
              className="w-full bg-gold-gradient text-black font-semibold py-3 rounded-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2 mb-3"
            >
              <MessageCircle size={18} aria-hidden="true" />
              Send order via WhatsApp
            </button>
          ) : (
            <div className="bg-dark-300/40 border border-white/10 rounded-xl p-4 mb-3 text-sm text-gray-400 leading-relaxed">
              Your order is saved. WhatsApp us at{" "}
              <a
                href={`https://wa.me/${WHATSAPP_NUMBER}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-gold-500 hover:text-gold-400 underline"
              >
                +{WHATSAPP_NUMBER.replace(/^27/, "27 ")}
              </a>{" "}
              and quote the order ID above to confirm payment details.
            </div>
          )
        ) : (
          <div className="bg-gold-500/10 border border-gold-500/30 rounded-xl p-4 mb-3 flex items-start gap-3">
            <Check
              size={18}
              className="text-gold-500 mt-0.5 shrink-0"
              aria-hidden="true"
            />
            <p className="text-sm text-gray-200 leading-relaxed">
              WhatsApp opened in a new tab. Send the message there and
              we&apos;ll reply with payment details shortly.
            </p>
          </div>
        )}

        <div className="border-t border-white/10 pt-5 mt-5">
          <h2 className="text-sm font-semibold text-gray-300 mb-2">
            What happens next
          </h2>
          <ol className="text-sm text-gray-400 space-y-1.5 list-decimal pl-5">
            <li>We confirm availability and send you payment details.</li>
            <li>You pay via EFT or as agreed in the WhatsApp chat.</li>
            <li>We dispatch or hand over your order once payment clears.</li>
          </ol>
          <p className="text-xs text-gray-500 mt-4">
            Orders that aren&apos;t paid within 48 hours are automatically
            cancelled. See our{" "}
            <Link
              href="/refund-policy"
              className="text-gold-500 hover:text-gold-400 underline"
            >
              refund policy
            </Link>
            .
          </p>
        </div>

        <div className="flex items-center justify-center gap-3 mt-8 pt-5 border-t border-white/10">
          <Link
            href="/shop"
            className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gold-500 transition-colors"
          >
            <ShoppingBag size={14} aria-hidden="true" />
            Back to shop
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function OrderSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-2xl mx-auto px-4 py-24 text-center text-gray-400">
          Loading...
        </div>
      }
    >
      <SuccessContent />
    </Suspense>
  );
}
