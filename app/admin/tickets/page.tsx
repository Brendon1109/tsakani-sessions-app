"use client";

import { useEffect, useMemo, useState } from "react";
import { Ticket, Mail, Check, X } from "lucide-react";
import SearchPagination from "@/components/SearchPagination";

interface TicketOrderRow {
  id: string;
  buyer_name: string;
  buyer_email: string | null;
  buyer_phone: string | null;
  quantity: number;
  total_zar: number;
  status: string;
  created_at: string;
  ticket: { name: string | null; event: { title: string | null } | null } | null;
}

const PAGE_SIZE = 25;

const statusColors: Record<string, string> = {
  pending: "text-yellow-400 bg-yellow-400/10",
  confirmed: "text-green-400 bg-green-400/10",
  used: "text-gray-300 bg-white/10",
  cancelled: "text-red-400 bg-red-400/10",
};

// ticket_orders.total_zar is stored in rands (see create_ticket_order_fn.sql).
function rands(value: number): string {
  return `R${(value || 0).toLocaleString("en-ZA")}`;
}

function eventLabel(row: TicketOrderRow): string {
  return row.ticket?.event?.title || row.ticket?.name || "—";
}

export default function AdminTicketsPage() {
  const [orders, setOrders] = useState<TicketOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadOrders();
  }, []);

  async function loadOrders() {
    setLoading(true);
    const res = await fetch("/api/admin/tickets");
    if (res.ok) setOrders(await res.json());
    setLoading(false);
  }

  async function updateStatus(order: TicketOrderRow, status: string) {
    if (status === "cancelled") {
      const ok = window.confirm(
        `Cancel ${order.quantity} x ${order.buyer_name}? This releases the tickets back to the pool.`
      );
      if (!ok) return;
    }

    setUpdatingId(order.id);
    setError(null);
    const previous = orders;

    // Optimistic, then reconcile with whatever the server actually stored.
    setOrders((rows) =>
      rows.map((r) => (r.id === order.id ? { ...r, status } : r))
    );

    try {
      const res = await fetch("/api/admin/tickets", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: order.id, status }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Could not update the order");
      }
      const saved = await res.json();
      setOrders((rows) =>
        rows.map((r) => (r.id === order.id ? { ...r, status: saved.status } : r))
      );
    } catch (err) {
      setOrders(previous);
      setError(err instanceof Error ? err.message : "Could not update the order");
    } finally {
      setUpdatingId(null);
    }
  }

  const filtered = useMemo(() => {
    if (!search) return orders;
    const q = search.toLowerCase();
    return orders.filter(
      (o) =>
        o.buyer_name?.toLowerCase().includes(q) ||
        o.buyer_email?.toLowerCase().includes(q) ||
        o.buyer_phone?.toLowerCase().includes(q) ||
        eventLabel(o).toLowerCase().includes(q)
    );
  }, [orders, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold">Tickets</h1>
        <p className="text-gray-400 mt-1">Manage ticket orders and check-ins</p>
      </div>

      {loading ? (
        <div className="text-center py-10 text-gray-500">Loading...</div>
      ) : orders.length === 0 ? (
        <div className="bg-dark-500 border border-white/10 rounded-xl p-12 text-center">
          <Ticket size={32} className="text-gray-600 mx-auto mb-3" />
          <h2 className="text-xl font-bold mb-2">No Ticket Orders Yet</h2>
          <p className="text-gray-400 text-sm max-w-md mx-auto">
            When customers reserve tickets for an event, their orders appear
            here with buyer details and status.
          </p>
        </div>
      ) : (
        <>
          {error && (
            <div className="mb-4 rounded-lg border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}
          <SearchPagination
            searchValue={search}
            onSearchChange={(v) => {
              setSearch(v);
              setPage(1);
            }}
            placeholder="Search by buyer, contact, or event..."
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
                    <th className="text-left p-4 text-gray-400 font-medium">Buyer</th>
                    <th className="text-left p-4 text-gray-400 font-medium">Contact</th>
                    <th className="text-left p-4 text-gray-400 font-medium">Event</th>
                    <th className="text-left p-4 text-gray-400 font-medium">Qty</th>
                    <th className="text-left p-4 text-gray-400 font-medium">Total</th>
                    <th className="text-left p-4 text-gray-400 font-medium">Status</th>
                    <th className="text-left p-4 text-gray-400 font-medium">Date</th>
                    <th className="text-right p-4 text-gray-400 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((order) => (
                    <tr key={order.id} className="border-b border-white/5 hover:bg-white/5">
                      <td className="p-4 font-medium">{order.buyer_name || "—"}</td>
                      <td className="p-4">
                        <div className="flex flex-col gap-0.5">
                          {order.buyer_email ? (
                            <a
                              href={`mailto:${order.buyer_email}`}
                              className="text-gold-500 hover:underline flex items-center gap-1"
                            >
                              <Mail size={14} />
                              {order.buyer_email}
                            </a>
                          ) : null}
                          {order.buyer_phone ? (
                            <a
                              href={`tel:${order.buyer_phone}`}
                              className="text-gray-400 hover:text-white"
                            >
                              {order.buyer_phone}
                            </a>
                          ) : null}
                          {!order.buyer_email && !order.buyer_phone && (
                            <span className="text-gray-600">—</span>
                          )}
                        </div>
                      </td>
                      <td className="p-4 text-gray-400">{eventLabel(order)}</td>
                      <td className="p-4 text-gray-300">{order.quantity}</td>
                      <td className="p-4 text-gold-500 font-semibold whitespace-nowrap">
                        {rands(order.total_zar)}
                      </td>
                      <td className="p-4">
                        <span
                          className={`text-xs px-2 py-0.5 rounded capitalize ${
                            statusColors[order.status] || "text-gray-400 bg-white/10"
                          }`}
                        >
                          {order.status}
                        </span>
                      </td>
                      <td className="p-4 text-gray-500 whitespace-nowrap">
                        {new Date(order.created_at).toLocaleDateString()}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center justify-end gap-2">
                          {order.status !== "confirmed" && order.status !== "used" && (
                            <button
                              onClick={() => updateStatus(order, "confirmed")}
                              disabled={updatingId === order.id}
                              className="text-xs px-2.5 py-1 rounded bg-green-400/10 text-green-400 hover:bg-green-400/20 disabled:opacity-40 whitespace-nowrap"
                            >
                              <Check size={13} className="inline mr-1" />
                              Confirm
                            </button>
                          )}
                          {order.status === "confirmed" && (
                            <button
                              onClick={() => updateStatus(order, "used")}
                              disabled={updatingId === order.id}
                              className="text-xs px-2.5 py-1 rounded bg-white/10 text-gray-300 hover:bg-white/20 disabled:opacity-40 whitespace-nowrap"
                            >
                              Check in
                            </button>
                          )}
                          {order.status !== "cancelled" && (
                            <button
                              onClick={() => updateStatus(order, "cancelled")}
                              disabled={updatingId === order.id}
                              className="text-xs px-2.5 py-1 rounded bg-red-400/10 text-red-400 hover:bg-red-400/20 disabled:opacity-40 whitespace-nowrap"
                            >
                              <X size={13} className="inline mr-1" />
                              Cancel
                            </button>
                          )}
                        </div>
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
