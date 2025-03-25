import fs from "fs";
import path from "path";
import { Conference, Coordinates, MealCosts, StipendBreakdown } from "./types";
import { createHashKey, PersistentCache } from "./utils/cache";
import {
  BASE_LOCAL_TRANSPORT_PER_DAY,
  BASE_LODGING_PER_NIGHT,
  BASE_MEALS_PER_DAY,
  BUSINESS_ENTERTAINMENT_PER_DAY,
  COST_PER_KM,
  DEFAULT_TICKET_PRICE,
  INCIDENTALS_PER_DAY,
  INTERNATIONAL_INTERNET_ALLOWANCE,
  POST_CONFERENCE_DAYS,
  PRE_CONFERENCE_DAYS,
  WEEKEND_RATE_MULTIPLIER,
} from "./utils/constants";
import { getCostOfLivingFactor } from "./utils/cost-of-living";
import { DatabaseService } from "./utils/database";
import { calculateDateDiff, generateFlightDates } from "./utils/dates";
import { haversineDistance } from "./utils/distance";
import { calculateFlightCost, scrapeFlightPrice } from "./utils/flights";
import { calculateLocalTransportCost } from "./utils/taxi-fares";

// Initialize caches
const distanceCache = new PersistentCache<number>("fixtures/cache/distance-cache.json");
const coordinatesCache = new PersistentCache<Coordinates>("fixtures/cache/coordinates-cache.json");
const costOfLivingCache = new PersistentCache<number>("fixtures/cache/col-cache.json");
const stipendCache = new PersistentCache<StipendBreakdown>("fixtures/cache/stipend-cache.json");

// Helper function to calculate flight cost
async function calculateFlightCostForConference(
  origin: string,
  destination: string,
  flightDates: { outbound: string; return: string },
  distanceKm: number,
  isOriginCity: boolean
): Promise<{ cost: number; source: string }> {
  // If destination is the same as origin, no flight cost
  if (isOriginCity) {
    console.log(`No flight cost for ${destination} (same as origin)`);
    return { cost: 0, source: "No flight needed" };
  }

  // Try to get flight cost from Google Flights scraper
  const scrapedResult = await scrapeFlightPrice(origin, destination, flightDates);

  if (scrapedResult.price !== null) {
    // If we have scraped flight price, use it
    console.log(`Flight cost for ${destination}: ${scrapedResult.price} (from ${scrapedResult.source})`);
    console.log(`Last flight lookup time: ${new Date().toLocaleString()}`);
    return { cost: scrapedResult.price, source: scrapedResult.source };
  } else {
    // Use distance-based calculation as fallback
    const calculatedCost = calculateFlightCost(distanceKm, destination, origin);
    console.log(`Flight cost for ${destination}: ${calculatedCost}`);
    return { cost: calculatedCost, source: "Distance-based calculation" };
  }
}

// Helper functions to break down stipend calculations
async function calculateFlightDetails(
  origin: string,
  destination: string,
  isOriginCity: boolean,
  record: Conference
): Promise<{
  distanceKm: number;
  flightCost: number;
  flightPriceSource: string;
  flightDates: { outbound: string; return: string };
}> {
  // Get coordinates from DB and calculate distance
  const originCoords = await DatabaseService.getInstance().getCityCoordinates(origin);
  const destCoords = await DatabaseService.getInstance().getCityCoordinates(destination);

  if (!originCoords.length || !destCoords.length) {
    throw new Error(`Could not find coordinates for ${!originCoords.length ? origin : destination}`);
  }

  // Calculate distance directly using the coordinates we already have
  const originCoord = originCoords[0];
  const destCoord = destCoords[0];
  const distanceKm = haversineDistance(originCoord, destCoord);

  console.log(`Distance from ${origin} to ${destination}: ${distanceKm.toFixed(1)} km`);

  // Generate flight dates and calculate flight cost
  const flightDates = generateFlightDates(record, isOriginCity);
  const flightResult = await calculateFlightCostForConference(origin, destination, flightDates, distanceKm, isOriginCity);

  return {
    distanceKm,
    flightCost: flightResult.cost,
    flightPriceSource: flightResult.source,
    flightDates,
  };
}

