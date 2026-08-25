"use client";

import { useEffect, useState } from "react";
import { Landmark, Loader2, Check, AlertTriangle, CreditCard, ExternalLink } from "lucide-react";
import { buildPaystackUrl } from "@/lib/paystack";
import type { StoreSettings } from "@/lib/types";

/**
 * Bank details for EFT checkout.
 *
 * These are never rendered on a public page. A buyer sees them once, on their
 * own order confirmation screen and in their email, after the order exists.
 * That keeps the account number off a page anyone can scrape and reuse in a
 * fake invoice, which is the usual way EFT-only stores get people robbed.
 */

const empty: StoreSettings = {
  eft_enabled: false,
  account_holder: "",
  bank_name: "",
  account_number: "",
  branch_code: "",
  account_type: "",
  payment_email: "",
  eft_instructions: "",
  paystack_enabled: false,
  paystack_url: "",
  paystack_note: "",
};

/**
 * A known, memorable amount to test the payment link with.
 *
 * Paystack takes the amount as a query parameter but their pre-filling guide
 * does not say which unit, and everything else in their API is in cents. If
 * that assumption is wrong it is wrong by a factor of a hundred, so rather than
 * guess in silence this opens the real page at R123.45 and asks somebody to
 * look at it. Cents on our side, R123.45 on theirs, means the assumption holds.
 */
const TEST_CENTS = 12345;

