import { parse } from "csv-parse/sync";
import fs from "fs";
import { PersistentCache } from "./cache";
import { SIMILARITY_THRESHOLD } from "./constants";

// Interface for taxi fare data
interface TaxiFare {
  country: string;
  startPrice: number; // USD
  pricePerKm: number; // USD per km
}

// Cache for taxi data
const taxiDataCache = new PersistentCache<TaxiFare[]>("fixtures/cache/taxi-cache.json");

// Cache for country matching results
const countryMatchCache = new PersistentCache<string>("fixtures/cache/country-match-cache.json");

// Function to calculate string similarity using Levenshtein distance
function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase();
  const s2 = str2.toLowerCase();

  const arr = Array(s2.length + 1)
    .fill(null)
    .map(() => Array(s1.length + 1).fill(null));

  for (let i = 0; i <= s1.length; i++) {
    arr[0][i] = i;
  }

  for (let j = 0; j <= s2.length; j++) {
    arr[j][0] = j;
  }

  for (let j = 1; j <= s2.length; j++) {
    for (let i = 1; i <= s1.length; i++) {
      const indicator = s1[i - 1] === s2[j - 1] ? 0 : 1;
      arr[j][i] = Math.min(arr[j][i - 1] + 1, arr[j - 1][i] + 1, arr[j - 1][i - 1] + indicator);
    }
  }

  const maxLength = Math.max(s1.length, s2.length);
  return 1 - arr[s2.length][s1.length] / maxLength;
}

// Load taxi data from CSV
function loadTaxiData(filePath: string = "fixtures/taxis.csv"): TaxiFare[] {
  // Check cache first
  const cacheKey = "taxi_data";
  if (taxiDataCache.has(cacheKey)) {
    const cachedData = taxiDataCache.get(cacheKey);
    if (cachedData) {
      return cachedData;
    }
  }

  // Read and parse CSV if not cached
  const fileContent = fs.readFileSync(filePath, "utf-8");
  interface TaxiRecord {
    Country: string;
    "Start Price (USD)": string;
    "Price per km (USD)": string;
  }

  const records = parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
  }) as TaxiRecord[];

  const taxiData: TaxiFare[] = records.map((record) => ({
    country: record.Country,
    startPrice: parseFloat(record["Start Price (USD)"]),
    pricePerKm: parseFloat(record["Price per km (USD)"]),
  }));

  // Cache the data
  taxiDataCache.set(cacheKey, taxiData);
  taxiDataCache.saveToDisk();

  return taxiData;
}

// Extract country from location string
function extractCountry(location: string): string {
  // Split by comma and take the last part
  const parts = location.split(",");
  return parts[parts.length - 1].trim();
}

// Find matching country in taxi data
function findMatchingCountry(location: string, taxiData: TaxiFare[]): TaxiFare | null {
  const country = extractCountry(location);

  // Check country match cache
  const cacheKey = country.toLowerCase();
  if (countryMatchCache.has(cacheKey)) {
    const matchedCountry = countryMatchCache.get(cacheKey);
    if (matchedCountry) {
      return taxiData.find((data) => data.country === matchedCountry) || null;
    }
  }

  // Find best match
  let bestMatch: TaxiFare | null = null;
  let bestSimilarity = 0;

  for (const taxiFare of taxiData) {
    const similarity = calculateSimilarity(country, taxiFare.country);
    if (similarity > bestSimilarity && similarity >= SIMILARITY_THRESHOLD) {
      bestSimilarity = similarity;
      bestMatch = taxiFare;
    }
  }

  // Cache the result if found
  if (bestMatch) {
    countryMatchCache.set(cacheKey, bestMatch.country);
    countryMatchCache.saveToDisk();
  }

  return bestMatch;
}

// Calculate local transport cost using taxi fares
export function calculateLocalTransportCost(location: string, days: number, colFactor: number, baseTransportCost: number): number {
  const RIDES_PER_DAY = 4;
  const AVERAGE_RIDE_DISTANCE = 5; // km

  const taxiData = loadTaxiData();
  const matchingCountry = findMatchingCountry(location, taxiData);

  if (!matchingCountry) {
    console.warn(`No matching taxi fare data found for location: ${location}. Using base transport cost.`);
    return baseTransportCost * colFactor * days;
  }

  const costPerDay = RIDES_PER_DAY * (matchingCountry.startPrice + matchingCountry.pricePerKm * AVERAGE_RIDE_DISTANCE);

  return costPerDay * days;
}
