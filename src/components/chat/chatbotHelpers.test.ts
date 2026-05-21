import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  extractSearchCriteria,
  parseDate,
  isBookingIntent,
  isCancelIntent,
  isRescheduleIntent,
} from "./chatbotHelpers";

describe("extractSearchCriteria", () => {
  it("extracts bedroom count", () => {
    expect(extractSearchCriteria("3 bedroom apartment")).toEqual(
      expect.objectContaining({ minBeds: 3 })
    );
  });

  it("extracts max price from 'under RM 2000'", () => {
    expect(extractSearchCriteria("under RM 2000")).toEqual(
      expect.objectContaining({ maxPrice: 2000 })
    );
  });

  it("extracts property type", () => {
    expect(extractSearchCriteria("looking for a condo")).toEqual(
      expect.objectContaining({ type: "condominium" })
    );
  });

  it("extracts location", () => {
    expect(extractSearchCriteria("apartment in Skudai")).toEqual(
      expect.objectContaining({ location: "skudai" })
    );
  });

  it("returns empty object for unrecognised input", () => {
    expect(extractSearchCriteria("show me available list")).toEqual({});
  });

  it("returns empty object for empty string", () => {
    expect(extractSearchCriteria("")).toEqual({});
  });
});

describe("parseDate", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-22"));
  });

  it("accepts valid ISO future date", () => {
    expect(parseDate("2026-06-15")).toEqual({ date: "2026-06-15" });
  });

  it("rejects past ISO date", () => {
    expect(parseDate("2026-01-01")).toEqual({ error: "past" });
  });

  it("rejects today as past (same day not allowed)", () => {
    expect(parseDate("2026-05-22")).toEqual({ error: "past" });
  });

  it("accepts English month-day format", () => {
    expect(parseDate("June 15")).toEqual({ date: "2026-06-15" });
  });

  it("accepts day-month format", () => {
    expect(parseDate("15 June")).toEqual({ date: "2026-06-15" });
  });

  it("returns invalid for gibberish", () => {
    expect(parseDate("not a date")).toEqual({ error: "invalid" });
  });
});

describe("isBookingIntent", () => {
  it("detects 'book'", () => {
    expect(isBookingIntent("I want to book a viewing")).toBe(true);
  });

  it("detects 'appointment'", () => {
    expect(isBookingIntent("make an appointment")).toBe(true);
  });

  it("returns false for unrelated text", () => {
    expect(isBookingIntent("show me available properties")).toBe(false);
  });
});

describe("isCancelIntent", () => {
  it("detects 'cancel'", () => {
    expect(isCancelIntent("I want to cancel my appointment")).toBe(true);
  });

  it("detects 'cancel appointment'", () => {
    expect(isCancelIntent("cancel appointment")).toBe(true);
  });

  it("returns false for booking intent", () => {
    expect(isCancelIntent("book appointment")).toBe(false);
  });
});

describe("isRescheduleIntent", () => {
  it("detects 'reschedule'", () => {
    expect(isRescheduleIntent("can I reschedule")).toBe(true);
  });

  it("detects 'change date'", () => {
    expect(isRescheduleIntent("I need to change date")).toBe(true);
  });

  it("detects 'modify'", () => {
    expect(isRescheduleIntent("modify my booking")).toBe(true);
  });

  it("returns false for cancel intent", () => {
    expect(isRescheduleIntent("cancel my appointment")).toBe(false);
  });
});
