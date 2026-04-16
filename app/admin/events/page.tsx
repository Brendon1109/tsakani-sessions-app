"use client";

import { Calendar, Plus, Edit, Trash2 } from "lucide-react";

const events = [
  {
    id: 1,
    title: "Tsakani Sessions Sunset Boat Cruise",
    date: "Coming Soon",
    venue: "Cape Town Waterfront",
    status: "draft",
    ticketTypes: 0,
  },
  {
    id: 2,
    title: "Tsakani Sessions Vol. 5",
    date: "TBA",
    venue: "TBA",
    status: "draft",
    ticketTypes: 0,
  },
];

export default function AdminEventsPage() {
  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Events</h1>
          <p className="text-gray-400 mt-1">Manage events and ticket types</p>
        </div>
        <button className="flex items-center gap-2 bg-gold-gradient text-black font-semibold px-5 py-2.5 rounded-lg hover:opacity-90 transition-opacity w-fit">
          <Plus size={16} />
          Create Event
        </button>
      </div>

      <div className="space-y-3">
        {events.map((event) => (
          <div
            key={event.id}
            className="bg-dark-500 border border-white/10 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          >
            <div className="flex items-center gap-4">
              <div className="bg-gold-500/10 p-2.5 rounded-lg">
                <Calendar size={20} className="text-gold-500" />
              </div>
              <div>
                <h3 className="font-semibold">{event.title}</h3>
                <p className="text-gray-500 text-sm">
                  {event.date} &middot; {event.venue} &middot;{" "}
                  <span
                    className={
                      event.status === "published"
                        ? "text-green-400"
                        : "text-yellow-400"
                    }
                  >
                    {event.status}
                  </span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button className="text-gray-400 hover:text-gold-500 p-2 transition-colors">
                <Edit size={16} />
              </button>
              <button className="text-gray-400 hover:text-red-400 p-2 transition-colors">
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
