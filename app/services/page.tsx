"use client";

import { useState } from "react";
import {
  PartyPopper,
  Music,
  Camera,
  Check,
  X,
  MessageCircle,
} from "lucide-react";
import { createBookingMessage, openWhatsApp, type BookingData } from "@/lib/whatsapp";

const services = [
  {
    id: "full-experience",
    icon: PartyPopper,
    title: "Full Tsakani Experience",
    tagline: "The complete package",
    price: "From R5,000",
    description:
      "Everything you need for an unforgettable event. Our flagship offering brings together the best DJs, vibe zones, full content creation, and that signature Tsakani energy.",
    features: [
      "Curated DJ lineup (2-4 DJs)",
      "Professional sound & lighting",
      "Content creation crew on site",
      "Highlight reel & aftermovie",
      "Social media coverage",
      "Event photography",
      "Custom event branding",
      "Dedicated event coordinator",
    ],
  },
  {
    id: "dj-performance",
    icon: Music,
    title: "DJ & Live Performance",
    tagline: "Set the vibe",
    price: "From R2,500",
    description:
      "Professional DJ selection with curated playlists tailored to your audience. From deep house to amapiano, we read the room and deliver the perfect sound.",
    features: [
      "Professional DJ(s) of your choice",
      "Curated playlist for your event",
      "Professional sound equipment",
      "Setup & soundcheck included",
      "VirtualDJ recorded mix",
      "Up to 6 hours of performance",
    ],
  },
  {
    id: "content-creation",
    icon: Camera,
    title: "Content & Documentation",
    tagline: "Capture every moment",
    price: "From R3,000",
    description:
      "Professional videography and photography that tells the story of your event. From raw footage to polished edits, we handle the entire post-production pipeline.",
    features: [
      "DJI Osmo cinematic footage",
      "iPhone transition clips",
      "Professional photography",
      "Lightroom photo editing",
      "CapCut short-form edits",
      "YouTube aftermovie production",
      "Instagram Reels & TikTok clips",
      "Full event photo gallery",
    ],
  },
];

