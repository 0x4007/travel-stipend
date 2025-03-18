import { DEFAULT_CONFERENCE_DAYS } from "./constants";
import { Conference } from "./types";

// Parse date strings like "18 February" to a Date object
export function parseDate(dateStr: string, year = new Date().getFullYear()): Date | null {
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

// Calculate meal allowance based on day index (for duration-based scaling)
export function getDailyMealAllowance(dayIndex: number, baseMealCost: number): number {
  if (dayIndex < 3) {
    return baseMealCost; // 100% for days 1-3
  }
  return baseMealCost * 0.85; // 85% for days 4+
}

// Generate flight dates for a conference (one day before and after, or same day for origin city)
export function generateFlightDates(conference: Conference, isOriginCity = false): { outbound: string; return: string } {
  const startDate = parseDate(conference.Start);
  if (!startDate) {
    throw new Error("Invalid start date");
  }

  const endDate = conference.End ? parseDate(conference.End) : new Date(startDate);
  if (!endDate) {
    throw new Error("Invalid conference dates");
  }

  // For origin city conferences, use the actual conference dates
  // For non-origin city conferences, add buffer days
  const outboundDate = new Date(startDate);
  if (!isOriginCity) {
    outboundDate.setDate(startDate.getDate() - 1);
  }

  // Set return date to one day after conference (or same day for origin city)
  const returnDate = new Date(endDate);
  if (!isOriginCity) {
    returnDate.setDate(endDate.getDate() + 1);
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
