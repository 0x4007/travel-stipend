import { Conference } from "../types";
import { TRAVEL_STIPEND } from "./constants";

// Parse date string into a Date object, using next year if date has passed
function parseDate(dateStr: string | undefined | null): Date | null {
  if (!dateStr?.trim()) return null;

  // First try parsing as ISO format (YYYY-MM-DD)
  let date = new Date(dateStr);
  if (!isNaN(date.getTime())) {
    // Ensure we're using current year for ISO dates too
    const currentYear = new Date().getFullYear();
    date.setFullYear(currentYear);
    return date;
  }

  // If that fails, try parsing as "DD Month YYYY" format
  const parts = dateStr.split(' ');
  if (parts.length >= 2) {
    const day = parseInt(parts[0]);
    const month = parts[1];
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    console.log('Parsing date:', { dateStr, currentYear, currentDate: currentDate.toISOString() });

    // Get current month and day
    const currentMonth = currentDate.getMonth(); // 0-11
    const currentDay = currentDate.getDate();

    // Create a test date with current year to get month number
    const testDate = new Date(`${month} 1, ${currentYear}`);
    if (isNaN(testDate.getTime())) {
      console.warn(`Invalid month name: ${month}`);
      return null;
    }
    const monthNumber = testDate.getMonth();

    // Use specified year or calculate based on current date
    let year = parts[2] ? parseInt(parts[2]) : currentYear;

    // If no year specified and the date has passed this year, use next year
    if (!parts[2] && (monthNumber < currentMonth || (monthNumber === currentMonth && day <= currentDay))) {
      year = currentYear + 1;
    }

    // Create final date using the determined year
    date = new Date(year, monthNumber, day);
    console.log('Created date:', { year, monthNumber, day, result: date.toISOString() });

    if (!isNaN(date.getTime())) {
      // Double check year is set correctly
      if (date.getFullYear() !== year) {
        date.setFullYear(year);
      }
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
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  return {
    outbound: formatDate(outboundDate),
    return: formatDate(returnDate),
  };
}
