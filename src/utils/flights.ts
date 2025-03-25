import airportCodes from "airport-codes";
import cityTimezones from "city-timezones";
import { countries } from "countries-list";
import { config } from "dotenv";
import { Page } from "puppeteer";
import { AmadeusApi } from "./amadeus-api";
import { createHashKey, PersistentCache } from "./cache";
import { navigateToFlights } from "./google-flights-scraper/src/google-flights/page-navigation";
import { scrapeFlightPrices } from "./google-flights-scraper/src/google-flights/scrape/scrape-flight-prices";
import { launchBrowser } from "./google-flights-scraper/src/utils/launch";
// Default origin city for flight calculations
const DEFAULT_ORIGIN = "Seoul, KR";

// Load environment variables
config();

// Cache interfaces
interface FlightCostCacheEntry {
  cost: number;
  metadata: {
    isTraining: boolean;
    tierVersion: string;
    timestamp: string;
    actualPrice?: number;
    error?: number;
  }
}

// Initialize flight cache
const flightCache = new PersistentCache<{ price: number; timestamp: string; source: string }>("fixtures/cache/flight-cache.json");
const flightCostCache = new PersistentCache<FlightCostCacheEntry>("fixtures/cache/flight-cost-cache.json");

export function calculateFlightCost(distanceKm: number, destination: string, origin: string = DEFAULT_ORIGIN): number {
  // Check cache first
  const cacheKey = createHashKey([origin, destination, distanceKm.toFixed(1), "v3-training"]);
  const cachedEntry = flightCostCache.get(cacheKey);
  if (cachedEntry != null) {
    return cachedEntry.cost;
  }

  // Get cached training data for this distance if available
  const trainingData = retrieveTrainingDataForDistance(distanceKm);

  // If distance is 0 (same city), return 0 as no flight is needed
  if (distanceKm === 0) {
    return 0; // No flight cost for same city
  }

  // Base cost parameters - reduced to better match real prices
  const BASE_COST = 180;

  // Multi-tier distance factors with further optimized factors based on actual price data
  const DISTANCE_TIERS = [
    { threshold: 200, factor: adjustFactorBasedOnTraining(0.038, 0.96, distanceKm, trainingData) },    // Micro (<200km)
    { threshold: 300, factor: adjustFactorBasedOnTraining(0.035, 0.95, distanceKm, trainingData) },    // Ultra short (200-300km)
    { threshold: 400, factor: adjustFactorBasedOnTraining(0.032, 0.945, distanceKm, trainingData) },   // Very short (300-400km)
    { threshold: 500, factor: adjustFactorBasedOnTraining(0.03, 0.94, distanceKm, trainingData) },     // Short (400-500km)
    { threshold: 600, factor: adjustFactorBasedOnTraining(0.028, 0.935, distanceKm, trainingData) },   // Short-plus (500-600km)
    { threshold: 750, factor: adjustFactorBasedOnTraining(0.025, 0.93, distanceKm, trainingData) },    // Short-medium (600-750km)
    { threshold: 900, factor: adjustFactorBasedOnTraining(0.023, 0.925, distanceKm, trainingData) },   // Medium-short (750-900km)
    { threshold: 1000, factor: adjustFactorBasedOnTraining(0.022, 0.92, distanceKm, trainingData) },   // Medium-short-plus (900-1000km)
    { threshold: 1250, factor: adjustFactorBasedOnTraining(0.023, 0.915, distanceKm, trainingData) },  // Medium-minus (1000-1250km)
    { threshold: 1500, factor: adjustFactorBasedOnTraining(0.025, 0.91, distanceKm, trainingData) },   // Medium (1250-1500km)
    { threshold: 1750, factor: adjustFactorBasedOnTraining(0.026, 0.905, distanceKm, trainingData) },  // Medium-plus (1500-1750km)
    { threshold: 2000, factor: adjustFactorBasedOnTraining(0.028, 0.90, distanceKm, trainingData) },   // Medium-extended (1750-2000km)
    { threshold: 2250, factor: adjustFactorBasedOnTraining(0.029, 0.895, distanceKm, trainingData) },  // Medium-long-minus (2000-2250km)
    { threshold: 2500, factor: adjustFactorBasedOnTraining(0.03, 0.89, distanceKm, trainingData) },    // Medium-long (2250-2500km)
    { threshold: 2750, factor: adjustFactorBasedOnTraining(0.032, 0.89, distanceKm, trainingData) },   // Medium-long-plus (2500-2750km)
    { threshold: 3000, factor: adjustFactorBasedOnTraining(0.035, 0.89, distanceKm, trainingData) },   // Extended medium (2750-3000km)
    { threshold: 3500, factor: adjustFactorBasedOnTraining(0.038, 0.885, distanceKm, trainingData) },  // Long-starter-minus (3000-3500km)
    { threshold: 4000, factor: adjustFactorBasedOnTraining(0.04, 0.88, distanceKm, trainingData) },    // Long starter (3500-4000km)
    { threshold: 4500, factor: adjustFactorBasedOnTraining(0.043, 0.88, distanceKm, trainingData) },   // Long-minus (4000-4500km)
    { threshold: 5000, factor: adjustFactorBasedOnTraining(0.045, 0.88, distanceKm, trainingData) },   // Long (4500-5000km)
    { threshold: 5500, factor: adjustFactorBasedOnTraining(0.048, 0.875, distanceKm, trainingData) },  // Long-plus (5000-5500km)
    { threshold: 6000, factor: adjustFactorBasedOnTraining(0.05, 0.87, distanceKm, trainingData) },    // Long-extended (5500-6000km)
    { threshold: 6500, factor: adjustFactorBasedOnTraining(0.28, 0.87, distanceKm, trainingData) },    // Extended-minus (6000-6500km)
    { threshold: 7000, factor: adjustFactorBasedOnTraining(0.32, 0.87, distanceKm, trainingData) },    // Extended (6500-7000km)
    { threshold: 7500, factor: adjustFactorBasedOnTraining(0.325, 0.865, distanceKm, trainingData) },  // Extended-plus (7000-7500km)
    { threshold: 8000, factor: adjustFactorBasedOnTraining(0.33, 0.86, distanceKm, trainingData) },    // Extended-long (7500-8000km)
    { threshold: 8500, factor: adjustFactorBasedOnTraining(0.14, 0.86, distanceKm, trainingData) },    // Very-long-starter-minus (8000-8500km)
    { threshold: 9000, factor: adjustFactorBasedOnTraining(0.145, 0.86, distanceKm, trainingData) },   // Very long starter (8500-9000km)
    { threshold: 9500, factor: adjustFactorBasedOnTraining(0.15, 0.855, distanceKm, trainingData) },   // Very-long-minus (9000-9500km)
    { threshold: 10000, factor: adjustFactorBasedOnTraining(0.155, 0.85, distanceKm, trainingData) },  // Very long (9500-10000km)
    { threshold: 10500, factor: adjustFactorBasedOnTraining(0.19, 0.85, distanceKm, trainingData) },   // Ultra-starter-minus (10000-10500km)
    { threshold: 11000, factor: adjustFactorBasedOnTraining(0.22, 0.85, distanceKm, trainingData) },   // Ultra starter (10500-11000km)
    { threshold: 11500, factor: adjustFactorBasedOnTraining(0.225, 0.845, distanceKm, trainingData) }, // Ultra-long-minus (11000-11500km)
    { threshold: 12000, factor: adjustFactorBasedOnTraining(0.23, 0.84, distanceKm, trainingData) },   // Ultra long (11500-12000km)
    { threshold: 12500, factor: adjustFactorBasedOnTraining(0.195, 0.84, distanceKm, trainingData) },  // Extreme-starter-minus (12000-12500km)
    { threshold: 13000, factor: adjustFactorBasedOnTraining(0.20, 0.84, distanceKm, trainingData) },   // Extreme starter (12500-13000km)
    { threshold: 13500, factor: adjustFactorBasedOnTraining(0.205, 0.835, distanceKm, trainingData) }, // Extreme-minus (13000-13500km)
    { threshold: 14000, factor: adjustFactorBasedOnTraining(0.21, 0.83, distanceKm, trainingData) },   // Extreme (13500-14000km)
    { threshold: 14500, factor: adjustFactorBasedOnTraining(0.215, 0.83, distanceKm, trainingData) },  // Extreme-plus (14000-14500km)
    { threshold: 15000, factor: adjustFactorBasedOnTraining(0.22, 0.825, distanceKm, trainingData) },  // Ultra-extreme (14500-15000km)
    { threshold: Infinity, factor: adjustFactorBasedOnTraining(0.225, 0.82, distanceKm, trainingData)} // Maximum (>15000km)
  ];

  // Helper functions for training data
  // Helper function to validate and extract distance from cache key
  function extractDistanceFromKey(key: string): number | null {
    const keyParts = key.split('-');
    if (keyParts.length < 3) return null;

    const distance = parseFloat(keyParts[2] ?? '0');
    return isNaN(distance) ? null : distance;
  }

  // Helper function to check if entry is valid training data
  function isValidTrainingEntry(entry: FlightCostCacheEntry | undefined): entry is FlightCostCacheEntry {
    return !!entry && !!entry.metadata?.isTraining && !!entry.metadata?.actualPrice;
  }

  // Helper function to check if distance is within tolerance
  function isWithinDistanceTolerance(entryDistance: number, targetDistance: number, tolerance = 0.1): boolean {
    return Math.abs(entryDistance - targetDistance) / targetDistance <= tolerance;
  }

  // Helper function to filter valid training entries
  function filterValidTrainingEntries(
    entries: [string, { value: FlightCostCacheEntry; timestamp: number }][],
    distanceKm: number
  ): FlightCostCacheEntry[] {
    return entries
      .filter(([key, { value }]) => {
        if (!isValidTrainingEntry(value)) return false;
        const entryDistance = extractDistanceFromKey(key);
        return entryDistance !== null && isWithinDistanceTolerance(entryDistance, distanceKm);
      })
      .map(([, { value }]) => value);
  }

  function retrieveTrainingDataForDistance(distanceKm: number): FlightCostCacheEntry[] {
    const cache = new PersistentCache<FlightCostCacheEntry>("fixtures/cache/flight-cost-cache.json");
    try {
      const allEntries = cache.getAllEntries();
      return filterValidTrainingEntries(Object.entries(allEntries), distanceKm);
    } catch (error) {
      console.error("Error retrieving training data:", error);
      return [];
    }
  }

  function adjustFactorBasedOnTraining(
    baseFactor: number,
    baseExponent: number,
    distanceKm: number,
    trainingData: FlightCostCacheEntry[]
  ): { factor: number; exponent: number } {
    if (!trainingData.length) {
      return { factor: baseFactor, exponent: baseExponent };
    }

    // Calculate average error
    const avgError = trainingData.reduce((sum, entry) => sum + (entry.metadata.error ?? 0), 0) / trainingData.length;

    // Determine adjustments based on error magnitude
    const adjustments = calculateAdjustments(avgError);

    return {
      factor: Math.max(0.05, baseFactor + adjustments.factor),
      exponent: Math.max(0.5, Math.min(1.0, baseExponent + adjustments.exponent))
    };
  }

  function calculateAdjustments(avgError: number): { factor: number; exponent: number } {
    const isPositiveError = avgError > 0;
    const errorMagnitude = Math.abs(avgError);

    if (errorMagnitude > 50) {
      return {
        factor: isPositiveError ? -0.03 : 0.03,
        exponent: isPositiveError ? -0.02 : 0.02
      };
    }

    if (errorMagnitude > 30) {
      return {
        factor: isPositiveError ? -0.02 : 0.02,
        exponent: isPositiveError ? -0.015 : 0.015
      };
    }

    if (errorMagnitude > 10) {
      return {
        factor: isPositiveError ? -0.01 : 0.01,
        exponent: isPositiveError ? -0.01 : 0.01
      };
    }

    return { factor: 0, exponent: 0 };
  }

  // Distance-based scaling with diminishing returns
  function getScalingFactor(distanceKm: number): number {
    return 1.0 + (Math.log10(distanceKm) / 11.5); // Slightly increased scaling for better short-range accuracy
  }

  // Calculate the base distance cost using the appropriate tier and training data
  let distanceCost = 0;
  let remainingDistance = distanceKm;
  let currentTierIndex = 0;

  // Apply each tier's formula to its portion of the distance, using adjusted factors
  while (remainingDistance > 0 && currentTierIndex < DISTANCE_TIERS.length) {
    const currentTier = DISTANCE_TIERS[currentTierIndex];
    const previousTierThreshold = currentTierIndex > 0 ? DISTANCE_TIERS[currentTierIndex - 1].threshold : 0;
    const tierAdjustments = currentTier.factor;

    // Calculate the distance that falls within this tier
    const distanceInTier = Math.min(remainingDistance, currentTier.threshold - previousTierThreshold);

    // Apply this tier's formula with adjusted factor and exponent
    distanceCost += tierAdjustments.factor * Math.pow(distanceInTier, tierAdjustments.exponent);

    // Subtract the processed distance
    remainingDistance -= distanceInTier;
    currentTierIndex++;
  }

  // Calculate final cost using only distance-based scaling
  const scalingFactor = getScalingFactor(distanceKm);
  let flightCost = (BASE_COST + distanceCost) * scalingFactor;

  // Round to nearest $5 for cleaner numbers
  flightCost = Math.round(flightCost / 5) * 5;

  // Cache the result with metadata
  const cacheEntry: FlightCostCacheEntry = {
    cost: flightCost,
    metadata: {
      isTraining: false, // Default to false for normal calculations
      tierVersion: "v3", // Update version when changing tiers
      timestamp: new Date().toISOString()
    }
  };
  flightCostCache.set(cacheKey, cacheEntry);

  return flightCost;
}

