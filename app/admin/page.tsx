"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Calendar,
  Users,
  Ticket,
  ShoppingBag,
  TrendingUp,
  Image as ImageIcon,
  Mail,
  Loader2,
} from "lucide-react";

interface Stats {
  events: number;
  photos: number;
  ticketsSold: number;
  merchOrders: number;
  leads: number;
  subscribers: number;
  revenue: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/admin/stats");
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || `HTTP ${res.status}`);
        }
        const data = await res.json();
        if (!cancelled) setStats(data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const tiles: {
    label: string;
    value: string;
    icon: typeof Calendar;
    color: string;
    href?: string;
  }[] = [
    {
      label: "Published Events",
      value: stats?.events?.toString() ?? "—",
      icon: Calendar,
      color: "text-gold-500",
      href: "/admin/events",
    },
    {
      label: "Gallery Photos",
      value: stats?.photos?.toString() ?? "—",
      icon: ImageIcon,
      color: "text-blue-400",
      href: "/admin/gallery",
    },
    {
      label: "Tickets Sold",
      value: stats?.ticketsSold?.toString() ?? "—",
      icon: Ticket,
      color: "text-green-400",
      href: "/admin/tickets",
    },
    {
      label: "Merch Orders",
      value: stats?.merchOrders?.toString() ?? "—",
      icon: ShoppingBag,
      color: "text-purple-400",
      href: "/admin/orders",
    },
    {
      label: "Leads Captured",
      value: stats?.leads?.toString() ?? "—",
      icon: Users,
      color: "text-orange-400",
      href: "/admin/leads",
    },
    {
      label: "Newsletter Subs",
      value: stats?.subscribers?.toString() ?? "—",
      icon: Mail,
      color: "text-pink-400",
    },
    {
      label: "Revenue (ZAR)",
      value: stats ? `R${(stats.revenue / 100).toLocaleString()}` : "—",
      icon: TrendingUp,
      color: "text-gold-500",
    },
  ];

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Dashboard</h1>
          <p className="text-gray-400 mt-1">Tsakani Sessions — live overview</p>
        </div>
        {loading && <Loader2 size={18} className="text-gold-500 animate-spin" aria-label="Loading" />}
      </div>

      {error ? (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6 mb-8">
          <p className="text-red-400 font-medium">Failed to load stats</p>
          <p className="text-gray-400 text-sm mt-1">{error}</p>
          <p className="text-gray-500 text-xs mt-3">
            This usually means you&apos;re not signed in as an admin. Try signing
            out and in again.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {tiles.map((stat) => {
            const Icon = stat.icon;
            const content = (
              <>
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-gray-400 text-sm truncate">{stat.label}</p>
                    <p className="text-2xl font-bold mt-1">{stat.value}</p>
                  </div>
                  <div className={`${stat.color} bg-white/5 p-2.5 rounded-lg shrink-0`}>
                    <Icon size={22} />
                  </div>
                </div>
              </>
            );
            return stat.href ? (
              <Link
                key={stat.label}
                href={stat.href}
                className="bg-dark-500 border border-white/10 rounded-xl p-5 hover:border-gold-500/30 transition-colors block"
              >
                {content}
              </Link>
            ) : (
              <div
                key={stat.label}
                className="bg-dark-500 border border-white/10 rounded-xl p-5"
              >
                {content}
              </div>
            );
          })}
        </div>
      )}

      {/* Quick Actions */}
      <div className="bg-dark-500 border border-white/10 rounded-xl p-6">
        <h2 className="font-bold mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: "Create Event", href: "/admin/events", icon: Calendar },
            { label: "Upload Photos", href: "/admin/gallery", icon: ImageIcon },
            { label: "View Orders", href: "/admin/orders", icon: ShoppingBag },
            { label: "Export Leads", href: "/admin/leads", icon: Users },
          ].map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.label}
                href={action.href}
                className="flex items-center gap-3 bg-dark-300/50 hover:bg-dark-300 border border-white/5 hover:border-gold-500/20 rounded-lg px-4 py-3 text-sm transition-colors"
              >
                <Icon size={16} className="text-gold-500" aria-hidden="true" />
                {action.label}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
