export const extractSearchCriteria = (text: string) => {
  try {
    if (!text) return {};
    const criteria: Record<string, unknown> = {};
    const lower = text.toLowerCase();

    const bedMatch = lower.match(/(\d+)\s*(?:bed|room)/);
    if (bedMatch) criteria.minBeds = parseInt(bedMatch[1]);

    const priceMatch =
      lower.match(/(?:under|rm|max|budget)\s*(\d+)/) ||
      lower.match(/<\s*(\d+)/);
    if (priceMatch) criteria.maxPrice = parseInt(priceMatch[1]);

    const types = ["apartment", "condo", "condominium", "terrace", "flat", "bungalow", "semi-d", "house"];
    const foundType = types.find((t) => lower.includes(t));
    if (foundType) criteria.type = foundType === "condo" ? "condominium" : foundType;

    const locations = ["johor bahru", "jb", "skudai", "mount austin", "pasir gudang", "kulai", "muar", "batu pahat"];
    const foundLoc = locations.find((l) => lower.includes(l));
    if (foundLoc) criteria.location = foundLoc;

    return criteria;
  } catch {
    return {};
  }
};

const MONTH_NAMES: Record<string, string> = {
  january: "01", february: "02", march: "03", april: "04",
  may: "05", june: "06", july: "07", august: "08",
  september: "09", october: "10", november: "11", december: "12",
};

/** Build a zero-padded day string, returns null if day is out of range. */
const padDay = (day: number): string | null => {
  if (day < 1 || day > 31) return null;
  return String(day).padStart(2, "0");
};

/**
 * Accepts ISO dates (2026-03-15), "March 15", "15 March", etc.
 * Returns { date: ISO string } on success, { error: "past" | "invalid" } on failure.
 * Today is treated as past — only strictly future dates are valid.
 */
export const parseDate = (text: string): { date: string } | { error: "past" | "invalid" } => {
  const trimmed = text.trim();
  const todayStr = new Date().toISOString().split("T")[0];
  const currentYear = new Date().getFullYear();

  // ISO format: 2026-06-15
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const d = new Date(trimmed);
    if (isNaN(d.getTime())) return { error: "invalid" };
    return trimmed > todayStr ? { date: trimmed } : { error: "past" };
  }

  // "Month Day" e.g. "June 15" or "June 15 2026"
  const monthDayMatch = trimmed.match(/^([A-Za-z]+)\s+(\d{1,2})(?:\s+(\d{4}))?$/);
  if (monthDayMatch) {
    const monthStr = MONTH_NAMES[monthDayMatch[1].toLowerCase()];
    const dayStr = padDay(parseInt(monthDayMatch[2]));
    const year = monthDayMatch[3] ? parseInt(monthDayMatch[3]) : currentYear;
    if (!monthStr || !dayStr) return { error: "invalid" };
    const iso = `${year}-${monthStr}-${dayStr}`;
    return iso > todayStr ? { date: iso } : { error: "past" };
  }

  // "Day Month" e.g. "15 June" or "15 June 2026"
  const dayMonthMatch = trimmed.match(/^(\d{1,2})\s+([A-Za-z]+)(?:\s+(\d{4}))?$/);
  if (dayMonthMatch) {
    const monthStr = MONTH_NAMES[dayMonthMatch[2].toLowerCase()];
    const dayStr = padDay(parseInt(dayMonthMatch[1]));
    const year = dayMonthMatch[3] ? parseInt(dayMonthMatch[3]) : currentYear;
    if (!monthStr || !dayStr) return { error: "invalid" };
    const iso = `${year}-${monthStr}-${dayStr}`;
    return iso > todayStr ? { date: iso } : { error: "past" };
  }

  return { error: "invalid" };
};

const BOOKING_KEYWORDS = ["book", "appointment", "schedule", "viewing", "visit", "arrange"];
const CANCEL_KEYWORDS = ["cancel", "remove appointment", "delete appointment", "cancel appointment"];
const RESCHEDULE_KEYWORDS = ["reschedule", "change appointment", "modify", "change date", "change time", "move appointment"];

export const isBookingIntent = (text: string) =>
  BOOKING_KEYWORDS.some((k) => text.toLowerCase().includes(k));

export const isCancelIntent = (text: string) =>
  CANCEL_KEYWORDS.some((k) => text.toLowerCase().includes(k));

export const isRescheduleIntent = (text: string) =>
  RESCHEDULE_KEYWORDS.some((k) => text.toLowerCase().includes(k));
