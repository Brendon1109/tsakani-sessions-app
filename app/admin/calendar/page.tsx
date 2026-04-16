"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Circle } from "lucide-react";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Placeholder events for calendar display
const calendarEvents: { date: string; title: string; type: "event" | "task" | "deadline" }[] = [];

export default function AdminCalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  // Monday = 0, Sunday = 6
  const startOffset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = lastDay.getDate();

  const prevMonth = () =>
    setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () =>
    setCurrentDate(new Date(year, month + 1, 1));

  const monthName = currentDate.toLocaleString("default", {
    month: "long",
    year: "numeric",
  });

  const today = new Date();
  const isToday = (day: number) =>
    day === today.getDate() &&
    month === today.getMonth() &&
    year === today.getFullYear();

  const getEventsForDay = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return calendarEvents.filter((e) => e.date === dateStr);
  };

  const typeColors = {
    event: "bg-gold-500",
    task: "bg-blue-400",
    deadline: "bg-red-400",
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold">Calendar</h1>
        <p className="text-gray-400 mt-1">
          Events, tasks, and deadlines at a glance
        </p>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mb-6 text-xs">
        <span className="flex items-center gap-1.5 text-gray-400">
          <Circle size={8} className="fill-gold-500 text-gold-500" /> Event
        </span>
        <span className="flex items-center gap-1.5 text-gray-400">
          <Circle size={8} className="fill-blue-400 text-blue-400" /> Task
        </span>
        <span className="flex items-center gap-1.5 text-gray-400">
          <Circle size={8} className="fill-red-400 text-red-400" /> Deadline
        </span>
      </div>

      {/* Calendar */}
      <div className="bg-dark-500 border border-white/10 rounded-xl overflow-hidden">
        {/* Month nav */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <button
            onClick={prevMonth}
            className="text-gray-400 hover:text-white p-1 transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
          <h2 className="text-lg font-bold">{monthName}</h2>
          <button
            onClick={nextMonth}
            className="text-gray-400 hover:text-white p-1 transition-colors"
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
                className={`p-2 sm:p-3 min-h-[60px] sm:min-h-[80px] border-b border-r border-white/5 hover:bg-white/5 transition-colors cursor-pointer ${
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
                {dayEvents.map((event, j) => (
                  <div
                    key={j}
                    className={`mt-1 text-xs px-1.5 py-0.5 rounded truncate ${typeColors[event.type]} text-black`}
                  >
                    {event.title}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
