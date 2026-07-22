import type { Metadata } from "next";
import UnsubscribeClient from "./UnsubscribeClient";

export const metadata: Metadata = {
  title: "Unsubscribe — Tsakani Sessions",
  robots: { index: false, follow: false },
};

export default function UnsubscribePage({
  searchParams,
}: {
  searchParams: { token?: string };
}) {
  return (
    <main className="min-h-screen bg-dark-900 px-4 py-16 flex items-start justify-center">
      <div className="w-full max-w-md">
        <p className="text-[11px] tracking-[0.25em] uppercase text-gold-500 font-bold text-center mb-6">
          Tsakani Sessions
        </p>
        <UnsubscribeClient token={searchParams.token || ""} />
      </div>
    </main>
  );
}
