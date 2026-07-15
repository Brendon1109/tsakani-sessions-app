"use client";

import { useEffect, useMemo, useState } from "react";
import { UserCheck, Download, Mail } from "lucide-react";
import SearchPagination from "@/components/SearchPagination";
import { type Lead, type LeadSource, LEAD_SOURCES, sortLeadsByDateDesc } from "@/lib/leads";

const PAGE_SIZE = 25;

const sourceStyles: Record<LeadSource, string> = {
  Booking: "text-gold-500 bg-gold-500/10",
  "Ticket buyer": "text-green-400 bg-green-400/10",
  "Merch buyer": "text-blue-400 bg-blue-400/10",
  Newsletter: "text-purple-400 bg-purple-400/10",
  "Gallery view": "text-gray-300 bg-white/10",
};

export default function AdminLeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<"All" | LeadSource>("All");
  const [page, setPage] = useState(1);

  useEffect(() => {
    loadLeads();
  }, []);

  async function loadLeads() {
    setLoading(true);
    const res = await fetch("/api/admin/leads");
    if (res.ok) setLeads(sortLeadsByDateDesc(await res.json()));
    setLoading(false);
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return leads.filter((l) => {
      if (sourceFilter !== "All" && l.source !== sourceFilter) return false;
      if (!q) return true;
      return (
        l.email?.toLowerCase().includes(q) ||
        l.name?.toLowerCase().includes(q) ||
        l.phone?.toLowerCase().includes(q) ||
        l.detail?.toLowerCase().includes(q) ||
        l.source.toLowerCase().includes(q)
      );
    });
  }, [leads, search, sourceFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function downloadCsv() {
    const headers = ["source", "name", "email", "phone", "detail", "date"];
    const rows = filtered.map((l) => [
      l.source,
      l.name || "",
      l.email || "",
      l.phone || "",
      l.detail || "",
      l.date,
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

  const filters: ("All" | LeadSource)[] = ["All", ...LEAD_SOURCES];

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Leads</h1>
          <p className="text-gray-400 mt-1">
            Everyone who has shown interest in Tsakani Sessions
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
            Booking enquiries, ticket buyers, merch orders, newsletter sign ups
            and gallery viewers all land here as they come in.
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2 mb-4">
            {filters.map((f) => {
              const count =
                f === "All"
                  ? leads.length
                  : leads.filter((l) => l.source === f).length;
              const active = sourceFilter === f;
              return (
                <button
                  key={f}
                  onClick={() => {
                    setSourceFilter(f);
                    setPage(1);
                  }}
                  className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
                    active
                      ? "border-gold-500 text-gold-500 bg-gold-500/10"
                      : "border-white/10 text-gray-400 hover:text-white hover:border-white/30"
                  }`}
                >
                  {f} ({count})
                </button>
              );
            })}
          </div>

          <SearchPagination
            searchValue={search}
            onSearchChange={(v) => {
              setSearch(v);
              setPage(1);
            }}
            placeholder="Search by name, email, phone, or detail..."
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
                    <th className="text-left p-4 text-gray-400 font-medium">Source</th>
                    <th className="text-left p-4 text-gray-400 font-medium">Name</th>
                    <th className="text-left p-4 text-gray-400 font-medium">Email</th>
                    <th className="text-left p-4 text-gray-400 font-medium">Phone</th>
                    <th className="text-left p-4 text-gray-400 font-medium">Detail</th>
                    <th className="text-left p-4 text-gray-400 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((lead, i) => (
                    <tr key={i} className="border-b border-white/5 hover:bg-white/5">
                      <td className="p-4">
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded whitespace-nowrap ${sourceStyles[lead.source]}`}
                        >
                          {lead.source}
                        </span>
                      </td>
                      <td className="p-4">{lead.name || "—"}</td>
                      <td className="p-4">
                        {lead.email ? (
                          <a
                            href={`mailto:${lead.email}`}
                            className="text-gold-500 hover:underline flex items-center gap-1"
                          >
                            <Mail size={14} />
                            {lead.email}
                          </a>
                        ) : (
                          <span className="text-gray-600">—</span>
                        )}
                      </td>
                      <td className="p-4 text-gray-400">
                        {lead.phone ? (
                          <a href={`tel:${lead.phone}`} className="hover:text-white">
                            {lead.phone}
                          </a>
                        ) : (
                          <span className="text-gray-600">—</span>
                        )}
                      </td>
                      <td className="p-4 text-gray-400">{lead.detail}</td>
                      <td className="p-4 text-gray-500 whitespace-nowrap">
                        {new Date(lead.date).toLocaleDateString()}
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