function calculateNights(
  startDate: string,
  totalDays: number,
  preConferenceDays: number
): { weekdayNights: number; weekendNights: number } {
  const start = new Date(startDate);
  let weekendNights = 0;
  const numberOfNights = totalDays - 1; // One less night than days

  for (let i = 0; i < numberOfNights; i++) {
    const currentDate = new Date(start);
    currentDate.setDate(start.getDate() - preConferenceDays + i);
    const dayOfWeek = currentDate.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      // Sunday = 0, Saturday = 6
      weekendNights++;
    }
  }

  return {
    weekdayNights: numberOfNights - weekendNights,
    weekendNights,
  };
}

function calculateMealsCosts(
  totalDays: number,
  conferenceDays: number,
  colFactor: number
): MealCosts {
  let basicMealsCost = 0;
  for (let i = 0; i < totalDays; i++) {
    // Apply duration-based scaling (100% for days 1-3, 85% for days 4+)
    const dailyMealCost = i < 3 ? BASE_MEALS_PER_DAY * colFactor : BASE_MEALS_PER_DAY * colFactor * 0.85;
    basicMealsCost += dailyMealCost;
  }

  const businessEntertainmentCost = BUSINESS_ENTERTAINMENT_PER_DAY * conferenceDays;
  return {
    basicMealsCost,
    mealsCost: basicMealsCost + businessEntertainmentCost,
    businessEntertainmentCost,
  };
}

// Main function to calculate stipend with caching
export async function calculateStipend(record: Conference & { origin?: string }): Promise<StipendBreakdown> {
  if (!record.origin) {
    throw new Error("Origin city is required for travel stipend calculation");
  }

  const origin = record.origin;
  const cacheKey = createHashKey([
    record.conference,
    record.location,
    record.start_date,
    record.end_date,
    origin,
    COST_PER_KM,
    BASE_LODGING_PER_NIGHT,
    BASE_MEALS_PER_DAY,
    record.ticket_price ?? DEFAULT_TICKET_PRICE,
    "v9", // Increment version to force recalculation with Google Flights scraper
  ]);

  const destination = record.location;
  console.log(`Processing conference: ${record.conference} in ${destination}`);

  // Check if conference is in origin city
  const isOriginCity = origin === destination;

  // Get flight details
  const { distanceKm, flightCost, flightPriceSource, flightDates } = await calculateFlightDetails(
    origin,
    destination,
    isOriginCity,
    record
  );

  // Get cost-of-living multiplier for the destination
  const colFactor = await getCostOfLivingFactor(destination);

  // Calculate conference and travel days
  const conferenceDays = calculateDateDiff(record.start_date, record.end_date) + 1; // +1 because end date is inclusive

  // Use custom buffer days if provided, otherwise use defaults
  const preConferenceDays = isOriginCity ? 0 : (record.buffer_days_before ?? PRE_CONFERENCE_DAYS);
  const postConferenceDays = isOriginCity ? 0 : (record.buffer_days_after ?? POST_CONFERENCE_DAYS);
  const totalDays = conferenceDays + preConferenceDays + postConferenceDays;
  const numberOfNights = totalDays - 1; // One less night than days

  console.log(`Conference duration: ${conferenceDays} days, Total stay: ${totalDays} days (${numberOfNights} nights)`);
  console.log(`Travel dates: ${flightDates.outbound} to ${flightDates.return}`);

  if (isOriginCity) {
    console.log(`No buffer days included for origin city conference`);
  } else {
    console.log(`Buffer days: ${preConferenceDays} day(s) before, ${postConferenceDays} day(s) after the conference`);
  }

  // Calculate nights breakdown
  const { weekdayNights, weekendNights } = calculateNights(record.start_date, totalDays, preConferenceDays);

  // Adjust lodging rates with cost of living factor and weekend discounts
  const baseWeekdayRate = BASE_LODGING_PER_NIGHT * colFactor;
  const baseWeekendRate = baseWeekdayRate * WEEKEND_RATE_MULTIPLIER;

  // Calculate costs (no lodging cost if conference is in origin city)
  const lodgingCost = isOriginCity ? 0 : weekdayNights * baseWeekdayRate + weekendNights * baseWeekendRate;

  // Calculate meals costs
  const { basicMealsCost, mealsCost, businessEntertainmentCost } = calculateMealsCosts(totalDays, conferenceDays, colFactor);

  // Calculate local transport cost using taxi data
  const localTransportCost = await calculateLocalTransportCost(destination, totalDays, colFactor, BASE_LOCAL_TRANSPORT_PER_DAY);

  // Get ticket price
  const ticketPrice = record.ticket_price ? parseFloat(record.ticket_price.replace("$", "")) : DEFAULT_TICKET_PRICE;

  // Determine if international travel (and not in origin city)
  const isInternational = !isOriginCity && origin.toLowerCase().includes("korea") && !destination.toLowerCase().includes("korea");

  // Add internet/data allowance (only for international travel)
  const internetDataAllowance = isInternational ? INTERNATIONAL_INTERNET_ALLOWANCE : 0;

  // Add incidentals allowance
  const incidentalsAllowance = totalDays * INCIDENTALS_PER_DAY;

  // Calculate total stipend
  const totalStipend = flightCost +
    lodgingCost +
    mealsCost +
    localTransportCost +
    ticketPrice +
    internetDataAllowance +
    incidentalsAllowance;

  // Format date to match conference date format (DD Month)
  function formatDateToConferenceStyle(dateStr: string) {
    const date = new Date(dateStr);
    return date.getDate() + " " + date.toLocaleString("en-US", { month: "long" });
  }

  // Calculate proper end date
  // If record.end_date is empty, calculate it from the start_date
  let conferenceEndDate = record.end_date;
  if (!conferenceEndDate || conferenceEndDate === record.start_date) {
    // Calculate the end date based on conference days
    if (conferenceDays > 1) {
      const endDate = new Date(`${record.start_date} 2025`);
      endDate.setDate(endDate.getDate() + conferenceDays - 1);
      conferenceEndDate = endDate.getDate() + " " + endDate.toLocaleString("en-US", { month: "long" });
    } else {
      // For 1-day conferences, use the start date
      conferenceEndDate = record.start_date;
    }
  }

  const result: StipendBreakdown = {
    conference: record.conference,
    location: destination,
    conference_start: record.start_date,
    conference_end: conferenceEndDate,
    flight_departure: formatDateToConferenceStyle(flightDates.outbound),
    flight_return: formatDateToConferenceStyle(flightDates.return),
    distance_km: distanceKm,
    flight_cost: parseFloat(flightCost.toFixed(2)),
    flight_price_source: flightPriceSource,
    lodging_cost: parseFloat(lodgingCost.toFixed(2)),
    basic_meals_cost: parseFloat(basicMealsCost.toFixed(2)),
    business_entertainment_cost: parseFloat(businessEntertainmentCost.toFixed(2)),
    local_transport_cost: parseFloat(localTransportCost.toFixed(2)),
    ticket_price: ticketPrice,
    internet_data_allowance: internetDataAllowance,
    incidentals_allowance: incidentalsAllowance,
    total_stipend: parseFloat(totalStipend.toFixed(2)),
    meals_cost: parseFloat(mealsCost.toFixed(2)),
  };

  stipendCache.set(cacheKey, result);
  return result;
}