// Export for testing
export function getRegion(location: string): string {
  // Extract country from location string
  const countryPart = location.includes(",") ? location.split(",")[1].trim() : "";

  if (!countryPart) {
    return getRegionFromCity(location.split(",")[0].trim());
  }

  return getRegionFromCountry(countryPart);
}

// Helper function to get region from city name
function getRegionFromCity(city: string): string {
  const cityInfo = cityTimezones.lookupViaCity(city);
  const countryCode = cityInfo?.[0]?.country;

  if (!countryCode) {
    return "Other";
  }

  const country = countries[countryCode as keyof typeof countries];
  if (!country) {
    return "Other";
  }

  return getContinentName(country.continent);
}

// Helper function to get region from country name
function getRegionFromCountry(countryName: string): string {
  const countryCode = Object.keys(countries).find(code => {
    const country = countries[code as keyof typeof countries];
    return (
      country.name.toLowerCase() === countryName.toLowerCase() ||
      code.toLowerCase() === countryName.toLowerCase()
    );
  });

  if (!countryCode) {
    return "Other";
  }

  const country = countries[countryCode as keyof typeof countries];
  return getContinentName(country.continent);
}

// Helper function to convert continent codes to names
function getContinentName(code: string): string {
  const map: Record<string, string> = {
    "NA": "North America",
    "SA": "South America",
    "EU": "Europe",
    "AS": "Asia",
    "OC": "Australia",
    "AF": "Africa"
  };

  return map[code] || "Other";
}

