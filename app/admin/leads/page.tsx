import { UserCheck, Download, Mail } from "lucide-react";

export default function AdminLeadsPage() {
  // TODO: Fetch from Supabase gallery_views joined with profiles
  const leads: {
    email: string;
    name: string;
    gallery: string;
    viewedAt: string;
  }[] = [];

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Leads</h1>
          <p className="text-gray-400 mt-1">
            Users who signed in to view event galleries
          </p>
        </div>
        <button
          disabled={leads.length === 0}
          className="flex items-center gap-2 bg-gold-gradient text-black font-semibold px-5 py-2.5 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed w-fit"
        >
          <Download size={16} />
          Export CSV
        </button>
      </div>

      {leads.length === 0 ? (
        <div className="bg-dark-500 border border-white/10 rounded-xl p-12 text-center">
          <div className="bg-gold-500/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <UserCheck size={28} className="text-gold-500" />
          </div>
          <h2 className="text-xl font-bold mb-2">No Leads Yet</h2>
          <p className="text-gray-400 text-sm max-w-md mx-auto">
            When users sign in with Google to view event galleries, their
            contact info will appear here. Share gallery links and QR codes at
            events to capture leads.
          </p>
        </div>
      ) : (
        <div className="bg-dark-500 border border-white/10 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left p-4 text-gray-400 font-medium">
                    Name
                  </th>
                  <th className="text-left p-4 text-gray-400 font-medium">
                    Email
                  </th>
                  <th className="text-left p-4 text-gray-400 font-medium">
                    Gallery Viewed
                  </th>
                  <th className="text-left p-4 text-gray-400 font-medium">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead, i) => (
                  <tr key={i} className="border-b border-white/5">
                    <td className="p-4">{lead.name}</td>
                    <td className="p-4">
                      <a
                        href={`mailto:${lead.email}`}
                        className="text-gold-500 hover:underline flex items-center gap-1"
                      >
                        <Mail size={14} />
                        {lead.email}
                      </a>
                    </td>
                    <td className="p-4 text-gray-400">{lead.gallery}</td>
                    <td className="p-4 text-gray-500">{lead.viewedAt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
