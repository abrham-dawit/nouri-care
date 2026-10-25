import { RANGE_DAYS, type RangeKey } from "./types";

/**
 * The demo is pinned to a fixed "now" so the synthetic data, the server render
 * and the browser render always agree.
 *
 * All demo data falls inside Pacific Daylight Time (UTC-7), so local times are
 * formatted with a fixed offset rather than Intl. Intl output can differ between
 * Node and browser ICU versions, which would cause hydration mismatches. Real
 * patient data will need proper per-patient time-zone handling.
 */
export const DEMO_NOW = "2026-10-24T19:00:00.000Z"; // Sat Oct 24 2026, 12:00 PDT
export const DEMO_TIME_ZONE_LABEL = "PT";

const OFFSET_MS = -7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const NOW_MS = Date.parse(DEMO_NOW);

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAYS_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** Local wall-clock parts in the demo time zone. */
function local(at: string | number) {
  const d = new Date((typeof at === "number" ? at : Date.parse(at)) + OFFSET_MS);
  return {
    y: d.getUTCFullYear(),
    mo: d.getUTCMonth(),
    d: d.getUTCDate(),
    wd: d.getUTCDay(),
    h: d.getUTCHours(),
    mi: d.getUTCMinutes(),
  };
}

/** ISO timestamp for `daysAgo` days before the demo day at local `hh:mm`. */
export function localISO(daysAgo: number, hh: number, mm = 0) {
  const today = local(NOW_MS);
  return new Date(Date.UTC(today.y, today.mo, today.d - daysAgo, hh, mm) - OFFSET_MS).toISOString();
}

/** Midnight (local) at the start of the day `daysAgo` days before today, as epoch ms. */
export function startOfLocalDay(daysAgo: number) {
  return Date.parse(localISO(daysAgo, 0, 0));
}

/** Whole local days between `at` and the demo day (0 = today). */
export function daysAgo(at: string) {
  return Math.floor((startOfLocalDay(0) + DAY_MS - 1 - Date.parse(at)) / DAY_MS);
}

export type TimeWindow = { start: number; end: number };

/**
 * The window for a range ending now (today counts as day one). `offsetPeriods`
 * steps back whole periods, e.g. 1 = the previous 7 days for comparison.
 */
export function rangeWindow(range: RangeKey, offsetPeriods = 0): TimeWindow {
  const days = RANGE_DAYS[range];
  return {
    start: startOfLocalDay(days * (offsetPeriods + 1) - 1),
    end: offsetPeriods === 0 ? NOW_MS + 1 : startOfLocalDay(days * offsetPeriods - 1),
  };
}

/** `length` local days ending with the day `endDaysAgo` (capped at now). */
export function dayWindow(endDaysAgo: number, length: number): TimeWindow {
  return {
    start: startOfLocalDay(endDaysAgo + length - 1),
    end: Math.min(NOW_MS + 1, startOfLocalDay(endDaysAgo) + DAY_MS),
  };
}

export function within(at: string, w: TimeWindow) {
  const t = Date.parse(at);
  return t >= w.start && t < w.end;
}

export function inRange(at: string, range: RangeKey, offsetPeriods = 0) {
  return within(at, rangeWindow(range, offsetPeriods));
}

export const nowMs = () => NOW_MS;

export function isFuture(at: string) {
  return Date.parse(at) > NOW_MS;
}

const pad = (n: number) => n.toString().padStart(2, "0");

export function formatTime(at: string) {
  const p = local(at);
  const h12 = p.h % 12 === 0 ? 12 : p.h % 12;
  return `${h12}:${pad(p.mi)} ${p.h < 12 ? "AM" : "PM"}`;
}

/** "HH:MM" wall-clock string → "8:00 AM". */
export function formatClock(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return `${h % 12 === 0 ? 12 : h % 12}:${pad(m)} ${h < 12 ? "AM" : "PM"}`;
}

export function formatDate(at: string) {
  const p = local(at);
  return `${MONTHS[p.mo]} ${p.d}`;
}

export function formatDateWithWeekday(at: string) {
  const p = local(at);
  return `${WEEKDAYS[p.wd]}, ${MONTHS[p.mo]} ${p.d}`;
}

export function formatLongDate(at: string) {
  const p = local(at);
  return `${WEEKDAYS_LONG[p.wd]}, ${MONTHS_LONG[p.mo]} ${p.d}, ${p.y}`;
}

export function formatDateTime(at: string) {
  return `${formatDate(at)}, ${formatTime(at)}`;
}

/** "Today", "Yesterday", or "Wed, Oct 21". */
export function formatRelativeDay(at: string) {
  const n = daysAgo(at);
  if (n === 0) return "Today";
  if (n === 1) return "Yesterday";
  if (n === -1) return "Tomorrow";
  return formatDateWithWeekday(at);
}

export function formatWeekdayShort(at: string) {
  return WEEKDAYS[local(at).wd];
}

/** Stable per-day key (YYYY-MM-DD in local time). */
export function dayKey(at: string) {
  const p = local(at);
  return `${p.y}-${pad(p.mo + 1)}-${pad(p.d)}`;
}

export function greeting() {
  const h = local(NOW_MS).h;
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}