// Find airport code for a city
function findAirportCode(cityName: string): string | null {
  try {
    // Try to find the airport by city name
    const airports = Array.from(airportCodes)
      .filter((airport) => {
        const name = airport.get('city') || '';
        return name.toLowerCase() === cityName.toLowerCase();
      });

    if (airports.length > 0) {
      // Return the IATA code of the first match
      return airports[0].get('iata');
    }

    // If no exact match, try a more flexible search
    const fuzzyAirports = Array.from(airportCodes)
      .filter((airport) => {
        const name = airport.get('city') || '';
        return name.toLowerCase().includes(cityName.toLowerCase());
      });

    if (fuzzyAirports.length > 0) {
      // Return the IATA code of the first fuzzy match
      return fuzzyAirports[0].get('iata');
    }

    return null;
  } catch (error) {
    console.error("Error finding airport code:", error);
    return null;
  }
}

// Simplified version of getAmadeusPrice to reduce cognitive complexity
async function getAmadeusPrice(
  origin: string,
  destination: string,
  dates: { outbound: string; return: string }
): Promise<{ price: number | null; source: string }> {
  // Extract city names
  const originCity = origin.split(",")[0].trim();
  const destCity = destination.split(",")[0].trim();

  // Find airport codes using the airport-codes library
  const originCode = findAirportCode(originCity);
  const destCode = findAirportCode(destCity);

  // Check if we have valid airport codes
  if (!originCode || !destCode) {
    console.log("Could not find airport code for one of the cities:", originCity, destCity);
    return { price: null, source: "Amadeus API - Invalid city" };
  }

  return await searchAmadeusFlights(originCode, destCode, dates);
}

