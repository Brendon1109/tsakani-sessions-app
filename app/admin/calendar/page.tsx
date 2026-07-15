"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Circle } from "lucide-react";
import { isEventPast } from "@/lib/date";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  status: "draft" | "published" | "past";
}

type EventKind = "event" | "past" | "draft";

// upcoming published = gold, past = grey, draft = blue
const kindColors: Record<EventKind, string> = {
  event: "bg-gold-500 text-black",
  past: "bg-white/10 text-gray-300",
  draft: "bg-blue-400 text-black",
};

function kindOf(event: CalendarEvent): EventKind {
  if (event.status === "draft") return "draft";
  if (event.status === "past" || isEventPast(event.date)) return "past";
  return "event";
}

function localDateKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export default function AdminCalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/admin/events");
        if (res.ok && active) {
          const data = await res.json();
          if (Array.isArray(data)) {
            setEvents(
              data
                .filter((e) => e?.date)
                .map((e) => ({
                  id: e.id,
                  title: e.title,
                  date: e.date,
                  status: e.status,
                }))
            );
          }
        }
      } catch {
        // leave events empty on failure
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  // Monday = 0, Sunday = 6
  const startOffset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = lastDay.getDate();

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const monthName = currentDate.toLocaleString("default", {
    month: "long",
    year: "numeric",
  });

  const today = new Date();
  const isToday = (day: number) =>
    day === today.getDate() &&
    month === today.getMonth() &&
    year === today.getFullYear();

  // Group events by local date key once per events change.
  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of events) {
      const key = localDateKey(event.date);
      const list = map.get(key);
      if (list) list.push(event);
      else map.set(key, [event]);
    }
    return map;
  }, [events]);

  const getEventsForDay = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return eventsByDay.get(dateStr) || [];
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold">Calendar</h1>
        <p className="text-gray-400 mt-1">
          Every event on one view, coloured by status
        </p>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mb-6 text-xs">
        <span className="flex items-center gap-1.5 text-gray-400">
          <Circle size={8} className="fill-gold-500 text-gold-500" /> Upcoming
        </span>
        <span className="flex items-center gap-1.5 text-gray-400">
          <Circle size={8} className="fill-blue-400 text-blue-400" /> Draft
        </span>
        <span className="flex items-center gap-1.5 text-gray-400">
          <Circle size={8} className="fill-white/40 text-white/40" /> Past
        </span>
        {loading && <span className="text-gray-600">Loading events...</span>}
      </div>

      {/* Calendar */}
      <div className="bg-dark-500 border border-white/10 rounded-xl overflow-hidden">
        {/* Month nav */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <button
            onClick={prevMonth}
            className="text-gray-400 hover:text-white p-1 transition-colors"
            aria-label="Previous month"
          >
            <ChevronLeft size={20} />
          </button>
          <h2 className="text-lg font-bold">{monthName}</h2>
          <button
            onClick={nextMonth}
            className="text-gray-400 hover:text-white p-1 transition-colors"
            aria-label="Next month"
          >
            <ChevronRight size={20} />
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-white/10">
          {DAYS.map((day) => (
            <div
              key={day}
              className="p-2 text-center text-xs font-medium text-gray-500"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Days grid */}
        <div className="grid grid-cols-7">
          {/* Empty cells before first day */}
          {Array.from({ length: startOffset }).map((_, i) => (
            <div
              key={`empty-${i}`}
              className="p-2 sm:p-3 min-h-[60px] sm:min-h-[80px] border-b border-r border-white/5"
            />
          ))}

          {/* Day cells */}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const dayEvents = getEventsForDay(day);
            return (
              <div
                key={day}
                className={`p-2 sm:p-3 min-h-[60px] sm:min-h-[80px] border-b border-r border-white/5 hover:bg-white/5 transition-colors ${
                  isToday(day) ? "bg-gold-500/5" : ""
                }`}
              >
                <span
                  className={`text-sm ${
                    isToday(day)
                      ? "bg-gold-500 text-black w-6 h-6 rounded-full flex items-center justify-center font-bold"
                      : "text-gray-400"
                  }`}
                >
                  {day}
                </span>
                {dayEvents.map((event) => (
                  <Link
                    key={event.id}
                    href="/admin/events"
                    title={event.title}
                    className={`mt-1 block text-xs px-1.5 py-0.5 rounded truncate hover:opacity-90 transition-opacity ${
                      kindColors[kindOf(event)]
                    }`}
                  >
                    {event.title}
                  </Link>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
