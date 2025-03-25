import { Conference } from "../types";
import { DEFAULT_CONFERENCE_DAYS } from "./constants";

// Parse date string into a Date object, using next year if date has passed
function parseDate(dateStr: string | undefined | null): Date | null {
  if (!dateStr?.trim()) return null;

  // Get current year
  const year = new Date().getFullYear();

  // Try parsing with current year
  const date = new Date(`${dateStr} ${year}`);

  // If date is in the past, use next year
  return date < new Date() ? new Date(`${dateStr} ${year + 1}`) : date;
}

// Calculate number of nights between two dates
export function calculateDateDiff(startDateStr: string, endDateStr: string | undefined | null): number {
  if (!endDateStr?.trim()) {
    return DEFAULT_CONFERENCE_DAYS - 1; // Default to conference days minus 1 for nights
  }

  const start = parseDate(startDateStr);
  const end = parseDate(endDateStr);

  if (!start || !end) {
    console.warn(`Could not parse dates: ${startDateStr} - ${endDateStr}`);
    return DEFAULT_CONFERENCE_DAYS - 1;
  }

  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((end.getTime() - start.getTime()) / msPerDay);
}

// Generate travel dates for a conference with buffer days
export function generateFlightDates(conference: Conference, isOriginCity = false): { outbound: string; return: string } {
  const startDate = parseDate(conference.start_date);
  if (!startDate) {
    throw new Error("Invalid start date");
  }

  const endDateParsed = parseDate(conference.end_date);
  const endDate = endDateParsed ?? startDate;

  // Get buffer days from the conference record, or use defaults
  // Always enforce minimum of 1 day before AND 1 day after to prevent flying on conference days
  let bufferDaysBefore = conference.buffer_days_before ?? 1; // Default: 1 day before
  let bufferDaysAfter = conference.buffer_days_after ?? 1;   // Default: 1 day after

  // Safety check: require at least 1 day before and 1 day after for flights
  if (bufferDaysBefore === 0) {
    console.warn("SAFETY WARNING: Cannot fly on conference start day. Setting buffer_days_before to 1");
    bufferDaysBefore = 1; // Force at least one buffer day before
  }

  if (bufferDaysAfter === 0) {
    console.warn("SAFETY WARNING: Cannot fly on conference end day. Setting buffer_days_after to 1");
    bufferDaysAfter = 1; // Force at least one buffer day after
  }

  // Set departure to day before conference (or same day for local events)
  const outboundDate = new Date(startDate);
  if (!isOriginCity && bufferDaysBefore > 0) {
    outboundDate.setDate(startDate.getDate() - bufferDaysBefore);
  }

  // Set return to day after conference (or same day for local events)
  const returnDate = new Date(endDate);
  if (!isOriginCity && bufferDaysAfter > 0) {
    returnDate.setDate(endDate.getDate() + bufferDaysAfter);
  }

  // Format dates as YYYY-MM-DD
  const formatDate = (date: Date) => date.toISOString().split("T")[0];

  return {
    outbound: formatDate(outboundDate),
    return: formatDate(returnDate)
  };
}
