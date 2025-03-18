import { parse } from "csv-parse/sync";
import fs from "fs";
import path from "path";
import { createHashKey, PersistentCache } from "./utils/cache";
import {
  BASE_LOCAL_TRANSPORT_PER_DAY,
  BASE_LODGING_PER_NIGHT,
  BASE_MEALS_PER_DAY,
  BUSINESS_ENTERTAINMENT_PER_DAY,
  COST_PER_KM,
  DEFAULT_TICKET_PRICE,
  ORIGIN,
  POST_CONFERENCE_DAYS,
  PRE_CONFERENCE_DAYS,
  WEEKEND_RATE_MULTIPLIER,
} from "./utils/constants";
import { loadCoordinatesData } from "./utils/coordinates";
import { getCostOfLivingFactor, loadCostOfLivingData } from "./utils/cost-of-living";
import { calculateDateDiff, generateFlightDates } from "./utils/dates";
import { getDistanceKmFromCities } from "./utils/distance";
import { lookupFlightPrice } from "./utils/flights";
import { calculateLocalTransportCost } from "./utils/taxi-fares";
import { Conference, Coordinates, StipendBreakdown } from "./utils/types";

// Initialize caches
const distanceCache = new PersistentCache<number>("fixtures/cache/distance-cache.json");
const coordinatesCache = new PersistentCache<Coordinates>("fixtures/cache/coordinates-cache.json");
const costOfLivingCache = new PersistentCache<number>("fixtures/cache/col-cache.json");
const stipendCache = new PersistentCache<StipendBreakdown>("fixtures/cache/stipend-cache.json");

// Load the city coordinates mapping
console.log("Loading city coordinates data...");
const cityCoordinates = loadCoordinatesData("fixtures/coordinates.csv");

// Load the cost-of-living mapping
console.log("Loading cost-of-living data...");
const costOfLivingMapping = loadCostOfLivingData("fixtures/cost_of_living.csv");

