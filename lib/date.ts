const EVENT_TZ = "Africa/Johannesburg";
const LOCALE = "en-ZA";

function fmt(iso: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(LOCALE, { timeZone: EVENT_TZ, ...options }).format(new Date(iso));
}

export function eventDateLong(iso: string): string {
  return fmt(iso, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

export function eventDateShort(iso: string): string {
  return fmt(iso, { day: "numeric", month: "long", year: "numeric" });
}

export function eventTime(iso: string): string {
  return fmt(iso, { hour: "numeric", minute: "2-digit", hour12: true });
}

export function eventDayNumber(iso: string): string {
  return fmt(iso, { day: "numeric" });
}

export function eventMonthShort(iso: string): string {
  return fmt(iso, { month: "short" }).toUpperCase();
}

export function isEventPast(iso: string): boolean {
  const eventStart = new Date(iso);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: EVENT_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(eventStart);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parseInt(parts.find((p) => p.type === type)!.value, 10);
  const year = get("year");
  const month = get("month");
  const day = get("day");
  const hour = get("hour");
  const cutoffDay = hour >= 4 ? day + 1 : day;
  const cutoffUtc = new Date(Date.UTC(year, month - 1, cutoffDay, 2, 0, 0));
  return Date.now() > cutoffUtc.getTime();
}