// Helper function to search flights with Amadeus API
async function searchAmadeusFlights(
  originCode: string,
  destCode: string,
  dates: { outbound: string; return: string }
): Promise<{ price: number | null; source: string }> {
  const apiKey = process.env.AMADEUS_API_KEY;
  const apiSecret = process.env.AMADEUS_API_SECRET;

  if (!apiKey || !apiSecret) {
    console.log("Missing Amadeus API credentials");
    return { price: null, source: "Amadeus API - Missing credentials" };
  }

  try {
    const amadeus = new AmadeusApi(apiKey, apiSecret); // Uses major carriers by default
    const result = await amadeus.searchFlights(originCode, destCode, dates.outbound, dates.return);
    return { price: result.price, source: result.source };
  } catch (error) {
    console.error("Error getting Amadeus price:", error);
    return { price: null, source: "Amadeus API error" };
  }
}

export async function scrapeFlightPrice(
  origin: string,
  destination: string,
  dates: { outbound: string; return: string }
): Promise<{ price: number | null; source: string }> {
  const cacheKey = createHashKey([origin, destination, dates.outbound, dates.return, "v3-training"]);

  const cachedResult = checkFlightCache(cacheKey);
  if (cachedResult) {
    return cachedResult;
  }

  // Check if running in GitHub Actions - we don't need to skip anymore
  const isGitHubActions = !!process.env.GITHUB_ACTIONS;
  if (isGitHubActions) {
    console.log("Running in GitHub Actions environment - attempting to use Google Flights");
  }

  try {
    const googlePrice = await searchGoogleFlights(origin, destination, dates);
    if (googlePrice.price !== null) {
      return googlePrice;
    }

    return getAmadeusPrice(origin, destination, dates);
  } catch (error) {
    console.error("Error scraping Google Flights price:", error);
    return getAmadeusPrice(origin, destination, dates);
  }
}

