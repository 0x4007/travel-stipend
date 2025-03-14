import { parse } from "csv-parse/sync";
import fs from "fs";
import { createHashKey, PersistentCache } from "./utils/cache";
import { BASE_LODGING_PER_NIGHT, BASE_MEALS_PER_DAY, COST_PER_KM, DEFAULT_TICKET_PRICE, ORIGIN } from "./utils/constants";
import { loadCoordinatesData } from "./utils/coordinates";
import { getCostOfLivingFactor, loadCostOfLivingData } from "./utils/cost-of-living";
import { calculateDateDiff, generateFlightDates } from "./utils/dates";
import { getDistanceKmFromCities } from "./utils/distance";
import { lookupFlightPrice } from "./utils/flights";
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
async function calculateStipend(record: Conference): Promise<StipendBreakdown> {
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

  // Get cost-of-living multiplier for the destination
  const colFactor = getCostOfLivingFactor(destination, costOfLivingMapping);

  // Adjust lodging and meal base rates
  const adjustedLodgingRate = BASE_LODGING_PER_NIGHT * colFactor;
  const adjustedMealsRate = BASE_MEALS_PER_DAY * colFactor;

  // Calculate number of nights and meal days
  const numberOfNights = calculateDateDiff(record["Start"], record["End"]);
  const numberOfMealDays = numberOfNights + 1; // meals provided each day

  console.log(`Conference duration: ${numberOfNights} nights, ${numberOfMealDays} meal days`);

  // If the origin city is the same as the destination, no lodging is needed
  const lodgingCost = ORIGIN === destination ? 0 : adjustedLodgingRate * numberOfNights;
  const mealsCost = adjustedMealsRate * numberOfMealDays;

  // Use ticket price from CSV if available, otherwise use default
  const ticketPrice = record["Ticket Price"] ? parseFloat(record["Ticket Price"].replace("$", "")) : DEFAULT_TICKET_PRICE;

  // Total stipend is the sum of all expenses
  const totalStipend = flightCost + lodgingCost + mealsCost + ticketPrice;

  const result = {
    conference: record["Conference"],
    location: destination,
    distance_km: parseFloat(distanceKm.toFixed(1)),
    flight_cost: parseFloat(flightCost.toFixed(2)),
    lodging_cost: parseFloat(lodgingCost.toFixed(2)),
    meals_cost: parseFloat(mealsCost.toFixed(2)),
    ticket_price: ticketPrice,
    total_stipend: parseFloat(totalStipend.toFixed(2)),
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
    "distance_km",
    "flight_cost",
    "lodging_cost",
    "meals_cost",
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

  // Output final results as structured JSON
  const output = JSON.stringify({ results }, null, 2);
  console.log("Calculation complete. Results:");
  const parsedOutput = JSON.parse(output);
  console.table(parsedOutput.results);
}

// Run main
main().catch((err) => {
  console.error("Execution error:", err);
});