export default function AdminStoreSettingsPage() {
  const [form, setForm] = useState<StoreSettings>(empty);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/admin/store-settings");
      if (res.ok) {
        const data = await res.json();
        setForm({
          eft_enabled: !!data.eft_enabled,
          account_holder: data.account_holder || "",
          bank_name: data.bank_name || "",
          account_number: data.account_number || "",
          branch_code: data.branch_code || "",
          account_type: data.account_type || "",
          payment_email: data.payment_email || "",
          eft_instructions: data.eft_instructions || "",
          paystack_enabled: !!data.paystack_enabled,
          paystack_url: data.paystack_url || "",
          paystack_note: data.paystack_note || "",
        });
      }
      setLoading(false);
    })();
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSaved(false);

    const res = await fetch("/api/admin/store-settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Could not save");
    }
    setSaving(false);
  }

  const field = (key: keyof StoreSettings) => ({
    value: (form[key] as string) || "",
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm({ ...form, [key]: e.target.value }),
    className:
      "w-full bg-dark-300 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm focus:border-gold-500 focus:outline-none",
  });

  const testUrl = form.paystack_url
    ? buildPaystackUrl({
        baseUrl: form.paystack_url,
        amountCents: TEST_CENTS,
        email: "test@tsakanisessions.co.za",
        customerName: "Test Buyer",
      })
    : null;

  if (loading) {
    return <div className="text-center py-10 text-gray-500">Loading...</div>;
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold">Store settings</h1>
        <p className="text-gray-400 mt-1">
          How buyers pay for merch, and where the money lands.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-5">
        <div
          className={`rounded-xl border p-5 ${
            form.paystack_enabled
              ? "bg-gold-500/5 border-gold-500/30"
              : "bg-dark-500 border-white/10"
          }`}
        >
          <div className="flex items-start gap-4">
            <CreditCard
              size={20}
              className={form.paystack_enabled ? "text-gold-500 mt-0.5" : "text-gray-500 mt-0.5"}
            />
            <div className="flex-1">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.paystack_enabled}
                  onChange={(e) =>
                    setForm({ ...form, paystack_enabled: e.target.checked })
                  }
                  className="w-4 h-4 accent-yellow-500"
                />
                <span className="font-semibold">Take card payments through Paystack</span>
              </label>
              <p className="text-sm text-gray-400 mt-2 leading-relaxed">
                Paste a Paystack payment page link. Checkout sends the buyer
                there with the amount and their email filled in and locked, so
                there is nothing for them to mistype.
              </p>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Paystack payment link
              </label>
              <input
                {...field("paystack_url")}
                type="url"
                maxLength={500}
                placeholder="https://paystack.shop/pay/your-page"
                autoComplete="off"
              />
              <p className="text-xs text-gray-500 mt-1.5">
                Must be on paystack.com or paystack.shop. Anything else is
                refused, because this is where buyers type card details.
              </p>
            </div>

            {testUrl && (
              <div className="bg-dark-300/50 border border-white/10 rounded-lg p-4">
                <p className="text-sm font-medium mb-1.5">
                  Check this before you switch it on
                </p>
                <p className="text-xs text-gray-400 leading-relaxed mb-3">
                  Open the link below. Paystack should show{" "}
                  <strong className="text-white">R123.45</strong>. If it shows
                  R12&nbsp;345 instead, stop and tell me, the amount unit is the
                  other way round and every order would be charged a hundred
                  times over.
                </p>
                <a
                  href={testUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-gold-500 hover:text-gold-400"
                >
                  <ExternalLink size={14} />
                  Test the link at R123.45
                </a>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-2">
                Note shown with the pay button
              </label>
              <textarea
                {...field("paystack_note")}
                rows={2}
                maxLength={500}
                placeholder="Add your order reference on the payment page so we can match it."
                className="w-full bg-dark-300 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm focus:border-gold-500 focus:outline-none resize-y"
              />
            </div>
          </div>
        </div>

        <div
          className={`rounded-xl border p-5 flex items-start gap-4 ${
            form.eft_enabled
              ? "bg-gold-500/5 border-gold-500/30"
              : "bg-dark-500 border-white/10"
          }`}
        >
          <Landmark
            size={20}
            className={form.eft_enabled ? "text-gold-500 mt-0.5" : "text-gray-500 mt-0.5"}
          />
          <div className="flex-1">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.eft_enabled}
                onChange={(e) =>
                  setForm({ ...form, eft_enabled: e.target.checked })
                }
                className="w-4 h-4 accent-yellow-500"
              />
              <span className="font-semibold">Take EFT payments on the shop</span>
            </label>
            <p className="text-sm text-gray-400 mt-2 leading-relaxed">
              With this off, checkout only offers WhatsApp and nobody sees these
              details. With it on, a buyer gets the account and a payment
              reference the moment they place an order, and again by email.
            </p>
          </div>
        </div>

        {error && (
          <p className="bg-red-500/10 border border-red-500/30 text-red-300 text-sm rounded-lg px-4 py-3 flex items-start gap-2">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            {error}
          </p>
        )}

        <div className="bg-dark-500 border border-white/10 rounded-xl p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Account holder *
            </label>
            <input {...field("account_holder")} maxLength={120} placeholder="Tsakani Sessions" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Bank *</label>
              <input {...field("bank_name")} maxLength={80} placeholder="FNB" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">
                Account number *
              </label>
              <input
                {...field("account_number")}
                maxLength={40}
                inputMode="numeric"
                autoComplete="off"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">
                Branch code
              </label>
              <input {...field("branch_code")} maxLength={20} placeholder="250655" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">
                Account type
              </label>
              <input {...field("account_type")} maxLength={40} placeholder="Cheque" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Proof of payment email
            </label>
            <input
              {...field("payment_email")}
              type="email"
              maxLength={254}
              placeholder="orders@tsakanisessions.co.za"
            />
            <p className="text-xs text-gray-500 mt-1.5">
              Optional. Shown to the buyer as where to send proof. Leave blank
              and they are just told to use the reference.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Extra instructions
            </label>
            <textarea
              {...field("eft_instructions")}
              rows={3}
              maxLength={1000}
              placeholder="Orders are dispatched once payment reflects, usually one working day."
              className="w-full bg-dark-300 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm focus:border-gold-500 focus:outline-none resize-y"
            />
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={saving}
            className="bg-gold-gradient text-black font-semibold px-5 py-2.5 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2"
          >
            {saving && <Loader2 size={16} className="animate-spin" />}
            {saving ? "Saving..." : "Save"}
          </button>
          {saved && (
            <span className="text-green-400 text-sm flex items-center gap-1.5">
              <Check size={15} />
              Saved
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
