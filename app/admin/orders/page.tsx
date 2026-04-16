import { ShoppingBag } from "lucide-react";

export default function AdminOrdersPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold">Merch Orders</h1>
        <p className="text-gray-400 mt-1">Track merchandise orders</p>
      </div>
      <div className="bg-dark-500 border border-white/10 rounded-xl p-12 text-center">
        <ShoppingBag size={32} className="text-gray-600 mx-auto mb-3" />
        <h2 className="text-xl font-bold mb-2">No Orders Yet</h2>
        <p className="text-gray-400 text-sm max-w-md mx-auto">
          Merch orders placed via WhatsApp will be tracked here once connected
          to Supabase. You can update order status and track fulfillment.
        </p>
      </div>
    </div>
  );
}