// Parse command line arguments
function parseArgs(): { sortBy?: keyof StipendBreakdown; reverse: boolean } {
  const args = process.argv.slice(2);
  const options: { sortBy?: keyof StipendBreakdown; reverse: boolean } = {
    reverse: false,
  };

  const validColumns = new Set<keyof StipendBreakdown>([
    "conference",
    "location",
    "conference_start",
    "conference_end",
    "flight_departure",
    "flight_return",
    "flight_cost",
    "flight_price_source",
    "lodging_cost",
    "basic_meals_cost",
    "business_entertainment_cost",
    "local_transport_cost",
    "ticket_price",
    "internet_data_allowance",
    "incidentals_allowance",
    "total_stipend",
  ]);

  // Check for reverse flag
  options.reverse = args.includes("-r") || args.includes("--reverse");

  // Find the sort flag and its value
  const sortFlagIndex = args.findIndex((arg) => arg === "--sort" || arg === "-s");
  if (sortFlagIndex !== -1 && sortFlagIndex < args.length - 1) {
    const sortColumn = args[sortFlagIndex + 1] as keyof StipendBreakdown;

    // Check if the sort column is valid
    if (validColumns.has(sortColumn)) {
      options.sortBy = sortColumn;
    } else {
      console.warn(`Invalid sort column: ${sortColumn}. Valid columns are: ${Array.from(validColumns).join(", ")}`);
    }
  }

  return options;
}

