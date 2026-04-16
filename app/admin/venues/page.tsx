"use client";

import { Building2, Plus, MapPin } from "lucide-react";

const pipelineStages = [
  { id: "prospect", label: "Prospect", color: "border-gray-500" },
  { id: "contacted", label: "Contacted", color: "border-blue-500" },
  { id: "negotiating", label: "Negotiating", color: "border-yellow-500" },
  { id: "partnered", label: "Partnered", color: "border-green-500" },
  { id: "declined", label: "Declined", color: "border-red-500" },
];

// Placeholder venues
const venues: {
  id: number;
  name: string;
  area: string;
  type: string;
  status: string;
  capacity: number;
}[] = [];

export default function AdminVenuesPage() {
  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Venue CRM</h1>
          <p className="text-gray-400 mt-1">
            Track venue partnerships and outreach
          </p>
        </div>
        <button className="flex items-center gap-2 bg-gold-gradient text-black font-semibold px-5 py-2.5 rounded-lg hover:opacity-90 transition-opacity w-fit">
          <Plus size={16} />
          Add Venue
        </button>
      </div>

      {/* Pipeline Board */}
      <div className="mb-8">
        <h2 className="font-semibold mb-4">Pipeline</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {pipelineStages.map((stage) => {
            const count = venues.filter((v) => v.status === stage.id).length;
            return (
              <div
                key={stage.id}
                className={`bg-dark-500 border-t-2 ${stage.color} rounded-xl p-4`}
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium">{stage.label}</h3>
                  <span className="text-gray-500 text-xs bg-white/5 px-2 py-0.5 rounded">
                    {count}
                  </span>
                </div>
                {count === 0 && (
                  <p className="text-gray-600 text-xs">No venues</p>
                )}
                {venues
                  .filter((v) => v.status === stage.id)
                  .map((venue) => (
                    <div
                      key={venue.id}
                      className="bg-dark-300/50 rounded-lg p-3 mb-2 text-sm"
                    >
                      <p className="font-medium">{venue.name}</p>
                      <p className="text-gray-500 text-xs flex items-center gap-1 mt-1">
                        <MapPin size={10} />
                        {venue.area}
                      </p>
                    </div>
                  ))}
              </div>
            );
          })}
        </div>
      </div>

      {/* Empty State */}
      {venues.length === 0 && (
        <div className="bg-dark-500 border border-white/10 rounded-xl p-12 text-center">
          <Building2 size={32} className="text-gray-600 mx-auto mb-3" />
          <h2 className="text-xl font-bold mb-2">No Venues Yet</h2>
          <p className="text-gray-400 text-sm max-w-md mx-auto">
            Add target venues to track your partnership outreach pipeline.
            Assign team members and track progress from prospect to partner.
          </p>
        </div>
      )}
    </div>
  );
}
