import type { Metadata } from "next";
import { MessageCircle } from "lucide-react";
import { FAQS, faqPageJsonLd, jsonLdScript } from "@/lib/seo";
import BreadcrumbJsonLd from "@/components/BreadcrumbJsonLd";

export const metadata: Metadata = {
  title: "FAQ — Booking, Services & Areas",
  description:
    "Answers to common questions about Tsakani Sessions: what we do, our DJ and event services, how to book, pricing, merch, and the Cape Town areas we serve.",
  alternates: { canonical: "/faq" },
  openGraph: {
    title: "Tsakani Sessions FAQ",
    description:
      "How to book Tsakani Sessions, what we offer, pricing, and the Cape Town areas we serve.",
    url: "/faq",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Tsakani Sessions FAQ",
    description:
      "How to book, what we offer, pricing, and the areas we serve in Cape Town.",
  },
};

export default function FaqPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(faqPageJsonLd()) }}
      />
      <BreadcrumbJsonLd
        items={[
          { name: "Home", path: "/" },
          { name: "FAQ", path: "/faq" },
        ]}
      />

      <section className="py-16 sm:py-24 px-4">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl sm:text-5xl font-bold mb-4">
              Frequently Asked{" "}
              <span className="text-gold-gradient">Questions</span>
            </h1>
            <p className="text-gray-400 max-w-xl mx-auto text-lg">
              Everything you need to know about booking Tsakani Sessions for
              your next event in Cape Town.
            </p>
          </div>

          <div className="space-y-4">
            {FAQS.map((faq) => (
              <details
                key={faq.question}
                className="group bg-dark-500 border border-white/10 rounded-2xl p-6 open:border-gold-500/30 transition-colors"
              >
                <summary className="flex items-center justify-between cursor-pointer list-none font-semibold text-lg">
                  {faq.question}
                  <span className="text-gold-500 ml-4 shrink-0 transition-transform group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="text-gray-400 leading-relaxed mt-4">
                  {faq.answer}
                </p>
              </details>
            ))}
          </div>

          <div className="mt-12 text-center">
            <p className="text-gray-400 mb-4">Still have a question?</p>
            <a
              href="https://wa.me/27769961477?text=Hi%20Tsakani%20Sessions!%20I%20have%20a%20question."
              target="_blank"
              rel="noopener noreferrer"
              data-track="contact_click"
              data-track-props='{"kind":"wa.me","source":"faq"}'
              className="bg-gold-gradient text-black font-semibold px-8 py-3.5 rounded-full hover:opacity-90 transition-opacity inline-flex items-center gap-2"
            >
              <MessageCircle size={18} />
              Ask on WhatsApp
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
