import { parse } from "csv-parse/sync";
import { readFileSync } from "fs";
import { getJson } from "serpapi";

interface FlightResults {
  best_flights: {
    price?: number;
  }[];
}

// Configuration Constants (matching main script)
const ORIGIN = "Seoul, Korea";
const COST_PER_KM = 0.2;
const BASE_LODGING_PER_NIGHT = 150;
const BASE_MEALS_PER_DAY = 50;
const DEFAULT_TICKET_PRICE = 1000;

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

interface Coordinates {
  lat: number;
  lng: number;
}

// Distance calculation functions
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

// Fuzzy matching functions
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  // Initialize the matrix
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  // Fill the matrix
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      const cost = a[j - 1] === b[i - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1, // deletion
        matrix[i][j - 1] + 1, // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return matrix[b.length][a.length];
}

function calculateSimilarity(a: string, b: string): number {
  // Normalize strings for comparison
  const normalizedA = a.toLowerCase().trim();
  const normalizedB = b.toLowerCase().trim();

  // Calculate Levenshtein distance
  const distance = levenshteinDistance(normalizedA, normalizedB);

  // Calculate similarity as a percentage (0-1)
  // The max possible distance is the length of the longer string
  const maxLength = Math.max(normalizedA.length, normalizedB.length);
  if (maxLength === 0) return 1.0; // Both strings are empty

  return 1 - distance / maxLength;
}

function findBestMatch(query: string, candidates: string[]): { match: string; similarity: number } {
  let bestMatch = "";
  let bestSimilarity = 0;

  for (const candidate of candidates) {
    const similarity = calculateSimilarity(query, candidate);
    if (similarity > bestSimilarity) {
      bestSimilarity = similarity;
      bestMatch = candidate;
    }
  }

  return { match: bestMatch, similarity: bestSimilarity };
}

class CoordinatesMapping {
  private _cityMap: { [city: string]: Coordinates } = {};
  private _cityNames: string[] = [];
  private _cityVariants: { [normalizedName: string]: string } = {};

  addCity(cityName: string, coordinates: Coordinates): void {
    this._cityMap[cityName] = coordinates;
    this._cityNames.push(cityName);
  }

  addCityVariant(normalizedName: string, originalName: string): void {
    this._cityVariants[normalizedName] = originalName;
  }

  getCoordinates(cityName: string): Coordinates | undefined {
    return this._cityMap[cityName];
  }

  getCityNames(): string[] {
    return this._cityNames;
  }

  getCityVariant(normalizedName: string): string | undefined {
    return this._cityVariants[normalizedName];
  }

  size(): number {
    return this._cityNames.length;
  }
}

function loadCoordinatesData(filePath: string): CoordinatesMapping {
  try {
    const content = readFileSync(filePath, "utf-8");
    const records = parse(content, {
      columns: true,
      skip_empty_lines: true,
    });

    const mapping = new CoordinatesMapping();

    for (const rec of records) {
      // Create standard city format: "City, Country"
      const cityName = `${rec.city}, ${rec.country}`;
      const coords = {
        lat: parseFloat(rec.lat),
        lng: parseFloat(rec.lng),
      };

      // Add entry with full country name
      mapping.addCity(cityName, coords);
      mapping.addCityVariant(cityName.toLowerCase(), cityName);

      // Also add entry with ISO code for countries commonly referenced with abbreviations
      if (rec.iso2 && ["US", "UK", "UAE"].includes(rec.iso2)) {
        const cityWithCode = `${rec.city}, ${rec.iso2}${rec.iso2 === "US" ? "A" : ""}`;
        mapping.addCity(cityWithCode, coords);
        mapping.addCityVariant(cityWithCode.toLowerCase(), cityWithCode);
      }

      // Add entry without country for unique city names
      mapping.addCity(rec.city, coords);
      mapping.addCityVariant(rec.city.toLowerCase(), rec.city);
    }

    console.log(`Loaded ${mapping.size()} coordinate entries`);
    return mapping;
  } catch (error) {
    console.error(`Could not load ${filePath}, using default mapping.`, error);
    const defaultMapping = new CoordinatesMapping();
    defaultMapping.addCity("Seoul, Korea", { lat: 37.5665, lng: 126.978 });
    defaultMapping.addCityVariant("seoul, korea", "Seoul, Korea");
    return defaultMapping;
  }
}

