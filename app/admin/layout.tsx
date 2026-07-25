"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  BarChart3,
  Calendar,
  Image as ImageIcon,
  ShoppingBag,
  Ticket,
  Building2,
  Users,
  CalendarDays,
  Video,
  Share2,
  Pin,
  UserCheck,
  ScanLine,
  Gift,
  ChevronLeft,
  Menu,
} from "lucide-react";
import { useState } from "react";

const adminNav = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  // Second, above everything else: this is the only page anyone opens while
  // standing at an entrance with a queue in front of them.
  { href: "/admin/door", label: "Door / Check-in", icon: ScanLine },
  { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/admin/events", label: "Events", icon: Calendar },
  { href: "/admin/gallery", label: "Gallery", icon: ImageIcon },
  { href: "/admin/tickets", label: "Tickets", icon: Ticket },
  { href: "/admin/comp-tickets", label: "Comp Tickets", icon: Gift },
  { href: "/admin/orders", label: "Orders", icon: ShoppingBag },
  { href: "/admin/venues", label: "Venues", icon: Building2 },
  { href: "/admin/team", label: "Team", icon: Users },
  { href: "/admin/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/admin/video", label: "Video", icon: Video },
  { href: "/admin/social", label: "Social Uploads", icon: Share2 },
  { href: "/admin/featured-posts", label: "Featured Posts", icon: Pin },
  { href: "/admin/leads", label: "Leads", icon: UserCheck },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-[calc(100vh-64px)]">
      {/* Mobile sidebar toggle */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="lg:hidden fixed bottom-6 left-6 z-40 bg-gold-gradient text-black p-3 rounded-full shadow-lg print:hidden"
        aria-label="Toggle sidebar"
      >
        <Menu size={20} />
      </button>

      {/* Sidebar */}
      <aside
        // print:hidden so a printed comp sheet is tickets and nothing else —
        // the sidebar would otherwise take a third of every page.
        className={`fixed lg:sticky top-16 sm:top-20 left-0 z-30 h-[calc(100vh-64px)] sm:h-[calc(100vh-80px)] w-64 bg-dark-600 border-r border-white/10 overflow-y-auto transition-transform duration-200 print:hidden ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="p-4">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-gold-500 font-bold text-sm uppercase tracking-wider">
              Admin Panel
            </h2>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden text-gray-400 hover:text-white"
            >
              <ChevronLeft size={18} />
            </button>
          </div>
          <nav className="space-y-1">
            {adminNav.map((item) => {
              const Icon = item.icon;
              const isActive =
                pathname === item.href ||
                (item.href !== "/admin" && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                    isActive
                      ? "bg-gold-500/10 text-gold-500 font-medium"
                      : "text-gray-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <Icon size={18} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="mt-8 pt-4 border-t border-white/10">
            <Link
              href="/"
              className="flex items-center gap-2 text-gray-500 hover:text-gold-500 text-sm transition-colors"
            >
              <ChevronLeft size={16} />
              Back to site
            </Link>
          </div>
        </div>
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/60 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <div className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8">{children}</div>
    </div>
  );
}