// Function to calculate stipend with caching
export async function calculateStipend(record: Conference): Promise<StipendBreakdown> {
  const cacheKey = createHashKey([
    record.Conference,
    record.Location,
    record.Start,
    record.End,
    ORIGIN,
    COST_PER_KM,
    BASE_LODGING_PER_NIGHT,
    BASE_MEALS_PER_DAY,
    record["Ticket Price"] ?? DEFAULT_TICKET_PRICE,
    "v3", // Increment version to force recalculation with new taxi-based transport costs
  ]);

  if (stipendCache.has(cacheKey)) {
    const cachedResult = stipendCache.get(cacheKey);
    if (cachedResult) {
      console.log(`Using cached result for conference: ${record.Conference}`);
      return cachedResult;
    }
  }

  const destination = record["Location"];
  const isPriority = record["❗️"] === "TRUE";

  console.log(`Processing conference: ${record["Conference"]} in ${destination} (Priority: ${isPriority})`);

  // Calculate distance (in km) using the haversine formula with our city coordinates
  const distanceKm = getDistanceKmFromCities(ORIGIN, destination, cityCoordinates);
  console.log(`Distance from ${ORIGIN} to ${destination}: ${distanceKm.toFixed(1)} km`);

  // Try to get flight cost from API first
  const flightDates = generateFlightDates(record);
  const apiFlightPrice = await lookupFlightPrice(destination, flightDates);

  // If API lookup fails, fallback to distance-based calculation
  const flightCost = apiFlightPrice ?? distanceKm * COST_PER_KM;
  console.log(`Flight cost for ${destination}: ${flightCost} (${apiFlightPrice ? "from API" : "calculated from distance"})`);

  // Log the lookup time if we got a flight price from the API
  if (apiFlightPrice !== null) {
    console.log(`Last flight lookup time: ${new Date().toLocaleString()}`);
  }

  // Get cost-of-living multiplier for the destination
  const colFactor = getCostOfLivingFactor(destination, costOfLivingMapping);

  // Calculate conference and travel days
  const conferenceDays = calculateDateDiff(record["Start"], record["End"]) + 1; // +1 because end date is inclusive
  const totalDays = conferenceDays + PRE_CONFERENCE_DAYS + POST_CONFERENCE_DAYS;
  const numberOfNights = totalDays - 1; // One less night than days

  console.log(`Conference duration: ${conferenceDays} days, Total stay: ${totalDays} days (${numberOfNights} nights)`);

  // Calculate weekend vs weekday nights for lodging
  const startDate = new Date(record["Start"]);
  let weekendNights = 0;
  for (let i = 0; i < numberOfNights; i++) {
    const currentDate = new Date(startDate);
    currentDate.setDate(startDate.getDate() - PRE_CONFERENCE_DAYS + i);
    const dayOfWeek = currentDate.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      // Sunday = 0, Saturday = 6
      weekendNights++;
    }
  }
  const weekdayNights = numberOfNights - weekendNights;

  // Adjust lodging rates with cost of living factor and weekend discounts
  const baseWeekdayRate = BASE_LODGING_PER_NIGHT * colFactor;
  const baseWeekendRate = baseWeekdayRate * WEEKEND_RATE_MULTIPLIER;

  // Calculate costs (no lodging cost if conference is in origin city)
  const lodgingCost = ORIGIN === destination ? 0 : weekdayNights * baseWeekdayRate + weekendNights * baseWeekendRate;

  const basicMealsCost = BASE_MEALS_PER_DAY * colFactor * totalDays;
  const businessEntertainmentCost = BUSINESS_ENTERTAINMENT_PER_DAY * conferenceDays;
  const mealsCost = basicMealsCost + businessEntertainmentCost;

  // Calculate local transport cost using taxi data
  const localTransportCost = calculateLocalTransportCost(destination, totalDays, colFactor, BASE_LOCAL_TRANSPORT_PER_DAY);

  // Use ticket price from CSV if available, otherwise use default
  const ticketPrice = record["Ticket Price"] ? parseFloat(record["Ticket Price"].replace("$", "")) : DEFAULT_TICKET_PRICE;

  // Total stipend is the sum of all expenses
  const totalStipend = flightCost + lodgingCost + mealsCost + localTransportCost + ticketPrice;

  // Format date to match conference date format (DD Month)
  function formatDateToConferenceStyle(dateStr: string) {
    const date = new Date(dateStr);
    return date.getDate() + " " + date.toLocaleString("en-US", { month: "long" });
  }

  const result = {
    conference: record["Conference"],
    location: destination,
    conference_start: record["Start"],
    conference_end: record["End"],
    flight_departure: formatDateToConferenceStyle(flightDates.outbound),
    flight_return: formatDateToConferenceStyle(flightDates.return),
    distance_km: distanceKm,
    flight_cost: parseFloat(flightCost.toFixed(2)),
    lodging_cost: parseFloat(lodgingCost.toFixed(2)),
    basic_meals_cost: parseFloat(basicMealsCost.toFixed(2)),
    business_entertainment_cost: parseFloat(businessEntertainmentCost.toFixed(2)),
    local_transport_cost: parseFloat(localTransportCost.toFixed(2)),
    ticket_price: ticketPrice,
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

  const validColumns: (keyof StipendBreakdown)[] = [
    "conference",
    "location",
    "conference_start",
    "conference_end",
    "flight_departure",
    "flight_return",
    "flight_cost",
    "lodging_cost",
    "basic_meals_cost",
    "business_entertainment_cost",
    "local_transport_cost",
    "ticket_price",
    "total_stipend",
  ];

  // Check for reverse flag
  options.reverse = args.includes("-r") || args.includes("--reverse");

  // Find the sort flag and its value
  const sortFlagIndex = args.findIndex((arg) => arg === "--sort" || arg === "-s");
  if (sortFlagIndex !== -1 && sortFlagIndex < args.length - 1) {
    const sortColumn = args[sortFlagIndex + 1];

    // Check if the sort column is valid
    if (validColumns.includes(sortColumn as keyof StipendBreakdown)) {
      options.sortBy = sortColumn as keyof StipendBreakdown;
    } else {
      console.warn(`Invalid sort column: ${sortColumn}. Valid columns are: ${validColumns.join(", ")}`);
    }
  }

  return options;
}

async function main() {
  console.log("Starting travel stipend calculation...");

  // Parse command line arguments
  const options = parseArgs();

  // Read conference data from CSV file
  console.log("Reading fixtures/conferences.csv...");
  const fileContent = fs.readFileSync("fixtures/conferences.csv", "utf-8");
  const records: Conference[] = parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
  });
  console.log(`Loaded ${records.length} conference records`);

  // Filter out past conferences
  const currentDate = new Date();
  const futureRecords = records.filter((record) => {
    const endDate = record.End ? new Date(`${record.End} 2025`) : new Date(`${record.Start} 2025`);
    return endDate >= currentDate;
  });
  console.log(`Filtered to ${futureRecords.length} upcoming conferences`);

  const results: StipendBreakdown[] = [];

  for (const record of futureRecords) {
    try {
      const result = await calculateStipend(record);
      results.push(result);
    } catch (error) {
      console.error(`Error processing conference "${record["Conference"]}":`, error);
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
    "lodging_cost",
    "basic_meals_cost",
    "business_entertainment_cost",
    "local_transport_cost",
    "ticket_price",
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
      r.lodging_cost,
      r.basic_meals_cost,
      r.business_entertainment_cost,
      r.local_transport_cost,
      r.ticket_price,
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
      lodging_cost: r.lodging_cost,
      basic_meals_cost: r.basic_meals_cost,
      business_entertainment_cost: r.business_entertainment_cost,
      local_transport_cost: r.local_transport_cost,
      ticket_price: r.ticket_price,
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