export default function ServicesPage() {
  const [showBooking, setShowBooking] = useState(false);
  const [, setSelectedService] = useState("");
  const [formData, setFormData] = useState<BookingData>({
    name: "",
    email: "",
    phone: "",
    eventType: "",
    eventDate: "",
    venue: "",
    budget: "",
    message: "",
  });

  const handleBook = (serviceId: string) => {
    setSelectedService(serviceId);
    setFormData((prev) => ({
      ...prev,
      eventType: services.find((s) => s.id === serviceId)?.title || "",
    }));
    setShowBooking(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const message = createBookingMessage(formData);
    openWhatsApp(message);
    setShowBooking(false);
  };

  return (
    <div>
      {/* Header */}
      <section className="py-16 sm:py-24 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl font-bold mb-4">
            Our <span className="text-gold-gradient">Services</span>
          </h1>
          <p className="text-gray-400 max-w-2xl mx-auto text-lg">
            From intimate gatherings to large-scale events, we bring the
            Tsakani experience to every occasion.
          </p>
        </div>
      </section>

      {/* Services */}
      <section className="pb-16 sm:pb-24 px-4">
        <div className="max-w-7xl mx-auto space-y-8">
          {services.map((service) => {
            const Icon = service.icon;
            return (
              <div
                key={service.id}
                className="bg-dark-500 border border-white/10 rounded-2xl overflow-hidden hover:border-gold-500/30 transition-all duration-300"
              >
                <div className="p-6 sm:p-10">
                  <div className="flex flex-col lg:flex-row lg:items-start gap-8">
                    {/* Left: Info */}
                    <div className="flex-1">
                      <div className="flex items-center gap-4 mb-4">
                        <div className="bg-gold-500/10 text-gold-500 p-3 rounded-xl">
                          <Icon size={28} />
                        </div>
                        <div>
                          <h2 className="text-2xl font-bold">
                            {service.title}
                          </h2>
                          <p className="text-gold-500 text-sm font-medium">
                            {service.tagline}
                          </p>
                        </div>
                      </div>
                      <p className="text-gray-400 leading-relaxed mb-6">
                        {service.description}
                      </p>
                      <div className="flex items-center gap-4">
                        <span className="text-2xl font-bold text-gold-500">
                          {service.price}
                        </span>
                        <button
                          onClick={() => handleBook(service.id)}
                          className="bg-gold-gradient text-black font-semibold px-6 py-2.5 rounded-full hover:opacity-90 transition-opacity flex items-center gap-2"
                        >
                          <MessageCircle size={16} />
                          Book Now
                        </button>
                      </div>
                    </div>

                    {/* Right: Features */}
                    <div className="lg:w-80 bg-dark-300/50 rounded-xl p-6">
                      <h3 className="text-sm font-semibold text-gold-500 uppercase tracking-wider mb-4">
                        What&apos;s Included
                      </h3>
                      <ul className="space-y-3">
                        {service.features.map((feature) => (
                          <li
                            key={feature}
                            className="flex items-start gap-2.5 text-sm text-gray-300"
                          >
                            <Check
                              size={16}
                              className="text-gold-500 mt-0.5 shrink-0"
                            />
                            {feature}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Booking Modal */}
      {showBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-dark-500 border border-gold-500/20 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-scale-in">
            <div className="flex items-center justify-between p-6 border-b border-white/10">
              <h3 className="text-xl font-bold">Book a Service</h3>
              <button
                onClick={() => setShowBooking(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">
                  Service
                </label>
                <select
                  value={formData.eventType}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      eventType: e.target.value,
                    }))
                  }
                  className="w-full bg-dark-300 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:border-gold-500 focus:outline-none transition-colors"
                >
                  {services.map((s) => (
                    <option key={s.id} value={s.title}>
                      {s.title}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1.5">
                    Name *
                  </label>
                  <input
                    required
                    type="text"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, name: e.target.value }))
                    }
                    className="w-full bg-dark-300 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:border-gold-500 focus:outline-none transition-colors"
                    placeholder="Your name"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1.5">
                    Phone *
                  </label>
                  <input
                    required
                    type="tel"
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        phone: e.target.value,
                      }))
                    }
                    className="w-full bg-dark-300 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:border-gold-500 focus:outline-none transition-colors"
                    placeholder="+27..."
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">
                  Email *
                </label>
                <input
                  required
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, email: e.target.value }))
                  }
                  className="w-full bg-dark-300 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:border-gold-500 focus:outline-none transition-colors"
                  placeholder="your@email.com"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1.5">
                    Event Date *
                  </label>
                  <input
                    required
                    type="date"
                    value={formData.eventDate}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        eventDate: e.target.value,
                      }))
                    }
                    className="w-full bg-dark-300 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:border-gold-500 focus:outline-none transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1.5">
                    Venue *
                  </label>
                  <input
                    required
                    type="text"
                    value={formData.venue}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        venue: e.target.value,
                      }))
                    }
                    className="w-full bg-dark-300 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:border-gold-500 focus:outline-none transition-colors"
                    placeholder="Venue name or location"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">
                  Budget Range
                </label>
                <select
                  value={formData.budget}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      budget: e.target.value,
                    }))
                  }
                  className="w-full bg-dark-300 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:border-gold-500 focus:outline-none transition-colors"
                >
                  <option value="">Select budget range</option>
                  <option value="R2,000 - R5,000">R2,000 - R5,000</option>
                  <option value="R5,000 - R10,000">R5,000 - R10,000</option>
                  <option value="R10,000 - R20,000">R10,000 - R20,000</option>
                  <option value="R20,000+">R20,000+</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">
                  Additional Details
                </label>
                <textarea
                  value={formData.message}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      message: e.target.value,
                    }))
                  }
                  rows={3}
                  className="w-full bg-dark-300 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:border-gold-500 focus:outline-none transition-colors resize-none"
                  placeholder="Tell us about your event..."
                />
              </div>
              <button
                type="submit"
                className="w-full bg-gold-gradient text-black font-semibold py-3 rounded-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
              >
                <MessageCircle size={18} />
                Send via WhatsApp
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
