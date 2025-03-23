import { DEFAULT_CONFERENCE_DAYS } from "./constants";
import { Conference } from "./types";

// Parse date strings like "18 February" to a Date object
function parseDate(dateStr: string, year = new Date().getFullYear()): Date | null {
  if (!dateStr || dateStr.trim() === "") {
    return null;
  }

  // Add the year to the date string
  const fullDateStr = `${dateStr} ${year}`;

  try {
    return new Date(fullDateStr);
  } catch (error) {
    console.error(`Error parsing date: ${dateStr}`, error);
    return null;
  }
}

// Calculate the difference in days between two dates
export function calculateDateDiff(startDateStr: string, endDateStr: string): number {
  const start = parseDate(startDateStr);

  // If end date is empty, assume the conference is defaultDays days long
  if (!endDateStr || endDateStr.trim() === "") {
    if (start) {
      const end = new Date(start);
      end.setDate(end.getDate() + DEFAULT_CONFERENCE_DAYS - 1); // -1 because the start day counts as day 1
      return DEFAULT_CONFERENCE_DAYS - 1; // Return nights (days - 1)
    }
    return DEFAULT_CONFERENCE_DAYS - 1; // Default to defaultDays - 1 nights
  }

  const end = parseDate(endDateStr);

  if (!start || !end) {
    console.warn(`Could not parse dates: ${startDateStr} - ${endDateStr}, using default of ${DEFAULT_CONFERENCE_DAYS} days`);
    return DEFAULT_CONFERENCE_DAYS - 1; // Default to defaultDays - 1 nights
  }

  const msPerDay = 24 * 60 * 60 * 1000;
  const diffInMs = end.getTime() - start.getTime();
  const diffInDays = Math.round(diffInMs / msPerDay) + 1; // +1 because both start and end days are inclusive

  return diffInDays - 1; // Convert days to nights
}

// Calculate meal allowance based on day index (for duration-based scaling) - removed as unused

// Generate flight dates for a conference (with customizable buffer days)
export function generateFlightDates(conference: Conference, isOriginCity = false): { outbound: string; return: string } {
  const startDate = parseDate(conference.start_date);
  if (!startDate) {
    throw new Error("Invalid start date");
  }

  const endDate = conference.end_date ? parseDate(conference.end_date) : new Date(startDate);
  if (!endDate) {
    throw new Error("Invalid conference dates");
  }

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

  // For origin city conferences, use the actual conference dates
  // For non-origin city conferences, add buffer days
  const outboundDate = new Date(startDate);
  if (!isOriginCity && bufferDaysBefore > 0) {
    outboundDate.setDate(startDate.getDate() - bufferDaysBefore);
  }

  // Set return date to specified days after conference (or same day for origin city)
  const returnDate = new Date(endDate);
  if (!isOriginCity && bufferDaysAfter > 0) {
    returnDate.setDate(endDate.getDate() + bufferDaysAfter);
  }

  // Format dates as YYYY-MM-DD in local timezone
  function formatDate(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  return {
    outbound: formatDate(outboundDate),
    return: formatDate(returnDate),
  };
}
