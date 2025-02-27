// travelStipendCalculator.ts

import crypto from "crypto";
import { parse } from "csv-parse/sync";
import fs from "fs";
import path from "path";

// --- Cache Implementation ---
interface Cache<T> {
  get(key: string): T | undefined;
  set(key: string, value: T): void;
  has(key: string): boolean;
}

class MemoryCache<T> implements Cache<T> {
  private _cache: Map<string, T> = new Map();

  get(key: string): T | undefined {
    return this._cache.get(key);
  }

  set(key: string, value: T): void {
    this._cache.set(key, value);
  }

  has(key: string): boolean {
    return this._cache.has(key);
  }

  // Add a method to get all entries as a Record
  getAllEntries(): Record<string, T> {
    const entries: Record<string, T> = {};
    this._cache.forEach((value, key) => {
      entries[key] = value;
    });
    return entries;
  }
}

class PersistentCache<T> implements Cache<T> {
  private _memoryCache: MemoryCache<T> = new MemoryCache<T>();
  private _filePath: string;

  constructor(cacheFileName: string) {
    this._filePath = path.join(process.cwd(), cacheFileName);
    this._loadFromDisk();
  }

  private _loadFromDisk(): void {
    try {
      if (fs.existsSync(this._filePath)) {
        const data = fs.readFileSync(this._filePath, 'utf-8');
        const cacheData = JSON.parse(data);

        for (const [key, value] of Object.entries(cacheData)) {
          this._memoryCache.set(key, value as T);
        }

        console.log(`Loaded ${Object.keys(cacheData).length} cached entries from ${this._filePath}`);
      }
    } catch (error) {
      console.error(`Error loading cache from ${this._filePath}:`, error);
    }
  }

  saveToDisk(): void {
    try {
      // Get all entries from the memory cache
      const cacheObject = this._memoryCache.getAllEntries();

      fs.writeFileSync(this._filePath, JSON.stringify(cacheObject, null, 2));
      console.log(`Saved cache to ${this._filePath}`);
    } catch (error) {
      console.error(`Error saving cache to ${this._filePath}:`, error);
    }
  }

  get(key: string): T | undefined {
    return this._memoryCache.get(key);
  }

  set(key: string, value: T): void {
    this._memoryCache.set(key, value);
  }

  has(key: string): boolean {
    return this._memoryCache.has(key);
  }
}

// Helper function to create hash keys for caching
function createHashKey(args: unknown[]): string {
  const stringifiedArgs = JSON.stringify(args);
  // Using SHA-256 instead of MD5 for better security
  return crypto.createHash('sha256').update(stringifiedArgs).digest('hex');
}

// Function decorator for caching
function cached<T, TArgs extends unknown[]>(
  cache: Cache<T>,
  fn: (...args: TArgs) => T
): (...args: TArgs) => T {
  return (...args: TArgs): T => {
    const key = createHashKey(args);

    if (cache.has(key)) {
      const cachedResult = cache.get(key);
      if (cachedResult !== undefined) {
        return cachedResult;
      }
    }

    const result = fn(...args);
    cache.set(key, result);
    return result;
  };
}

// Initialize caches
const distanceCache = new PersistentCache<number>('fixtures/cache/distance-cache.json');
const coordinatesCache = new PersistentCache<Coordinates>('fixtures/cache/coordinates-cache.json');
const costOfLivingCache = new PersistentCache<number>('fixtures/cache/col-cache.json');

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

// Basic mapping of city names to coordinates
interface CityCoordinatesMap {
  [city: string]: Coordinates;
}

// Extended mapping class that includes fuzzy matching capabilities
class CoordinatesMapping {
  private _cityMap: CityCoordinatesMap = {};
  private _cityNames: string[] = [];
  private _cityVariants: { [normalizedName: string]: string } = {};

  // Add a city with its coordinates
  addCity(cityName: string, coordinates: Coordinates): void {
    this._cityMap[cityName] = coordinates;
    this._cityNames.push(cityName);
  }

  // Add a city variant (e.g., lowercase, alternative spelling)
  addCityVariant(normalizedName: string, originalName: string): void {
    this._cityVariants[normalizedName] = originalName;
  }

  // Get coordinates for a city
  getCoordinates(cityName: string): Coordinates | undefined {
    return this._cityMap[cityName];
  }

  // Get all city names
  getCityNames(): string[] {
    return this._cityNames;
  }

  // Get city variant mapping
  getCityVariant(normalizedName: string): string | undefined {
    return this._cityVariants[normalizedName];
  }

  // Get number of cities
  size(): number {
    return this._cityNames.length;
  }
}

