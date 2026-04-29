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
