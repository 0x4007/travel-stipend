// travelStipendCalculator.ts

import { parse } from "csv-parse/sync";
import fs from "fs";

// --- Configuration Constants ---

// Fixed origin for travel (for example, your home base)
const ORIGIN = "Seoul, Korea";

// Cost-per-kilometer rate (USD per km)
const COST_PER_KM = 0.2; // round trip

// Base rates for lodging (per night) and meals (per day) at baseline cost-of-living
const BASE_LODGING_PER_NIGHT = 150; // USD
const BASE_MEALS_PER_DAY = 50; // USD

// Default ticket price when not provided
const DEFAULT_TICKET_PRICE = 1000; // USD

// --- City Coordinates Mapping ---
// A mapping of city names to their latitude/longitude coordinates.
interface Coordinates {
  lat: number;
  lng: number;
}

const cityCoordinates: { [city: string]: Coordinates } = {
  "Seoul, Korea": { lat: 37.5665, lng: 126.978 },
  "Hong Kong": { lat: 22.3193, lng: 114.1694 },
  "Denver, USA": { lat: 39.7392, lng: -104.9903 },
  "Milan, Italy": { lat: 45.4642, lng: 9.19 },
  "Barcelona, Spain": { lat: 41.3851, lng: 2.1734 },
  "Las Vegas, USA": { lat: 36.1699, lng: -115.1398 },
  "San Francisco, USA": { lat: 37.7749, lng: -122.4194 },
  "Grapevine, TX, USA": { lat: 32.9343, lng: -97.0781 },
  "San Jose, USA": { lat: 37.3382, lng: -121.8863 },
  "Chicago, USA": { lat: 41.8781, lng: -87.6298 },
  "London, UK": { lat: 51.5074, lng: -0.1278 },
  "Bangkok, Thailand": { lat: 13.7563, lng: 100.5018 },
  "Berlin, Germany": { lat: 52.52, lng: 13.405 },
  "Taipei, Taiwan": { lat: 25.033, lng: 121.5654 },
  "Paris, France": { lat: 48.8566, lng: 2.3522 },
  "Ho Chi Minh, Vietnam": { lat: 10.8231, lng: 106.6297 },
  "Montreal, Canada": { lat: 45.5017, lng: -73.5673 },
  "Tokyo, Japan": { lat: 35.6895, lng: 139.6917 },
  Singapore: { lat: 1.3521, lng: 103.8198 },
  "Dubai, UAE": { lat: 25.2048, lng: 55.2708 },
  "Amsterdam, Netherlands": { lat: 52.3676, lng: 4.9041 },
  "Amstardam, Netherlands": { lat: 52.3676, lng: 4.9041 }, // Typo in conferences.csv
  "Lisbon, Portugal": { lat: 38.7223, lng: -9.1393 },
  "Abu Dhabi, UAE": { lat: 24.4539, lng: 54.3773 },
  "Prague, Czech Republic": { lat: 50.0755, lng: 14.4378 },
  "Seattle, USA": { lat: 47.6062, lng: -122.3321 },
  "New York, USA": { lat: 40.7128, lng: -74.006 },
  "Geneva, Switzerland": { lat: 46.2044, lng: 6.1432 },
  "Boston, USA": { lat: 42.3601, lng: -71.0589 },
  "Munich, Germany": { lat: 48.1351, lng: 11.582 },
  "Arlington, USA": { lat: 32.7357, lng: -97.1081 },
  "Vilnius, Lithuania": { lat: 54.6872, lng: 25.2797 },
  "Cannes, France": { lat: 43.5528, lng: 7.0174 },
  "Kyoto, Japan": { lat: 35.0116, lng: 135.7681 },
  "Helsinki, Finland": { lat: 60.1699, lng: 24.9384 },
  // Additional cities from conferences.csv
  "Turin, Italy": { lat: 45.0703, lng: 7.6869 },
  "Austin, USA": { lat: 30.2672, lng: -97.7431 },
  "Toronto, Canada": { lat: 43.6532, lng: -79.3832 },
  "San Diego, USA": { lat: 32.7157, lng: -117.1611 },
  "Jakarta, Indonesia": { lat: -6.2088, lng: 106.8456 },
  "Zurich, Switzerland": { lat: 47.3769, lng: 8.5417 },
  "Brooklyn, USA": { lat: 40.6782, lng: -73.9442 },
  "Florence, Italy": { lat: 43.7696, lng: 11.2558 },
};