async function main() {
  console.log("Starting travel stipend calculation...");

  // Parse command line arguments
  const options = parseArgs();

  // Get conference data from database
  console.log("Reading conferences from database...");
  const records = await DatabaseService.getInstance().getConferences();
  console.log(`Loaded ${records.length} conference records`);

  // Filter out past conferences
  const currentDate = new Date();
  const futureRecords = records.filter((record) => {
    try {
      // Parse dates with proper year handling
      const startDate = new Date(`${record.start_date} 2025`);
      const endDate = record.end_date ? new Date(`${record.end_date} 2025`) : startDate;

      // Check if conference is in the future (either start or end date is after current date)
      return startDate >= currentDate || endDate >= currentDate;
    } catch (e) {
      console.error(`Error parsing dates for conference ${record.conference}:`, e);
      return false;
    }
  });
  console.log(`Filtered to ${futureRecords.length} upcoming conferences`);

  const results: StipendBreakdown[] = [];

  for (const record of futureRecords) {
    try {
      const result = await calculateStipend(record);
      results.push(result);
    } catch (error) {
      console.error(`Error processing conference "${record.conference}":`, error);
    }
  }

  // Sort results if a sort column was specified
  if (options.sortBy) {
    const sortDirection = options.reverse ? "descending" : "ascending";
    console.log(`Sorting results by ${options.sortBy} (${sortDirection})`);

    const sortColumn = options.sortBy;
    results.sort((a, b) => {
      const valueA = a[sortColumn];
      const valueB = b[sortColumn];

      let comparison = 0;
      // Handle string vs number comparison
      if (typeof valueA === "string" && typeof valueB === "string") {
        comparison = valueA.localeCompare(valueB);
      } else {
        comparison = (valueA as number) - (valueB as number);
      }

      // Reverse the comparison if the reverse flag is set
      return options.reverse ? -comparison : comparison;
    });
  }

  // Save all caches to disk
  distanceCache.saveToDisk();
  coordinatesCache.saveToDisk();
  costOfLivingCache.saveToDisk();
  stipendCache.saveToDisk();

  // Create outputs directory if it doesn't exist
  const outputsDir = "outputs";
  if (!fs.existsSync(outputsDir)) {
    fs.mkdirSync(outputsDir);
  }

  // Generate filename with timestamp and sort info
  const timestamp = Math.floor(Date.now() / 1000);
  // Generate sort info for filename
  let sortInfo = "";
  if (options.sortBy) {
    const direction = options.reverse ? "_desc" : "_asc";
    sortInfo = `_sorted_by_${options.sortBy}${direction}`;
  }
  const outputFile = path.join(outputsDir, `stipends_${timestamp}${sortInfo}.csv`);

  // Convert results to CSV
  const header = [
    "conference",
    "location",
    "conference_start",
    "conference_end",
    "flight_departure",
    "flight_return",
    "flight_cost",
    "flight_price_source",
    "lodging_cost",
    "basic_meals_cost",
    "business_entertainment_cost",
    "local_transport_cost",
    "ticket_price",
    "internet_data_allowance",
    "incidentals_allowance",
    "total_stipend",
  ].join(",");

  const rows = results.map((r) =>
    [
      `"${r.conference}"`,
      `"${r.location}"`,
      `"${r.conference_start}"`,
      `"${r.conference_end || ""}"`,
      `"${r.flight_departure}"`,
      `"${r.flight_return}"`,
      r.flight_cost,
      `"${r.flight_price_source}"`,
      r.lodging_cost,
      r.basic_meals_cost,
      r.business_entertainment_cost,
      r.local_transport_cost,
      r.ticket_price,
      r.internet_data_allowance,
      r.incidentals_allowance,
      r.total_stipend,
    ].join(",")
  );

  // Write to CSV file
  fs.writeFileSync(outputFile, [header, ...rows].join("\n"));

  // Output results to console
  console.log("Calculation complete. Results saved to:", outputFile);
  console.table(
    results.map((r) => ({
      conference: r.conference,
      location: r.location,
      conference_start: r.conference_start,
      conference_end: r.conference_end,
      flight_departure: r.flight_departure,
      flight_return: r.flight_return,
      flight_cost: r.flight_cost,
      flight_price_source: r.flight_price_source,
      lodging_cost: r.lodging_cost,
      basic_meals_cost: r.basic_meals_cost,
      business_entertainment_cost: r.business_entertainment_cost,
      local_transport_cost: r.local_transport_cost,
      ticket_price: r.ticket_price,
      internet_data_allowance: r.internet_data_allowance,
      incidentals_allowance: r.incidentals_allowance,
      total_stipend: r.total_stipend,
    }))
  );
}

// Only run main if this file is being executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error("Execution error:", err);
  });
}
