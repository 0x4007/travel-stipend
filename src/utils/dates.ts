import { DEFAULT_CONFERENCE_DAYS } from "./constants";
import { Conference } from "./types";

// Parse date strings like "18 February" to a Date object
export function parseDate(dateStr: string, year = 2025): Date | null {
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

// Generate flight dates for a conference (one day before and after)
export function generateFlightDates(conference: Conference): { outbound: string; return: string } {
  const startDate = parseDate(conference.Start);
  if (!startDate) {
    throw new Error("Invalid start date");
  }

  const endDate = conference.End ? parseDate(conference.End) : new Date(startDate);
  if (!endDate) {
    throw new Error("Invalid conference dates");
  }

  // Set arrival date to one day before conference
  const outboundDate = new Date(startDate);
  outboundDate.setDate(startDate.getDate() - 1);

  // Set return date to one day after conference
  const returnDate = new Date(endDate);
  returnDate.setDate(endDate.getDate() + 1);

  // Format dates as YYYY-MM-DD
  function formatDate(date: Date) {
    return date.toISOString().split("T")[0];
  }

  return {
    outbound: formatDate(outboundDate),
    return: formatDate(returnDate),
  };
}