function checkFlightCache(cacheKey: string): { price: number; source: string } | null {
  const cachedData = flightCache.get(cacheKey);
  if (cachedData) {
    console.log(`Using cached flight price from ${cachedData.timestamp} (${cachedData.source})`);
    return { price: cachedData.price, source: cachedData.source };
  }
  return null;
}

async function searchGoogleFlights(
  origin: string,
  destination: string,
  dates: { outbound: string; return: string }
): Promise<{ price: number | null; source: string }> {
  console.log(`Scraping flight prices from ${origin} to ${destination}`);
  console.log(`Dates: ${dates.outbound} to ${dates.return}`);

  let browser: Awaited<ReturnType<typeof launchBrowser>> | null = null;
  let page: Page | null = null;

  try {
    browser = await launchBrowser();
    page = await browser.newPage();

    // Set up flight search parameters
    const parameters = {
      from: origin,
      to: destination,
      departureDate: dates.outbound,
      returnDate: dates.return,
      includeBudget: true
    };

    // Navigate to Google Flights and perform search
    await navigateToFlights(page, parameters);

    // Scrape flight prices
    const flightData = await scrapeFlightPrices(page);

    if (flightData.length > 0) {
      // Calculate average from top flights or all flights if no top flights
      const topFlights = flightData.filter(flight => flight.isTopFlight);
      const flightsToUse = topFlights.length > 0 ? topFlights : flightData;

      const avgPrice = Math.round(
        flightsToUse.reduce((sum, flight) => sum + flight.price, 0) / flightsToUse.length
      );

      return {
        price: avgPrice,
        source: "Google Flights"
      };
    }

    return {
      price: null,
      source: "Google Flights (No results)"
    };
  } catch (error) {
    console.error("Error scraping Google Flights:", error);
    return {
      price: null,
      source: "Google Flights error"
    };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
