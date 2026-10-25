import { dayKey, formatDate, formatTime, formatWeekdayShort, localISO, startOfLocalDay } from "@/lib/clinical/time";
import { RANGE_DAYS, type RangeKey } from "@/lib/clinical/types";

const HOUR = 60 * 60 * 1000;

/** X domain and tick marks for time-series charts in a given range. */
export function timeAxis(range: RangeKey) {
  if (range === "day") {
    const start = startOfLocalDay(0);
    const domain: [number, number] = [start + 5 * HOUR, start + 23 * HOUR];
    const ticks = [6, 9, 12, 15, 18, 21].map((h) => {
      const at = localISO(0, h);
      return { x: Date.parse(at), label: formatTime(at).replace(":00", "") };
    });
    return { domain, ticks };
  }
  const days = RANGE_DAYS[range];
  const domain: [number, number] = [startOfLocalDay(days - 1), startOfLocalDay(0) + 24 * HOUR];
  const every = range === "week" ? 1 : 5;
  const ticks = Array.from({ length: days }, (_, i) => days - 1 - i)
    .filter((d) => d % every === 0)
    .map((d) => {
      const at = localISO(d, 12);
      return { x: Date.parse(at), label: range === "week" ? formatWeekdayShort(at) : formatDate(at) };
    });
  return { domain, ticks };
}

/** One entry per local day in the range, oldest first. */
export function rangeDays(range: RangeKey) {
  const days = RANGE_DAYS[range];
  return Array.from({ length: days }, (_, i) => {
    const at = localISO(days - 1 - i, 12);
    return { key: dayKey(at), at, label: range === "month" ? formatDate(at) : formatWeekdayShort(at) };
  });
}
