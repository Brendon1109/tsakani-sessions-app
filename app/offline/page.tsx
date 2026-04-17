import Link from "next/link";
import { WifiOff } from "lucide-react";

export default function OfflinePage() {
  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="bg-gold-500/10 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
          <WifiOff size={36} className="text-gold-500" aria-hidden="true" />
        </div>
        <h1 className="text-2xl font-bold mb-3">You&apos;re offline</h1>
        <p className="text-gray-400 mb-6">
          Check your connection and try again. Some content may be cached and
          still available.
        </p>
        <Link
          href="/"
          className="inline-block bg-gold-gradient text-black font-semibold px-6 py-2.5 rounded-full hover:opacity-90 transition-opacity"
        >
          Try Homepage
        </Link>
      </div>
    </div>
  );
}
