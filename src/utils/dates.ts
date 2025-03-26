import { Conference } from "../types";
import { TRAVEL_STIPEND } from "./constants";

// Parse date string into a Date object, using next year if date has passed
function parseDate(dateStr: string | undefined | null): Date | null {
  if (!dateStr?.trim()) return null;

  // First try parsing as ISO format (YYYY-MM-DD)
  let date = new Date(dateStr);
  if (!isNaN(date.getTime())) {
    return date;
  }

  // If that fails, try parsing as "DD Month YYYY" format
  const parts = dateStr.split(' ');
  if (parts.length >= 2) {
    const day = parseInt(parts[0]);
    const month = parts[1];
    // Default to next year if not specified and date would be in past
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    let year = parts[2] ? parseInt(parts[2]) : currentYear;

    // Create date with current/specified year
    date = new Date(`${month} ${day}, ${year}`);

    // If no year was specified and date would be in past, use next year
    if (!parts[2] && date < currentDate) {
      year = currentYear + 1;
      date = new Date(`${month} ${day}, ${year}`);
    }

    if (!isNaN(date.getTime())) {
      return date;
    }
  }

  console.warn(`Could not parse date: ${dateStr}`);
  return null;
}

// Calculate number of nights between two dates
export function calculateDateDiff(startDateStr: string, endDateStr: string | undefined | null): number {
  if (!endDateStr?.trim()) {
    return TRAVEL_STIPEND.conference.defaultDays - 1; // Default to conference days minus 1 for nights
  }

  const start = parseDate(startDateStr);
  const end = parseDate(endDateStr);

  if (!start || !end) {
    console.warn(`Could not parse dates: ${startDateStr} - ${endDateStr}`);
    return TRAVEL_STIPEND.conference.defaultDays - 1;
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
  let bufferDaysBefore = conference.buffer_days_before ?? TRAVEL_STIPEND.conference.preDays; // Default: 1 day before
  let bufferDaysAfter = conference.buffer_days_after ?? TRAVEL_STIPEND.conference.postDays; // Default: 1 day after

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
  function formatDate(date: Date) {
    return date.toISOString().split("T")[0];
  }

  return {
    outbound: formatDate(outboundDate),
    return: formatDate(returnDate),
  };
}
