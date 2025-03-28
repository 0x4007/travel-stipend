import { Conference } from "../types";
import { TRAVEL_STIPEND } from "./constants";

// Calculate appropriate year based on date components and current date
function calculateYear(monthNumber: number, day: number, specifiedYear: number | undefined): number {
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();
  const currentDay = currentDate.getDate();

  if (specifiedYear) return specifiedYear;

  // Use next year if the date has already passed this year
  if (monthNumber < currentMonth || (monthNumber === currentMonth && day <= currentDay)) {
    return currentYear + 1;
  }

  return currentYear;
}

// Parse ISO format date string
function parseIsoDate(dateStr: string): Date | null {
  const date = new Date(dateStr);
  if (!isNaN(date.getTime())) {
    date.setFullYear(new Date().getFullYear());
    return date;
  }
  return null;
}

// Parse date string into a Date object, using next year if date has passed
function parseDate(dateStr: string | undefined | null): Date | null {
  if (!dateStr?.trim()) return null;

  // Try ISO format first
  const isoDate = parseIsoDate(dateStr);
  if (isoDate) return isoDate;

  // Try "DD Month YYYY" format
  const parts = dateStr.split(" ");
  if (parts.length < 2) return null;

  const day = parseInt(parts[0]);
  const month = parts[1];
  const specifiedYear = parts[2] ? parseInt(parts[2]) : undefined;

  // Get month number
  const testDate = new Date(`${month} 1, ${new Date().getFullYear()}`);
  if (isNaN(testDate.getTime())) {
    console.warn(`Invalid month name: ${month}`);
    return null;
  }
  const monthNumber = testDate.getMonth();

  // Calculate appropriate year
  const year = calculateYear(monthNumber, day, specifiedYear);

  // Create and validate final date
  const date = new Date(year, monthNumber, day);
  if (!isNaN(date.getTime())) {
    if (date.getFullYear() !== year) {
      date.setFullYear(year);
    }
    return date;
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
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  return {
    outbound: formatDate(outboundDate),
    return: formatDate(returnDate),
  };
}