// Load coordinates from CSV file
interface CoordinateRecord {
  city: string;
  city_ascii: string;
  lat: string;
  lng: string;
  country: string;
  iso2: string;
  iso3: string;
  admin_name: string;
  capital: string;
  population: string;
  id: string;
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

function loadCoordinatesData(filePath: string): CoordinatesMapping {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const records: CoordinateRecord[] = parse(content, {
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

    // Add special case for typo in conferences.csv
    const amsterdamCoords = mapping.getCoordinates("Amsterdam, Netherlands");
    if (amsterdamCoords) {
      mapping.addCity("Amstardam, Netherlands", amsterdamCoords);
      mapping.addCityVariant("amstardam, netherlands", "Amstardam, Netherlands");
    }

    // Add special case for Singapore
    const singaporeCoords = mapping.getCoordinates("Singapore, Singapore");
    if (singaporeCoords) {
      mapping.addCity("Singapore", singaporeCoords);
      mapping.addCityVariant("singapore", "Singapore");
    }

    console.log(`Loaded ${mapping.size()} coordinate entries`);
    return mapping;
  } catch (error) {
    console.error(`Could not load ${filePath}, using default mapping.`, error);
    // Fallback to a minimal set of coordinates if file can't be loaded
    const defaultMapping = new CoordinatesMapping();

    defaultMapping.addCity("Seoul, Korea", { lat: 37.5665, lng: 126.978 });
    defaultMapping.addCityVariant("seoul, korea", "Seoul, Korea");

    defaultMapping.addCity("Tokyo, Japan", { lat: 35.6895, lng: 139.6917 });
    defaultMapping.addCityVariant("tokyo, japan", "Tokyo, Japan");

    defaultMapping.addCity("Jakarta, Indonesia", { lat: -6.2088, lng: 106.8456 });
    defaultMapping.addCityVariant("jakarta, indonesia", "Jakarta, Indonesia");

    return defaultMapping;
  }
}

// Load the city coordinates mapping
console.log("Loading city coordinates data...");
const cityCoordinates = loadCoordinatesData("fixtures/coordinates.csv");

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

// Helper function to find city coordinates with fuzzy matching
// Cache-wrapped version of findCityCoordinates
const findCityCoordinates = cached(
  coordinatesCache,
  (cityName: string, coordinates: CoordinatesMapping): Coordinates => {
    // Try exact match first
    const exactMatch = coordinates.getCoordinates(cityName);
    if (exactMatch) {
      return exactMatch;
    }

    // Try lowercase match with variants
    const normalizedName = cityName.toLowerCase().trim();
    const variantMatch = coordinates.getCityVariant(normalizedName);
    if (variantMatch) {
      const variantCoords = coordinates.getCoordinates(variantMatch);
      if (variantCoords) {
        return variantCoords;
      }
    }

    // If no match found, try fuzzy matching
    const SIMILARITY_THRESHOLD = 0.6; // Minimum similarity score to consider a match
    const cityNames = coordinates.getCityNames();
    const { match, similarity } = findBestMatch(cityName, cityNames);

    if (similarity >= SIMILARITY_THRESHOLD) {
      console.log(`Fuzzy match found for "${cityName}": "${match}" (similarity: ${(similarity * 100).toFixed(1)}%)`);
      const fuzzyMatchCoords = coordinates.getCoordinates(match);
      if (fuzzyMatchCoords) {
        return fuzzyMatchCoords;
      }
    }

    throw new Error(`No matching city found for: ${cityName} (best match: ${match}, similarity: ${(similarity * 100).toFixed(1)}%)`);
  }
);

// Cache-wrapped version of getDistanceKmFromCities
const getDistanceKmFromCities = cached(
  distanceCache,
  (originCity: string, destinationCity: string): number => {
    const originCoords = findCityCoordinates(originCity, cityCoordinates);
    const destinationCoords = findCityCoordinates(destinationCity, cityCoordinates);

    return haversineDistance(originCoords, destinationCoords);
  }
);

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

// Cache-wrapped version of getCostOfLivingFactor
const getCostOfLivingFactor = cached(
  costOfLivingCache,
  (location: string): number => {
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
);

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

// Cache for the entire stipend calculation
const stipendCache = new PersistentCache<StipendBreakdown>('fixtures/cache/stipend-cache.json');

// Function to calculate stipend with caching
function calculateStipend(record: RealConferenceRecord): StipendBreakdown {
  const cacheKey = createHashKey([
    record.Conference,
    record.Location,
    record.Start,
    record.End,
    ORIGIN,
    COST_PER_KM,
    BASE_LODGING_PER_NIGHT,
    BASE_MEALS_PER_DAY,
    DEFAULT_TICKET_PRICE
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
      const result = calculateStipend(record);
      results.push(result);
    } catch (error) {
      console.error(`Error processing conference "${record["Conference"]}":`, error);
    }
  }

  // Save all caches to disk
  distanceCache.saveToDisk();
  coordinatesCache.saveToDisk();
  costOfLivingCache.saveToDisk();
  stipendCache.saveToDisk();

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
