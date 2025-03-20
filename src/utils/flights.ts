import airportCodes from "airport-codes";
import cityTimezones from "city-timezones";
import { countries } from "countries-list";
import { config } from "dotenv";
import { AmadeusApi } from "./amadeus-api";
import { createHashKey, PersistentCache } from "./cache";
import { ORIGIN } from "./constants";
import { GoogleFlightsScraper } from "./google-flights-scraper";

// Load environment variables
config();

// Initialize flight cache
const flightCache = new PersistentCache<{ price: number; timestamp: string; source: string }>("fixtures/cache/flight-cache.json");
const flightCostCache = new PersistentCache<number>("fixtures/cache/flight-cost-cache.json");

export function calculateFlightCost(distanceKm: number, destination: string, origin: string = ORIGIN): number {
  // Check cache first
  const cacheKey = createHashKey([origin, destination, distanceKm.toFixed(1), "v1"]);
  const cachedCost = flightCostCache.get(cacheKey);
  if (cachedCost != null) {
    return cachedCost;
  }

  // Base cost parameters - final optimization based on comprehensive testing
  const BASE_COST = 200; // Balanced base cost for short/medium flights

  // Multi-tier distance factors - final calibration
  const DISTANCE_TIERS = [
    { threshold: 500, factor: 0.11, exponent: 0.95 },    // Very short flights (<500km)
    { threshold: 1500, factor: 0.11, exponent: 0.92 },   // Short flights (500-1500km)
    { threshold: 4000, factor: 0.14, exponent: 0.90 },   // Medium flights (1500-4000km)
    { threshold: 8000, factor: 0.18, exponent: 0.88 },   // Long flights (4000-8000km)
    { threshold: Infinity, factor: 0.20, exponent: 0.85 } // Very long flights (>8000km)
  ];

  // Distance-based scaling with diminishing returns
  function getScalingFactor(distanceKm: number): number {
    return 1.0 + (Math.log10(distanceKm) / 11.5); // Slightly increased scaling for better short-range accuracy
  }

  // Calculate the base distance cost using the appropriate tier
  let distanceCost = 0;
  let remainingDistance = distanceKm;
  let currentTierIndex = 0;

  // Apply each tier's formula to its portion of the distance
  while (remainingDistance > 0 && currentTierIndex < DISTANCE_TIERS.length) {
    const currentTier = DISTANCE_TIERS[currentTierIndex];
    const previousTierThreshold = currentTierIndex > 0 ? DISTANCE_TIERS[currentTierIndex - 1].threshold : 0;

    // Calculate the distance that falls within this tier
    const distanceInTier = Math.min(remainingDistance, currentTier.threshold - previousTierThreshold);

    // Apply this tier's formula to the distance in this tier
    distanceCost += currentTier.factor * Math.pow(distanceInTier, currentTier.exponent);

    // Subtract the processed distance
    remainingDistance -= distanceInTier;
    currentTierIndex++;
  }

  // Calculate final cost using only distance-based scaling
  const scalingFactor = getScalingFactor(distanceKm);
  let flightCost = (BASE_COST + distanceCost) * scalingFactor;

  // Round to nearest $5 for cleaner numbers
  flightCost = Math.round(flightCost / 5) * 5;

  // Cache the result
  flightCostCache.set(cacheKey, flightCost);

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
  const cacheKey = createHashKey([origin, destination, dates.outbound, dates.return, "v2"]);

  const cachedResult = checkFlightCache(cacheKey);
  if (cachedResult) {
    return cachedResult;
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

  const scraper = new GoogleFlightsScraper();
  await scraper.initialize({ headless: true });

  try {
    await scraper.navigateToGoogleFlights();
    await scraper.changeCurrencyToUsd();
    const results = await scraper.searchFlights(origin, destination, dates.outbound, dates.return);

    await scraper.close();
    return processGoogleFlightsResults(results);
  } catch (error) {
    await scraper.close();
    throw error;
  }
}

interface FlightPrice {
  isTopFlight: boolean;
  price: number;
}

interface GoogleFlightsResult {
  success: boolean;
  prices?: FlightPrice[];
  price?: number;
  source?: string;
}

function processGoogleFlightsResults(results: GoogleFlightsResult): { price: number | null; source: string } {
  if (!results.success) {
    return { price: null, source: "Google Flights" };
  }

  if ('prices' in results && Array.isArray(results.prices) && results.prices.length > 0) {
    const topFlights = results.prices.filter(flight => flight.isTopFlight);
    const flightsToAverage = topFlights.length > 0 ? topFlights : results.prices;
    return calculateFlightAverage(flightsToAverage);
  }

  if ('price' in results && typeof results.price === 'number') {
    return {
      price: results.price,
      source: results.source ?? "Google Flights"
    };
  }

  return { price: null, source: "Google Flights" };
}

function calculateFlightAverage(flights: FlightPrice[]): { price: number; source: string } {
  const sum = flights.reduce((total: number, flight: { price: number }) => total + flight.price, 0);
  const avg = Math.round(sum / flights.length);

  if (avg > 0) {
    flightCache.set(createHashKey([String(avg)]), {
      price: avg,
      timestamp: new Date().toISOString(),
      source: "Google Flights",
    });
    console.log(`Stored flight price in cache: $${avg}`);
  }

  return { price: avg, source: "Google Flights" };
}
