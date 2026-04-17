"use client";

import { useEffect, useState } from "react";
import { Building2, Plus, MapPin, X, Loader2, Edit, Trash2 } from "lucide-react";
import ConfirmDialog from "@/components/ConfirmDialog";
import type { Venue } from "@/lib/types";

const pipelineStages = [
  { id: "prospect", label: "Prospect", color: "border-gray-500" },
  { id: "contacted", label: "Contacted", color: "border-blue-500" },
  { id: "negotiating", label: "Negotiating", color: "border-yellow-500" },
  { id: "partnered", label: "Partnered", color: "border-green-500" },
  { id: "declined", label: "Declined", color: "border-red-500" },
];

interface VenueForm {
  id?: string;
  name: string;
  address: string;
  area: string;
  venue_type: string;
  capacity: string;
  hire_cost_zar: string;
  revenue_share_percent: string;
  partnership_status: Venue["partnership_status"];
  notes: string;
  website: string;
  instagram: string;
}

const emptyForm: VenueForm = {
  name: "",
  address: "",
  area: "",
  venue_type: "",
  capacity: "",
  hire_cost_zar: "",
  revenue_share_percent: "",
  partnership_status: "prospect",
  notes: "",
  website: "",
  instagram: "",
};

export default function AdminVenuesPage() {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<VenueForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    loadVenues();
  }, []);

  async function loadVenues() {
    setLoading(true);
    const res = await fetch("/api/admin/venues");
    if (res.ok) setVenues(await res.json());
    setLoading(false);
  }

  function startNew() {
    setForm(emptyForm);
    setShowForm(true);
  }

  function startEdit(venue: Venue) {
    setForm({
      id: venue.id,
      name: venue.name,
      address: venue.address || "",
      area: venue.area || "",
      venue_type: venue.venue_type || "",
      capacity: venue.capacity?.toString() || "",
      hire_cost_zar: venue.hire_cost_zar?.toString() || "",
      revenue_share_percent: venue.revenue_share_percent?.toString() || "",
      partnership_status: venue.partnership_status,
      notes: venue.notes || "",
      website: venue.website || "",
      instagram: venue.instagram || "",
    });
    setShowForm(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const method = form.id ? "PATCH" : "POST";
    const body = {
      ...form,
      capacity: form.capacity ? parseInt(form.capacity) : null,
      hire_cost_zar: form.hire_cost_zar ? parseInt(form.hire_cost_zar) : null,
      revenue_share_percent: form.revenue_share_percent
        ? parseInt(form.revenue_share_percent)
        : null,
    };
    const res = await fetch("/api/admin/venues", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      setShowForm(false);
      await loadVenues();
    } else {
      alert((await res.json()).error || "Save failed");
    }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    const res = await fetch("/api/admin/venues", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (res.ok) await loadVenues();
    setDeleteId(null);
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Venue CRM</h1>
          <p className="text-gray-400 mt-1">Track venue partnerships and outreach</p>
        </div>
        <button
          onClick={startNew}
          className="flex items-center gap-2 bg-gold-gradient text-black font-semibold px-5 py-2.5 rounded-lg hover:opacity-90 transition-opacity w-fit"
        >
          <Plus size={16} />
          Add Venue
        </button>
      </div>

      {/* Pipeline */}
      <div className="mb-8">
        <h2 className="font-semibold mb-4">Pipeline</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {pipelineStages.map((stage) => {
            const stageVenues = venues.filter((v) => v.partnership_status === stage.id);
            return (
              <div
                key={stage.id}
                className={`bg-dark-500 border-t-2 ${stage.color} rounded-xl p-4 min-h-[120px]`}
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium">{stage.label}</h3>
                  <span className="text-gray-500 text-xs bg-white/5 px-2 py-0.5 rounded">
                    {stageVenues.length}
                  </span>
                </div>
                {stageVenues.length === 0 ? (
                  <p className="text-gray-600 text-xs">No venues</p>
                ) : (
                  stageVenues.map((venue) => (
                    <button
                      key={venue.id}
                      onClick={() => startEdit(venue)}
                      className="w-full text-left bg-dark-300/50 hover:bg-dark-300 rounded-lg p-3 mb-2 text-sm transition-colors"
                    >
                      <p className="font-medium truncate">{venue.name}</p>
                      {venue.area && (
                        <p className="text-gray-500 text-xs flex items-center gap-1 mt-1 truncate">
                          <MapPin size={10} />
                          {venue.area}
                        </p>
                      )}
                    </button>
                  ))
                )}
              </div>
            );
          })}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-10 text-gray-500">Loading venues...</div>
      ) : venues.length === 0 ? (
        <div className="bg-dark-500 border border-white/10 rounded-xl p-12 text-center">
          <Building2 size={32} className="text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">No venues yet. Add your first.</p>
        </div>
      ) : (
        <div>
          <h2 className="font-semibold mb-4">All Venues ({venues.length})</h2>
          <div className="space-y-2">
            {venues.map((venue) => (
              <div
                key={venue.id}
                className="bg-dark-500 border border-white/10 rounded-xl p-4 flex items-center justify-between"
              >
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold truncate">{venue.name}</h3>
                  <p className="text-gray-500 text-sm truncate">
                    {venue.area || "—"}
                    {venue.capacity && ` · cap ${venue.capacity}`}
                    {venue.venue_type && ` · ${venue.venue_type}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => startEdit(venue)}
                    className="text-gray-400 hover:text-gold-500 p-2 transition-colors"
                    aria-label={`Edit ${venue.name}`}
                  >
                    <Edit size={16} />
                  </button>
                  <button
                    onClick={() => setDeleteId(venue.id)}
                    className="text-gray-400 hover:text-red-400 p-2 transition-colors"
                    aria-label={`Delete ${venue.name}`}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-dark-500 border border-white/10 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-white/10 sticky top-0 bg-dark-500">
              <h2 className="text-xl font-bold">
                {form.id ? "Edit Venue" : "Add Venue"}
              </h2>
              <button
                onClick={() => setShowForm(false)}
                className="text-gray-400 hover:text-white"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-5 space-y-3">
              <div>
                <label className="text-sm text-gray-400 block mb-1">Name *</label>
                <input
                  required
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full bg-dark-300 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-gold-500 focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-gray-400 block mb-1">Area</label>
                  <input
                    type="text"
                    value={form.area}
                    onChange={(e) => setForm({ ...form, area: e.target.value })}
                    placeholder="e.g. Camps Bay"
                    className="w-full bg-dark-300 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-gold-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-400 block mb-1">Type</label>
                  <select
                    value={form.venue_type}
                    onChange={(e) => setForm({ ...form, venue_type: e.target.value })}
                    className="w-full bg-dark-300 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-gold-500 focus:outline-none"
                  >
                    <option value="">Select...</option>
                    <option value="bar">Bar</option>
                    <option value="rooftop">Rooftop</option>
                    <option value="boat">Boat</option>
                    <option value="outdoor">Outdoor</option>
                    <option value="club">Club</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-sm text-gray-400 block mb-1">Address</label>
                <input
                  type="text"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  className="w-full bg-dark-300 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-gold-500 focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-sm text-gray-400 block mb-1">Capacity</label>
                  <input
                    type="number"
                    min="0"
                    value={form.capacity}
                    onChange={(e) => setForm({ ...form, capacity: e.target.value })}
                    className="w-full bg-dark-300 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-gold-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-400 block mb-1">Hire (R)</label>
                  <input
                    type="number"
                    min="0"
                    value={form.hire_cost_zar}
                    onChange={(e) =>
                      setForm({ ...form, hire_cost_zar: e.target.value })
                    }
                    className="w-full bg-dark-300 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-gold-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-400 block mb-1">Rev %</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={form.revenue_share_percent}
                    onChange={(e) =>
                      setForm({ ...form, revenue_share_percent: e.target.value })
                    }
                    className="w-full bg-dark-300 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-gold-500 focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm text-gray-400 block mb-1">Status</label>
                <select
                  value={form.partnership_status}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      partnership_status: e.target.value as VenueForm["partnership_status"],
                    })
                  }
                  className="w-full bg-dark-300 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-gold-500 focus:outline-none"
                >
                  {pipelineStages.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-gray-400 block mb-1">Website</label>
                  <input
                    type="url"
                    value={form.website}
                    onChange={(e) => setForm({ ...form, website: e.target.value })}
                    className="w-full bg-dark-300 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-gold-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-400 block mb-1">Instagram</label>
                  <input
                    type="text"
                    value={form.instagram}
                    onChange={(e) => setForm({ ...form, instagram: e.target.value })}
                    placeholder="@handle"
                    className="w-full bg-dark-300 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-gold-500 focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm text-gray-400 block mb-1">Notes</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={3}
                  className="w-full bg-dark-300 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-gold-500 focus:outline-none resize-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 text-sm text-gray-300 hover:text-white border border-white/10 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-gold-gradient text-black font-semibold px-5 py-2 rounded-lg hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
                >
                  {saving && <Loader2 size={14} className="animate-spin" />}
                  {form.id ? "Save" : "Add Venue"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={!!deleteId}
        title="Delete venue?"
        message="This will permanently remove this venue and all its contacts. This cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => deleteId && handleDelete(deleteId)}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
