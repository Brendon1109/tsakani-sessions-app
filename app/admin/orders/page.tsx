"use client";

import { useEffect, useMemo, useState } from "react";
import { ShoppingBag, Mail } from "lucide-react";
import SearchPagination from "@/components/SearchPagination";

interface OrderItem {
  name: string;
  size?: string;
  color?: string;
  qty: number;
  price: number;
}

interface OrderRow {
  id: string;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  items: OrderItem[] | null;
  total_zar: number;
  status: string;
  payment_method: string | null;
  payment_reference: string | null;
  created_at: string;
}

const STATUSES = ["pending", "confirmed", "shipped", "delivered", "cancelled"];

const PAGE_SIZE = 25;

const statusColors: Record<string, string> = {
  pending: "text-yellow-400 bg-yellow-400/10",
  confirmed: "text-green-400 bg-green-400/10",
  shipped: "text-blue-400 bg-blue-400/10",
  delivered: "text-gray-300 bg-white/10",
  cancelled: "text-red-400 bg-red-400/10",
};

// orders.total_zar is stored in cents (see app/api/orders/route.ts).
function rands(cents: number): string {
  return `R${Math.round(cents / 100).toLocaleString("en-ZA")}`;
}

function itemsSummary(items: OrderItem[] | null): string {
  if (!Array.isArray(items) || items.length === 0) return "—";
  return items.map((it) => `${it.name} x${it.qty}`).join(", ");
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    loadOrders();
  }, []);

  async function loadOrders() {
    setLoading(true);
    const res = await fetch("/api/admin/orders");
    if (res.ok) setOrders(await res.json());
    setLoading(false);
  }

  // EFT has no gateway telling us the money landed. Somebody checks the bank
  // against the reference and moves the order along here, which is the whole
  // reconciliation step.
  async function updateStatus(id: string, status: string) {
    setUpdating(id);
    const res = await fetch("/api/admin/orders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    if (res.ok) {
      const updated = await res.json();
      setOrders((prev) => prev.map((o) => (o.id === id ? updated : o)));
    }
    setUpdating(null);
  }

  const filtered = useMemo(() => {
    if (!search) return orders;
    const q = search.toLowerCase();
    return orders.filter(
      (o) =>
        o.customer_name?.toLowerCase().includes(q) ||
        o.customer_email?.toLowerCase().includes(q) ||
        o.customer_phone?.toLowerCase().includes(q) ||
        o.payment_reference?.toLowerCase().includes(q) ||
        itemsSummary(o.items).toLowerCase().includes(q)
    );
  }, [orders, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold">Merch Orders</h1>
        <p className="text-gray-400 mt-1">Track merchandise orders</p>
      </div>

      {loading ? (
        <div className="text-center py-10 text-gray-500">Loading...</div>
      ) : orders.length === 0 ? (
        <div className="bg-dark-500 border border-white/10 rounded-xl p-12 text-center">
          <ShoppingBag size={32} className="text-gray-600 mx-auto mb-3" />
          <h2 className="text-xl font-bold mb-2">No Orders Yet</h2>
          <p className="text-gray-400 text-sm max-w-md mx-auto">
            Merch orders placed on the shop are saved here. Mark an EFT order
            confirmed once the payment shows in the account, then shipped when
            it goes out.
          </p>
        </div>
      ) : (
        <>
          <SearchPagination
            searchValue={search}
            onSearchChange={(v) => {
              setSearch(v);
              setPage(1);
            }}
            placeholder="Search by customer, contact, reference, or item..."
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
            totalItems={filtered.length}
          />
          <div className="bg-dark-500 border border-white/10 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left p-4 text-gray-400 font-medium">Customer</th>
                    <th className="text-left p-4 text-gray-400 font-medium">Contact</th>
                    <th className="text-left p-4 text-gray-400 font-medium">Items</th>
                    <th className="text-left p-4 text-gray-400 font-medium">Total</th>
                    <th className="text-left p-4 text-gray-400 font-medium">Payment</th>
                    <th className="text-left p-4 text-gray-400 font-medium">Status</th>
                    <th className="text-left p-4 text-gray-400 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((order) => (
                    <tr key={order.id} className="border-b border-white/5 hover:bg-white/5">
                      <td className="p-4 font-medium">{order.customer_name || "—"}</td>
                      <td className="p-4">
                        <div className="flex flex-col gap-0.5">
                          {order.customer_email ? (
                            <a
                              href={`mailto:${order.customer_email}`}
                              className="text-gold-500 hover:underline flex items-center gap-1"
                            >
                              <Mail size={14} />
                              {order.customer_email}
                            </a>
                          ) : null}
                          {order.customer_phone ? (
                            <a
                              href={`tel:${order.customer_phone}`}
                              className="text-gray-400 hover:text-white"
                            >
                              {order.customer_phone}
                            </a>
                          ) : null}
                          {!order.customer_email && !order.customer_phone && (
                            <span className="text-gray-600">—</span>
                          )}
                        </div>
                      </td>
                      <td className="p-4 text-gray-400 max-w-xs truncate" title={itemsSummary(order.items)}>
                        {itemsSummary(order.items)}
                      </td>
                      <td className="p-4 text-gold-500 font-semibold whitespace-nowrap">
                        {rands(order.total_zar)}
                      </td>
                      <td className="p-4 whitespace-nowrap">
                        <span className="text-xs uppercase tracking-wider text-gray-500">
                          {order.payment_method || "—"}
                        </span>
                        {order.payment_reference && (
                          <div className="font-mono text-xs text-gold-500 mt-0.5">
                            {order.payment_reference}
                          </div>
                        )}
                      </td>
                      <td className="p-4">
                        <select
                          value={order.status}
                          disabled={updating === order.id}
                          onChange={(e) => updateStatus(order.id, e.target.value)}
                          aria-label={`Status for ${order.customer_name}`}
                          className={`text-xs px-2 py-1 rounded capitalize bg-transparent border border-white/10 focus:border-gold-500 focus:outline-none disabled:opacity-50 ${
                            statusColors[order.status] || "text-gray-400 bg-white/10"
                          }`}
                        >
                          {STATUSES.map((s) => (
                            <option key={s} value={s} className="bg-dark-500 text-white">
                              {s}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="p-4 text-gray-500 whitespace-nowrap">
                        {new Date(order.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
