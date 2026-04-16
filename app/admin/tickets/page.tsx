import { Ticket } from "lucide-react";

export default function AdminTicketsPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold">Tickets</h1>
        <p className="text-gray-400 mt-1">Manage ticket orders and check-ins</p>
      </div>
      <div className="bg-dark-500 border border-white/10 rounded-xl p-12 text-center">
        <Ticket size={32} className="text-gray-600 mx-auto mb-3" />
        <h2 className="text-xl font-bold mb-2">No Ticket Orders Yet</h2>
        <p className="text-gray-400 text-sm max-w-md mx-auto">
          When events have tickets and customers purchase them via WhatsApp,
          orders will appear here. You can scan QR codes for check-in.
        </p>
      </div>
    </div>
  );
}
