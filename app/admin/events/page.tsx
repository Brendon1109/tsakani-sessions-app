"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Calendar, Plus, Edit, Trash2, X, Loader2, Star, Upload, Ticket } from "lucide-react";
import ConfirmDialog from "@/components/ConfirmDialog";
import type { Event, Ticket as TicketType } from "@/lib/types";

interface TicketForm {
  id?: string;
  name: string;
  price_zar: number;
  quantity_total: number;
  description: string;
}

interface EventWithTickets extends Event {
  tickets?: TicketType[];
}

interface EventForm {
  id?: string;
  title: string;
  slug: string;
  date: string;
  venue_name: string;
  venue_address: string;
  description: string;
  status: "draft" | "published" | "past";
  is_featured: boolean;
  cover_image_url: string;
  tickets: TicketForm[];
}

function utcIsoToLocalInput(iso: string): string {
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}

const emptyForm: EventForm = {
  title: "",
  slug: "",
  date: "",
  venue_name: "",
  venue_address: "",
  description: "",
  status: "draft",
  is_featured: false,
  cover_image_url: "",
  tickets: [],
};

const emptyTicket: TicketForm = {
  name: "",
  price_zar: 0,
  quantity_total: 100,
  description: "",
};

export default function AdminEventsPage() {
  const [events, setEvents] = useState<EventWithTickets[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<EventForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    loadEvents();
  }, []);

  async function loadEvents() {
    setLoading(true);
    const res = await fetch("/api/admin/events");
    if (res.ok) setEvents(await res.json());
    setLoading(false);
  }

  function startNew() {
    setForm(emptyForm);
    setShowForm(true);
  }

  function startEdit(event: EventWithTickets) {
    setForm({
      id: event.id,
      title: event.title,
      slug: event.slug,
      date: utcIsoToLocalInput(event.date),
      venue_name: event.venue_name || "",
      venue_address: event.venue_address || "",
      description: event.description || "",
      status: event.status,
      is_featured: event.is_featured,
      cover_image_url: event.cover_image_url || "",
      tickets: (event.tickets || []).map((t) => ({
        id: t.id,
        name: t.name,
        price_zar: t.price_zar,
        quantity_total: t.quantity_total,
        description: t.description || "",
      })),
    });
    setShowForm(true);
  }

  function addTicket() {
    setForm((f) => ({ ...f, tickets: [...f.tickets, { ...emptyTicket }] }));
  }

  function updateTicket(idx: number, patch: Partial<TicketForm>) {
    setForm((f) => ({
      ...f,
      tickets: f.tickets.map((t, i) => (i === idx ? { ...t, ...patch } : t)),
    }));
  }

  function removeTicket(idx: number) {
    setForm((f) => ({
      ...f,
      tickets: f.tickets.filter((_, i) => i !== idx),
    }));
  }

  async function handleCoverUpload(file: File) {
    setUploadingCover(true);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch("/api/admin/events/upload-cover", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Upload failed");
        return;
      }
      setForm((f) => ({ ...f, cover_image_url: data.url }));
    } finally {
      setUploadingCover(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const method = form.id ? "PATCH" : "POST";
    const dateUtc = new Date(form.date).toISOString();
    const body = form.id
      ? { ...form, date: dateUtc }
      : { ...form, date: dateUtc, slug: form.slug || undefined };
    const res = await fetch("/api/admin/events", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      setShowForm(false);
      await loadEvents();
    } else {
      const data = await res.json();
      alert(data.error || "Failed to save");
    }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    const res = await fetch("/api/admin/events", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (res.ok) await loadEvents();
    setDeleteId(null);
  }

  const statusColors: Record<string, string> = {
    draft: "text-yellow-400 bg-yellow-400/10",
    published: "text-green-400 bg-green-400/10",
    past: "text-gray-400 bg-gray-400/10",
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Events</h1>
          <p className="text-gray-400 mt-1">Manage events and tickets</p>
        </div>
        <button
          onClick={startNew}
          className="flex items-center gap-2 bg-gold-gradient text-black font-semibold px-5 py-2.5 rounded-lg hover:opacity-90 transition-opacity w-fit"
        >
          <Plus size={16} />
          Create Event
        </button>
      </div>

      {loading ? (
        <div className="text-center py-10 text-gray-500">Loading events...</div>
      ) : events.length === 0 ? (
        <div className="bg-dark-500 border border-white/10 rounded-xl p-10 text-center">
          <Calendar size={32} className="text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">
            No events yet. Create your first event.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {events.map((event) => (
            <div
              key={event.id}
              className="bg-dark-500 border border-white/10 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="flex items-center gap-4 flex-1 min-w-0">
                <div className="bg-gold-500/10 p-2.5 rounded-lg shrink-0">
                  <Calendar size={20} className="text-gold-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold truncate">{event.title}</h3>
                    {event.is_featured && (
                      <Star size={14} className="text-gold-500 fill-gold-500 shrink-0" aria-label="Featured" />
                    )}
                    <span
                      className={`text-xs px-2 py-0.5 rounded capitalize ${
                        statusColors[event.status]
                      }`}
                    >
                      {event.status}
                    </span>
                  </div>
                  <p className="text-gray-500 text-sm truncate">
                    {new Date(event.date).toLocaleString()}
                    {event.venue_name && ` · ${event.venue_name}`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => startEdit(event)}
                  className="text-gray-400 hover:text-gold-500 p-2 transition-colors"
                  aria-label={`Edit ${event.title}`}
                >
                  <Edit size={16} />
                </button>
                <button
                  onClick={() => setDeleteId(event.id)}
                  className="text-gray-400 hover:text-red-400 p-2 transition-colors"
                  aria-label={`Delete ${event.title}`}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-dark-500 border border-white/10 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-white/10 sticky top-0 bg-dark-500">
              <h2 className="text-xl font-bold">
                {form.id ? "Edit Event" : "Create Event"}
              </h2>
              <button
                onClick={() => setShowForm(false)}
                className="text-gray-400 hover:text-white"
                aria-label="Close form"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-5 space-y-4">
              <div>
                <label className="text-sm text-gray-400 block mb-1">Title *</label>
                <input
                  required
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full bg-dark-300 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-gold-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-sm text-gray-400 block mb-1">
                  Slug (auto-generated if empty)
                </label>
                <input
                  type="text"
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value })}
                  placeholder="sunset-boat-cruise-2026"
                  className="w-full bg-dark-300 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-gold-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-sm text-gray-400 block mb-1">Poster / Cover Image</label>
                {form.cover_image_url ? (
                  <div className="relative bg-dark-300 border border-white/10 rounded-lg overflow-hidden">
                    <Image
                      src={form.cover_image_url}
                      alt="Cover"
                      width={600}
                      height={400}
                      className="w-full h-48 object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, cover_image_url: "" })}
                      className="absolute top-2 right-2 bg-black/70 hover:bg-black text-white p-1.5 rounded-full"
                      aria-label="Remove cover image"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <label className="flex items-center justify-center gap-2 bg-dark-300 border border-dashed border-white/20 hover:border-gold-500/40 rounded-lg p-6 cursor-pointer transition-colors">
                    {uploadingCover ? (
                      <>
                        <Loader2 size={16} className="animate-spin text-gold-500" />
                        <span className="text-sm text-gray-400">Uploading...</span>
                      </>
                    ) : (
                      <>
                        <Upload size={16} className="text-gray-400" />
                        <span className="text-sm text-gray-400">
                          Click to upload (max 8MB, jpg/png/webp)
                        </span>
                      </>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={uploadingCover}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleCoverUpload(file);
                        e.target.value = "";
                      }}
                    />
                  </label>
                )}
              </div>
              <div>
                <label className="text-sm text-gray-400 block mb-1">Date & Time *</label>
                <input
                  required
                  type="datetime-local"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  className="w-full bg-dark-300 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-gold-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-sm text-gray-400 block mb-1">Venue Name</label>
                <input
                  type="text"
                  value={form.venue_name}
                  onChange={(e) => setForm({ ...form, venue_name: e.target.value })}
                  className="w-full bg-dark-300 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-gold-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-sm text-gray-400 block mb-1">Venue Address</label>
                <input
                  type="text"
                  value={form.venue_address}
                  onChange={(e) => setForm({ ...form, venue_address: e.target.value })}
                  className="w-full bg-dark-300 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-gold-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-sm text-gray-400 block mb-1">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                  className="w-full bg-dark-300 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-gold-500 focus:outline-none resize-none"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm text-gray-400 flex items-center gap-1.5">
                    <Ticket size={14} />
                    Tickets
                  </label>
                  <button
                    type="button"
                    onClick={addTicket}
                    className="text-xs text-gold-500 hover:text-gold-400 flex items-center gap-1"
                  >
                    <Plus size={12} />
                    Add ticket
                  </button>
                </div>
                {form.tickets.length === 0 ? (
                  <p className="text-xs text-gray-500 italic bg-dark-300 border border-white/10 rounded-lg px-3 py-3">
                    No tickets &mdash; this event will display as <span className="text-gold-500/80">Free Entry</span>.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {form.tickets.map((ticket, idx) => (
                      <div
                        key={idx}
                        className="bg-dark-300 border border-white/10 rounded-lg p-3 space-y-2"
                      >
                        <div className="flex items-start gap-2">
                          <input
                            type="text"
                            required
                            placeholder="Ticket name (e.g., General Admission)"
                            value={ticket.name}
                            onChange={(e) => updateTicket(idx, { name: e.target.value })}
                            className="flex-1 bg-dark-500 border border-white/10 rounded px-2 py-1.5 text-sm text-white focus:border-gold-500 focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => removeTicket(idx)}
                            className="text-gray-500 hover:text-red-400 p-1.5"
                            aria-label="Remove ticket"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-xs text-gray-500 block mb-1">Price (R)</label>
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={ticket.price_zar}
                              onChange={(e) =>
                                updateTicket(idx, { price_zar: Number(e.target.value) || 0 })
                              }
                              className="w-full bg-dark-500 border border-white/10 rounded px-2 py-1.5 text-sm text-white focus:border-gold-500 focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-gray-500 block mb-1">Quantity</label>
                            <input
                              type="number"
                              min="1"
                              step="1"
                              value={ticket.quantity_total}
                              onChange={(e) =>
                                updateTicket(idx, {
                                  quantity_total: Number(e.target.value) || 1,
                                })
                              }
                              className="w-full bg-dark-500 border border-white/10 rounded px-2 py-1.5 text-sm text-white focus:border-gold-500 focus:outline-none"
                            />
                          </div>
                        </div>
                        <input
                          type="text"
                          placeholder="Description (optional)"
                          value={ticket.description}
                          onChange={(e) => updateTicket(idx, { description: e.target.value })}
                          className="w-full bg-dark-500 border border-white/10 rounded px-2 py-1.5 text-sm text-white focus:border-gold-500 focus:outline-none"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="text-sm text-gray-400 block mb-1">Status</label>
                  <select
                    value={form.status}
                    onChange={(e) =>
                      setForm({ ...form, status: e.target.value as EventForm["status"] })
                    }
                    className="w-full bg-dark-300 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-gold-500 focus:outline-none"
                  >
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                    <option value="past">Past</option>
                  </select>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.is_featured}
                    onChange={(e) => setForm({ ...form, is_featured: e.target.checked })}
                    className="accent-gold-500"
                  />
                  <span className="text-sm">Featured</span>
                </label>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 text-sm text-gray-300 hover:text-white border border-white/10 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-gold-gradient text-black font-semibold px-5 py-2 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2"
                >
                  {saving && <Loader2 size={14} className="animate-spin" />}
                  {form.id ? "Save Changes" : "Create Event"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={!!deleteId}
        title="Delete event?"
        message="This will permanently delete the event and all its associated tickets. This cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => deleteId && handleDelete(deleteId)}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
