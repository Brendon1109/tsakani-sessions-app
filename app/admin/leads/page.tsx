"use client";

import { useEffect, useMemo, useState } from "react";
import { UserCheck, Download, Mail } from "lucide-react";
import SearchPagination from "@/components/SearchPagination";

interface Lead {
  email: string;
  name: string | null;
  gallery_title: string;
  viewed_at: string;
}

const PAGE_SIZE = 25;

export default function AdminLeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    loadLeads();
  }, []);

  async function loadLeads() {
    setLoading(true);
    const res = await fetch("/api/admin/leads");
    if (res.ok) setLeads(await res.json());
    setLoading(false);
  }

  const filtered = useMemo(() => {
    if (!search) return leads;
    const q = search.toLowerCase();
    return leads.filter(
      (l) =>
        l.email.toLowerCase().includes(q) ||
        l.name?.toLowerCase().includes(q) ||
        l.gallery_title?.toLowerCase().includes(q)
    );
  }, [leads, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function downloadCsv() {
    const headers = ["email", "name", "gallery", "viewed_at"];
    const rows = filtered.map((l) => [
      l.email,
      l.name || "",
      l.gallery_title,
      l.viewed_at,
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tsakani-leads-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

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
          onClick={downloadCsv}
          disabled={filtered.length === 0}
          className="flex items-center gap-2 bg-gold-gradient text-black font-semibold px-5 py-2.5 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 w-fit"
        >
          <Download size={16} />
          Export CSV ({filtered.length})
        </button>
      </div>

      {loading ? (
        <div className="text-center py-10 text-gray-500">Loading...</div>
      ) : leads.length === 0 ? (
        <div className="bg-dark-500 border border-white/10 rounded-xl p-12 text-center">
          <div className="bg-gold-500/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <UserCheck size={28} className="text-gold-500" />
          </div>
          <h2 className="text-xl font-bold mb-2">No Leads Yet</h2>
          <p className="text-gray-400 text-sm max-w-md mx-auto">
            When users sign in with Google to view event galleries, their
            contact info will appear here.
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
            placeholder="Search by email, name, or gallery..."
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
                    <th className="text-left p-4 text-gray-400 font-medium">Name</th>
                    <th className="text-left p-4 text-gray-400 font-medium">Email</th>
                    <th className="text-left p-4 text-gray-400 font-medium">
                      Gallery Viewed
                    </th>
                    <th className="text-left p-4 text-gray-400 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((lead, i) => (
                    <tr key={i} className="border-b border-white/5 hover:bg-white/5">
                      <td className="p-4">{lead.name || "—"}</td>
                      <td className="p-4">
                        <a
                          href={`mailto:${lead.email}`}
                          className="text-gold-500 hover:underline flex items-center gap-1"
                        >
                          <Mail size={14} />
                          {lead.email}
                        </a>
                      </td>
                      <td className="p-4 text-gray-400">{lead.gallery_title}</td>
                      <td className="p-4 text-gray-500">
                        {new Date(lead.viewed_at).toLocaleDateString()}
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
