import { parse } from "csv-parse/sync";
import fs from "fs";
import path from "path";
import { createHashKey, PersistentCache } from "./utils/cache";
import { BASE_LODGING_PER_NIGHT, BASE_MEALS_PER_DAY, COST_PER_KM, ORIGIN } from "./utils/constants";
import { loadCoordinatesData } from "./utils/coordinates";
import { getCostOfLivingFactor, loadCostOfLivingData } from "./utils/cost-of-living";
import { calculateDateDiff, generateFlightDates } from "./utils/dates";
import { getDistanceKmFromCities } from "./utils/distance";
import { lookupFlightPrice } from "./utils/flights";
import { Coordinates, StipendBreakdown } from "./utils/types";

// Historical conference format
interface HistoricalConference {
  "Event Name": string;
  Dates: string;
  "Ticket Price (USD)": string;
}

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

// Helper function to extract location from event name
function extractLocation(eventName: string): string {
  // First try to extract location after hyphen
  const hyphenRegex = /- ([^,]+)$/;
  const hyphenMatch = hyphenRegex.exec(eventName);
  if (hyphenMatch) {
    return hyphenMatch[1].trim();
  }

  // Then try to extract known city names from anywhere in the event name
  const knownCities = {
    Singapore: "Singapore",
    Bangkok: "Bangkok",
    Seoul: "Seoul",
    Taipei: "Taipei",
    "Hong Kong": "Hong Kong",
    "San Francisco": "San Francisco",
  };

  for (const [cityName, normalizedName] of Object.entries(knownCities)) {
    if (eventName.includes(cityName)) {
      return normalizedName;
    }
  }

  return "";
}

// Helper function to parse dates from the format "Month D–D, YYYY"
function parseDates(dateString: string): { start: string; end: string } {
  // Handle various date formats
  const [datePart] = dateString.split(", ");

  // Split the date part by the dash (either normal or en dash)
  const [startPart, endPart] = datePart.split(/[–-]/);

  const startMonth = startPart.trim().split(" ")[0];
  const startDay = startPart.trim().split(" ")[1] || "1";

  let endMonth, endDay;
  if (endPart) {
    endMonth = endPart.includes(" ") ? endPart.trim().split(" ")[0] : startMonth;
    endDay = endPart.includes(" ") ? endPart.trim().split(" ")[1] : endPart.trim();
  } else {
    endMonth = startMonth;
    endDay = startDay;
  }

  return {
    start: `${startDay} ${startMonth}`,
    end: `${endDay} ${endMonth}`,
  };
}

// Function to calculate stipend with caching
async function calculateStipend(record: HistoricalConference): Promise<StipendBreakdown> {
  const destination = extractLocation(record["Event Name"]);
  const dates = parseDates(record["Dates"]);

  const cacheKey = createHashKey([
    record["Event Name"],
    destination,
    dates.start,
    dates.end,
    ORIGIN,
    COST_PER_KM,
    BASE_LODGING_PER_NIGHT,
    BASE_MEALS_PER_DAY,
    record["Ticket Price (USD)"],
    "historical_v2", // Increment version to invalidate cache
  ]);

  if (stipendCache.has(cacheKey)) {
    const cachedResult = stipendCache.get(cacheKey);
    if (cachedResult) {
      console.log(`Using cached result for conference: ${record["Event Name"]}`);
      return cachedResult;
    }
  }

  console.log(`Processing conference: ${record["Event Name"]} in ${destination}`);

  // Calculate distance (in km) using the haversine formula with our city coordinates
  const distanceKm = getDistanceKmFromCities(ORIGIN, destination, cityCoordinates);
  console.log(`Distance from ${ORIGIN} to ${destination}: ${distanceKm.toFixed(1)} km`);

  // Try to get flight cost from API first
  const flightDates = generateFlightDates({
    Conference: record["Event Name"],
    Location: destination,
    Category: "Historical",
    Start: dates.start,
    End: dates.end,
    "Ticket Price": record["Ticket Price (USD)"],
  });
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
  const numberOfNights = calculateDateDiff(dates.start, dates.end);
  const numberOfMealDays = numberOfNights + 1; // meals provided each day

  console.log(`Conference duration: ${numberOfNights} nights, ${numberOfMealDays} meal days`);

  // If the origin city is the same as the destination, no lodging is needed
  // Handle both exact match and partial match for Seoul
  const isOriginCity = ORIGIN === destination || (destination === "Seoul" && ORIGIN.toLowerCase().includes("seoul"));
  const lodgingCost = isOriginCity ? 0 : adjustedLodgingRate * numberOfNights;
  const mealsCost = adjustedMealsRate * numberOfMealDays;

  // Parse ticket price, defaulting to 0 if not provided
  const ticketPrice = record["Ticket Price (USD)"] ? parseFloat(record["Ticket Price (USD)"]) : 0;

  // Total stipend is the sum of all expenses
  const totalStipend = flightCost + lodgingCost + mealsCost + ticketPrice;

  const result: StipendBreakdown = {
    conference: record["Event Name"],
    location: destination,
    conference_start: dates.start,
    conference_end: dates.end,
    flight_departure: flightDates.outbound,
    flight_return: flightDates.return,
    flight_cost: parseFloat(flightCost.toFixed(2)),
    lodging_cost: parseFloat(lodgingCost.toFixed(2)),
    basic_meals_cost: parseFloat(mealsCost.toFixed(2)),
    business_entertainment_cost: 0, // Not applicable for historical conferences
    local_transport_cost: 0, // Not applicable for historical conferences
    ticket_price: ticketPrice,
    total_stipend: parseFloat(totalStipend.toFixed(2)),
  };

  stipendCache.set(cacheKey, result);
  return result;
}

async function main() {
  console.log("Starting historical travel stipend calculation...");

  // Create a temporary CSV file from the provided data
  const historicalData = `Event Name,Dates,Ticket Price (USD)
"Asia Blockchain Summit 2024 - Taipei","August 6–8, 2024",0
"Korea Blockchain Week 2024 - Seoul","September 1–7, 2024",0
"TOKEN2049 Singapore 2024","September 18–19, 2024",599
"GitHub Universe 2024 - San Francisco","October 29–30, 2024",1300
"Devcon 7 - Bangkok","November 12–15, 2024",284.76
"Consensus Hong Kong 2025","February 18–20, 2025",500`;

  const tempCsvPath = path.join("fixtures", "historical-conferences.csv");
  fs.writeFileSync(tempCsvPath, historicalData);

  // Read conference data from temporary CSV file
  console.log("Reading historical conference data...");
  const fileContent = fs.readFileSync(tempCsvPath, "utf-8");
  const records: HistoricalConference[] = parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
  });
  console.log(`Loaded ${records.length} conference records`);

  const results: StipendBreakdown[] = [];

  for (const record of records) {
    try {
      const result = await calculateStipend(record);
      results.push(result);
    } catch (error) {
      console.error(`Error processing conference "${record["Event Name"]}":`, error);
    }
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

  // Generate filename with timestamp
  const timestamp = Math.floor(Date.now() / 1000);
  const outputFile = path.join(outputsDir, `historical_stipends_${timestamp}.csv`);

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
      `"${r.conference_end}"`,
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

  // Clean up temporary CSV
  fs.unlinkSync(tempCsvPath);

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