// Load the city coordinates mapping
console.log("Loading city coordinates data...");
const cityCoordinates = loadCoordinatesData("fixtures/coordinates.csv");

function findCityCoordinates(cityName: string): Coordinates {
  // Try exact match first
  const exactMatch = cityCoordinates.getCoordinates(cityName);
  if (exactMatch) {
    return exactMatch;
  }

  // Try lowercase match with variants
  const normalizedName = cityName.toLowerCase().trim();
  const variantMatch = cityCoordinates.getCityVariant(normalizedName);
  if (variantMatch) {
    const variantCoords = cityCoordinates.getCoordinates(variantMatch);
    if (variantCoords) {
      return variantCoords;
    }
  }

  // If no match found, try fuzzy matching
  const SIMILARITY_THRESHOLD = 0.6; // Minimum similarity score to consider a match
  const cityNames = cityCoordinates.getCityNames();
  const { match, similarity } = findBestMatch(cityName, cityNames);

  if (similarity >= SIMILARITY_THRESHOLD) {
    console.log(`Fuzzy match found for "${cityName}": "${match}" (similarity: ${(similarity * 100).toFixed(1)}%)`);
    const fuzzyMatchCoords = cityCoordinates.getCoordinates(match);
    if (fuzzyMatchCoords) {
      return fuzzyMatchCoords;
    }
  }

  throw new Error(`No matching city found for: ${cityName} (best match: ${match}, similarity: ${(similarity * 100).toFixed(1)}%)`);
}

function getDistanceKm(originCity: string, destinationCity: string): number {
  const originCoords = findCityCoordinates(originCity);
  const destinationCoords = findCityCoordinates(destinationCity);
  return haversineDistance(originCoords, destinationCoords);
}

function calculateDateDiff(startDateStr: string, endDateStr: string, defaultDays = 3): number {
  const start = parseDate(startDateStr);
  const end = endDateStr ? parseDate(endDateStr) : null;

  if (!end) {
    return defaultDays - 1; // Default to defaultDays - 1 nights
  }

  const msPerDay = 24 * 60 * 60 * 1000;
  const diffInMs = end.getTime() - start.getTime();
  const diffInDays = Math.round(diffInMs / msPerDay) + 1; // +1 because both start and end days are inclusive

  return diffInDays - 1; // Convert days to nights
}

function getCostOfLivingFactor(location: string): number {
  try {
    const csvContent = readFileSync("fixtures/cost_of_living.csv", "utf-8");
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
    });

    interface CostOfLivingRecord {
      Location: string;
      Index: string;
    }

    const record = records.find((r: CostOfLivingRecord) => r.Location === location);
    return record ? parseFloat(record.Index) : 1.0;
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.warn(`Could not load cost of living data for ${location}: ${error.message}`);
    } else {
      console.warn(`Could not load cost of living data for ${location}`);
    }
    return 1.0;
  }
}

interface Conference {
  Category: string;
  Start: string;
  End: string;
  Conference: string;
  Location: string;
}

interface AirportCode {
  type: string;
  name: string;
  municipality: string;
  iata_code: string;
}

function parseDate(dateStr: string): Date {
  // Convert date format like "18 February" to full date with year 2025
  return new Date(`${dateStr} 2025`);
}

function findUpcomingConferences(limit: number = 3): Conference[] {
  const csvContent = readFileSync("fixtures/conferences.csv", "utf-8");
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
  });

  const currentDate = new Date();

  // Find conferences that haven't happened yet
  const upcomingConferences = records
    .filter((conf: Conference) => {
      const startDate = parseDate(conf.Start);
      return startDate > currentDate;
    })
    .slice(0, limit); // Take only the first 'limit' conferences

  if (upcomingConferences.length === 0) {
    throw new Error("No upcoming conferences found");
  }

  return upcomingConferences;
}