// --- Haversine Formula Implementation ---

function deg2rad(deg: number): number {
  return deg * (Math.PI / 180);
}

function haversineDistance(coord1: Coordinates, coord2: Coordinates): number {
  const R = 6371; // Earth's radius in km
  const dLat = deg2rad(coord2.lat - coord1.lat);
  const dLon = deg2rad(coord2.lng - coord1.lng);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(deg2rad(coord1.lat)) * Math.cos(deg2rad(coord2.lat)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function getDistanceKmFromCities(originCity: string, destinationCity: string): number {
  const originCoords = cityCoordinates[originCity];
  const destinationCoords = cityCoordinates[destinationCity];
  if (!originCoords) {
    throw new Error(`Coordinates not found for origin: ${originCity}`);
  }
  if (!destinationCoords) {
    throw new Error(`Coordinates not found for destination: ${destinationCity}`);
  }
  return haversineDistance(originCoords, destinationCoords);
}

// --- Load Open Source Cost-of-Living Data ---
// Assume a CSV file "cost_of_living.csv" exists with columns: "Location", "Index"
interface CostOfLivingRecord {
  Location: string;
  Index: string;
}

function loadCostOfLivingData(filePath: string): { [location: string]: number } {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const records: CostOfLivingRecord[] = parse(content, {
      columns: true,
      skip_empty_lines: true,
    });
    const mapping: { [location: string]: number } = {};
    for (const rec of records) {
      mapping[rec.Location.trim()] = parseFloat(rec.Index);
    }
    return mapping;
  } catch (error) {
    console.error(`Could not load ${filePath}, using default mapping.`, error);
    return {};
  }
}

// Load the cost-of-living mapping.
console.log("Loading cost-of-living data...");
const costOfLivingMapping = loadCostOfLivingData("fixtures/cost_of_living.csv");
console.log(`Loaded ${Object.keys(costOfLivingMapping).length} cost-of-living entries`);

// Retrieve cost-of-living factor from the loaded mapping (defaulting to 1.0 if not found).
function getCostOfLivingFactor(location: string): number {
  // Try exact match first
  if (costOfLivingMapping[location.trim()]) {
    const factor = costOfLivingMapping[location.trim()];
    console.log(`Cost of living factor for ${location}: ${factor} (exact match)`);
    return factor;
  }

  // Try with comma
  const withComma = location.replace(/ ([A-Z]+)$/, ", $1");
  if (costOfLivingMapping[withComma]) {
    const factor = costOfLivingMapping[withComma];
    console.log(`Cost of living factor for ${location}: ${factor} (matched as ${withComma})`);
    return factor;
  }

  // Try without comma
  const withoutComma = location.replace(/, ([A-Z]+)$/, " $1");
  if (costOfLivingMapping[withoutComma]) {
    const factor = costOfLivingMapping[withoutComma];
    console.log(`Cost of living factor for ${location}: ${factor} (matched as ${withoutComma})`);
    return factor;
  }

  console.log(`No cost of living factor found for ${location}, using default 1.0`);
  return 1.0;
}

// --- Helper Functions for Date Handling ---

// Parse date strings like "18 February" to a Date object
function parseDate(dateStr: string, year = 2025): Date | null {
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
function calculateDateDiff(startDateStr: string, endDateStr: string, defaultDays = 3): number {
  const start = parseDate(startDateStr);

  // If end date is empty, assume the conference is defaultDays days long
  if (!endDateStr || endDateStr.trim() === "") {
    if (start) {
      const end = new Date(start);
      end.setDate(end.getDate() + defaultDays - 1); // -1 because the start day counts as day 1
      return defaultDays - 1; // Return nights (days - 1)
    }
    return defaultDays - 1; // Default to defaultDays - 1 nights
  }

  const end = parseDate(endDateStr);

  if (!start || !end) {
    console.warn(`Could not parse dates: ${startDateStr} - ${endDateStr}, using default of ${defaultDays} days`);
    return defaultDays - 1; // Default to defaultDays - 1 nights
  }

  const msPerDay = 24 * 60 * 60 * 1000;
  const diffInMs = end.getTime() - start.getTime();
  const diffInDays = Math.round(diffInMs / msPerDay) + 1; // +1 because both start and end days are inclusive

  return diffInDays - 1; // Convert days to nights
}

// --- Type Definitions ---

interface RealConferenceRecord {
  "❗️": string; // TRUE/FALSE flag
  "❓": string; // TRUE/FALSE flag
  Category: string;
  Start: string; // Format: "18 February"
  End: string; // Format: "20 February" (may be empty)
  Conference: string;
  Location: string; // E.g., "London, UK" or "Hong Kong"
  Description: string;
}

interface StipendBreakdown {
  conference: string;
  location: string;
  distance_km: number;
  flight_cost: number;
  lodging_cost: number;
  meals_cost: number;
  ticket_price: number;
  total_stipend: number;
}

// --- Main Function ---

async function main() {
  console.log("Starting travel stipend calculation...");

  // Read conference data from CSV file.
  console.log("Reading fixtures/conferences.csv...");
  const fileContent = fs.readFileSync("fixtures/conferences.csv", "utf-8");
  const records: RealConferenceRecord[] = parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
  });
  console.log(`Loaded ${records.length} conference records`);

  const results: StipendBreakdown[] = [];

  for (const record of records) {
    try {
      const destination = record["Location"];
      const isPriority = record["❗️"] === "TRUE";

      console.log(`Processing conference: ${record["Conference"]} in ${destination} (Priority: ${isPriority})`);

      // Calculate distance (in km) using the haversine formula with our city coordinates.
      const distanceKm = getDistanceKmFromCities(ORIGIN, destination);
      console.log(`Distance from ${ORIGIN} to ${destination}: ${distanceKm.toFixed(1)} km`);

      // Estimate flight cost.
      const flightCost = distanceKm * COST_PER_KM;

      // Get cost-of-living multiplier for the destination.
      const colFactor = getCostOfLivingFactor(destination);

      // Adjust lodging and meal base rates.
      const adjustedLodgingRate = BASE_LODGING_PER_NIGHT * colFactor;
      const adjustedMealsRate = BASE_MEALS_PER_DAY * colFactor;

      // Calculate number of nights and meal days.
      const numberOfNights = calculateDateDiff(record["Start"], record["End"]);
      const numberOfMealDays = numberOfNights + 1; // meals provided each day.

      console.log(`Conference duration: ${numberOfNights} nights, ${numberOfMealDays} meal days`);

      const lodgingCost = adjustedLodgingRate * numberOfNights;
      const mealsCost = adjustedMealsRate * numberOfMealDays;

      // Use default ticket price since it's not in the CSV
      const ticketPrice = DEFAULT_TICKET_PRICE;

      // Total stipend is the sum of all expenses.
      const totalStipend = flightCost + lodgingCost + mealsCost + ticketPrice;

      results.push({
        conference: record["Conference"],
        location: destination,
        distance_km: parseFloat(distanceKm.toFixed(1)),
        flight_cost: parseFloat(flightCost.toFixed(2)),
        lodging_cost: parseFloat(lodgingCost.toFixed(2)),
        meals_cost: parseFloat(mealsCost.toFixed(2)),
        ticket_price: ticketPrice,
        total_stipend: parseFloat(totalStipend.toFixed(2)),
      });
    } catch (error) {
      console.error(`Error processing conference "${record["Conference"]}":`, error);
    }
  }

  // Output final results as structured JSON.
  const output = JSON.stringify({ results }, null, 2);
  console.log("Calculation complete. Results:");
  const parsedOutput = JSON.parse(output);
  console.table(parsedOutput.results);
}

// Run main.
main().catch((err) => {
  console.error("Execution error:", err);
});
