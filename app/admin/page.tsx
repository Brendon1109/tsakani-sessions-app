import {
  Calendar,
  Users,
  Ticket,
  ShoppingBag,
  TrendingUp,
  Image as ImageIcon,
} from "lucide-react";

const stats = [
  { label: "Upcoming Events", value: "2", icon: Calendar, color: "text-gold-500" },
  { label: "Gallery Photos", value: "0", icon: ImageIcon, color: "text-blue-400" },
  { label: "Tickets Sold", value: "0", icon: Ticket, color: "text-green-400" },
  { label: "Merch Orders", value: "0", icon: ShoppingBag, color: "text-purple-400" },
  { label: "Leads Captured", value: "0", icon: Users, color: "text-orange-400" },
  { label: "Revenue (ZAR)", value: "R0", icon: TrendingUp, color: "text-gold-500" },
];

export default function AdminDashboard() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold">Dashboard</h1>
        <p className="text-gray-400 mt-1">Overview of Tsakani Sessions</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="bg-dark-500 border border-white/10 rounded-xl p-5"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">{stat.label}</p>
                  <p className="text-2xl font-bold mt-1">{stat.value}</p>
                </div>
                <div className={`${stat.color} bg-white/5 p-2.5 rounded-lg`}>
                  <Icon size={22} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

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
              <a
                key={action.label}
                href={action.href}
                className="flex items-center gap-3 bg-dark-300/50 hover:bg-dark-300 border border-white/5 hover:border-gold-500/20 rounded-lg px-4 py-3 text-sm transition-colors"
              >
                <Icon size={16} className="text-gold-500" />
                {action.label}
              </a>
            );
          })}
        </div>
      </div>

      {/* Setup Notice */}
      <div className="mt-6 bg-gold-500/5 border border-gold-500/20 rounded-xl p-6">
        <h3 className="text-gold-500 font-semibold mb-2">Setup Required</h3>
        <p className="text-gray-400 text-sm leading-relaxed">
          To fully activate the admin panel, connect your Supabase project by
          setting <code className="text-gold-500">NEXT_PUBLIC_SUPABASE_URL</code>{" "}
          and <code className="text-gold-500">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>{" "}
          in your <code className="text-gold-500">.env.local</code> file. Then enable
          Google OAuth in the Supabase dashboard under Authentication &gt; Providers.
        </p>
      </div>
    </div>
  );
}