function generateFlightDates(conference: Conference): { outbound: string; return: string } {
  const startDate = parseDate(conference.Start);
  const endDate = conference.End ? parseDate(conference.End) : new Date(startDate);

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

function extractAirportCode(location: string): string {
  // Read and parse the airport codes CSV
  const csvContent = readFileSync("fixtures/airport-codes.csv", "utf-8");
  const airports = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
  }) as AirportCode[];

  // Extract city name from location (e.g., "New York, USA" -> "New York")
  const city = location.split(",")[0].trim();

  // First try to find an exact match for the municipality
  let airport = airports.find((a) => a.municipality === city && a.type === "large_airport");

  // If no exact match, try a case-insensitive partial match
  if (!airport) {
    airport = airports.find((a) => {
      const municipality = a.municipality || "";
      return municipality.toLowerCase().includes(city.toLowerCase()) && a.type === "large_airport";
    });
  }

  // If still no match, try matching against the airport name
  if (!airport) {
    airport = airports.find((a) => {
      const name = a.name || "";
      return name.toLowerCase().includes(city.toLowerCase()) && a.type === "large_airport";
    });
  }

  return airport ? airport.iata_code : "Unknown";
}

describe("Limited Flight Search Test", () => {
  jest.setTimeout(30000); // Increase timeout for API calls

  it("should find flights for first three upcoming conferences", async () => {
    const conferences = findUpcomingConferences(3);
    const results: StipendBreakdown[] = [];
    console.log(`Processing ${conferences.length} upcoming conferences`);

    for (const conference of conferences) {
      console.log("\nProcessing conference:", conference.Conference);

      const dates = generateFlightDates(conference);
      console.log("Flight dates:", dates);

      const departureAirport = extractAirportCode(conference.Location);
      if (departureAirport === "Unknown") {
        console.warn(`Could not find airport code for location: ${conference.Location}`);
        continue;
      }

      // Calculate common values needed for both API and fallback cases
      const numberOfNights = calculateDateDiff(conference.Start, conference.End);
      const numberOfMealDays = numberOfNights + 1;
      const colFactor = getCostOfLivingFactor(conference.Location);
      const lodgingCost = BASE_LODGING_PER_NIGHT * colFactor * numberOfNights;
      const mealsCost = BASE_MEALS_PER_DAY * colFactor * numberOfMealDays;

      try {
        const searchParams = {
          api_key: process.env.SERPAPI_API_KEY,
          engine: "google_flights",
          hl: "en",
          gl: "us",
          departure_id: "ICN", // Assuming searching from Seoul
          arrival_id: departureAirport,
          outbound_date: dates.outbound,
          return_date: dates.return,
          currency: "USD",
          type: "1",
          travel_class: "1",
          deep_search: "true",
          adults: "1",
          sort_by: "1",
          stops: "0",
        };

        const result = (await getJson(searchParams)) as FlightResults;

        // Get the lowest price from best_flights
        const flightCost = result.best_flights.reduce(
          (min, flight) => {
            if (flight.price && (min === null || flight.price < min)) {
              return flight.price;
            }
            return min;
          },
          null as number | null
        );

        if (!flightCost) {
          throw new Error("No flight price found in API response");
        }

        const breakdown: StipendBreakdown = {
          conference: conference.Conference,
          location: conference.Location,
          distance_km: 0, // Not needed when we have actual flight prices
          flight_cost: Math.round(flightCost * 100) / 100,
          lodging_cost: Math.round(lodgingCost * 100) / 100,
          meals_cost: Math.round(mealsCost * 100) / 100,
          ticket_price: DEFAULT_TICKET_PRICE,
          total_stipend: Math.round((flightCost + lodgingCost + mealsCost + DEFAULT_TICKET_PRICE) * 100) / 100,
        };

        results.push(breakdown);
        console.log(`Successfully found flights for ${conference.Conference}`);
      } catch (error) {
        console.error(`Error searching flights for ${conference.Conference}:`, error);
        console.log("Falling back to distance-based calculation");

        // Only calculate distance when we need it as a fallback
        const distanceKm = getDistanceKm(ORIGIN, conference.Location);
        const flightCost = distanceKm * COST_PER_KM;

        const breakdown: StipendBreakdown = {
          conference: conference.Conference,
          location: conference.Location,
          distance_km: Math.round(distanceKm * 10) / 10,
          flight_cost: Math.round(flightCost * 100) / 100,
          lodging_cost: Math.round(lodgingCost * 100) / 100,
          meals_cost: Math.round(mealsCost * 100) / 100,
          ticket_price: DEFAULT_TICKET_PRICE,
          total_stipend: Math.round((flightCost + lodgingCost + mealsCost + DEFAULT_TICKET_PRICE) * 100) / 100,
        };
        results.push(breakdown);
      }
    }

    // Display results in a table format
    console.log("\nFlight Search Results:");
    console.table(results);
  });
});
