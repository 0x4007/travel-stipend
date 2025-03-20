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

  // Multi-tier distance factors - final calibration based on analysis
  const DISTANCE_TIERS = [
    { threshold: 500, factor: 0.2, exponent: 0.9 }, // Very short flights (<500km)
    { threshold: 1500, factor: 0.18, exponent: 0.85 }, // Short flights (500-1500km)
    { threshold: 4000, factor: 0.15, exponent: 0.8 }, // Medium flights (1500-4000km)
    { threshold: 8000, factor: 0.18, exponent: 0.75 }, // Long flights (4000-8000km)
    { threshold: Infinity, factor: 0.2, exponent: 0.72 }, // Very long flights (>8000km)
  ];

  // Regional factors (multipliers based on regions)
  function getRegionalFactor(origin: string, destination: string): number {
    // Extract regions from origin and destination
    const originRegion = getRegion(origin);
    const destRegion = getRegion(destination);

    // Regional pricing based on final analysis
    if (originRegion === destRegion) {
      // Regional competition factors
      switch (originRegion) {
        case "Asia":
          return 0.85; // High competition in Asia
        case "Europe":
          return 0.9; // Strong competition in Europe
        case "North America":
          return 1.0; // Standard pricing within North America
        case "Middle East":
          return 1.1; // Higher prices in Middle East
        default:
          return 1.0;
      }
    }

    // Premium routes based on observed data
    const premiumRoutes = [
      { from: "North America", to: "Asia", factor: 1.8 },
      { from: "Asia", to: "North America", factor: 1.8 },
      { from: "Europe", to: "Asia", factor: 1.7 },
      { from: "Asia", to: "Europe", factor: 1.7 },
      { from: "Europe", to: "North America", factor: 1.6 },
      { from: "North America", to: "Europe", factor: 1.6 },
      { from: "Europe", to: "Australia", factor: 1.75 },
      { from: "Australia", to: "Europe", factor: 1.75 },
      { from: "South America", to: "Asia", factor: 1.7 },
      { from: "Asia", to: "South America", factor: 1.7 },
      { from: "Middle East", to: "Asia", factor: 1.6 },
      { from: "Asia", to: "Middle East", factor: 1.6 }
    ];

    const premiumRoute = premiumRoutes.find((route) => route.from === originRegion && route.to === destRegion);

    return premiumRoute ? premiumRoute.factor : 1.0; // Default no premium for same region
  }

  // Regional-based popularity factor
  function getPopularityFactor(origin: string, destination: string): number {
    // Extract regions
    const originRegion = getRegion(origin);
    const destRegion = getRegion(destination);

    // Apply discounts based on regional competition patterns
    if (originRegion === "Asia" && destRegion === "Asia") {
      return 0.85; // 15% discount for intra-Asia flights (high competition)
    }

    if (originRegion === "Europe" && destRegion === "Europe") {
      return 0.9; // 10% discount for intra-Europe flights (high competition)
    }

    if (originRegion === "North America" && destRegion === "North America") {
      return 0.9; // 10% discount for intra-North America flights
    }

    // Default - no specific adjustment
    return 1.0;
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

  // Apply regional and popularity factors
  const regionalFactor = getRegionalFactor(origin, destination);
  const popularityFactor = getPopularityFactor(origin, destination);

  // Calculate final cost
  let flightCost = (BASE_COST + distanceCost) * regionalFactor * popularityFactor;

  // Round to nearest $5 for cleaner numbers
  flightCost = Math.round(flightCost / 5) * 5;

  // Cache the result
  flightCostCache.set(cacheKey, flightCost);

  return flightCost;
}

// Normalize country names to match countries-list format
function normalizeCountryName(countryName: string): string {
  const countryNameMap: Record<string, string> = {
    "USA": "United States",
    "US": "United States",
    "UK": "United Kingdom",
    "South Korea": "Korea, Republic of",
    "Korea": "Korea, Republic of"
  };

  return countryNameMap[countryName] || countryName;
}

// Export for testing
export function getRegion(location: string): string {
  // Extract city and country if available
  let city = location;
  let countryName = "";

  if (location.includes(",")) {
    const parts = location.split(",");
    city = parts[0].trim();
    countryName = parts[1].trim();
  }

  // If no country was provided, try to determine it from city-timezones
  if (!countryName) {
    const cityInfo = cityTimezones.lookupViaCity(city);
    if (cityInfo && cityInfo.length > 0) {
      countryName = cityInfo[0].country;
    }
  }

  // Normalize country name
  if (countryName) {
    countryName = normalizeCountryName(countryName);
  }

  // Try to find the country in the countries-list library
  if (countryName) {
    // Normalize country name for lookup
    const normalizedCountryName = countryName.trim();

    // Find country by name or code
    const countryCode = Object.keys(countries).find(code => {
      const country = countries[code as keyof typeof countries];
      return (
        country.name.toLowerCase() === normalizedCountryName.toLowerCase() ||
        code.toLowerCase() === normalizedCountryName.toLowerCase() ||
        (country.native && country.native.toLowerCase() === normalizedCountryName.toLowerCase())
      );
    });

    if (countryCode) {
      const country = countries[countryCode as keyof typeof countries];
      const continentCode = country.continent;

      // Map continent code to our region format
      switch (continentCode) {
        case "NA": return "North America";
        case "SA": return "South America";
        case "EU": return "Europe";
        case "AS": return "Asia";
        case "OC": return "Australia";
        case "AF": return "Africa";
        default: return "Other";
      }
    }
  }

  // Default to 'Other' if region can't be determined
  return "Other";
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
  const cacheKey = createHashKey([origin, destination, dates.outbound, dates.return, "v2"]); // Updated cache version

  // Check cache first
  const cachedData = flightCache.get(cacheKey);
  if (cachedData) {
    console.log(`Using cached flight price from ${cachedData.timestamp} (${cachedData.source})`);
    return { price: cachedData.price, source: cachedData.source };
  }

  try {
    console.log(`Scraping flight prices from ${origin} to ${destination}`);
    console.log(`Dates: ${dates.outbound} to ${dates.return}`);

    // Initialize scraper
    const scraper = new GoogleFlightsScraper();
    await scraper.initialize({ headless: true });

    // Navigate and search
    await scraper.navigateToGoogleFlights();
    await scraper.changeCurrencyToUsd();
    const results = await scraper.searchFlights(origin, destination, dates.outbound, dates.return);

    // Clean up
    await scraper.close();

    // Handle different result types
    if (results.success) {
      if ('prices' in results && results.prices.length > 0) {
        // Handle array of prices
        const topFlights = results.prices.filter((flight: { isTopFlight: boolean; price: number }) => flight.isTopFlight);

        if (topFlights.length > 0) {
          // Calculate average of top flights
          const sum = topFlights.reduce((total: number, flight: { price: number }) => total + flight.price, 0);
          const avg = Math.round(sum / topFlights.length);

          // Store in cache only if we have a valid price
          if (avg > 0) {
            flightCache.set(cacheKey, {
              price: avg,
              timestamp: new Date().toISOString(),
              source: "Google Flights",
            });
            console.log(`Stored flight price in cache: $${avg} (from top flights)`);
          }

          return { price: avg, source: "Google Flights" };
        } else {
          // Calculate average of all flights
          const sum = results.prices.reduce((total: number, flight: { price: number }) => total + flight.price, 0);
          const avg = Math.round(sum / results.prices.length);

          // Store in cache only if we have a valid price
          if (avg > 0) {
            flightCache.set(cacheKey, {
              price: avg,
              timestamp: new Date().toISOString(),
              source: "Google Flights",
            });
            console.log(`Stored flight price in cache: $${avg} (from all flights)`);
          }

          return { price: avg, source: "Google Flights" };
        }
      } else if ('price' in results) {
        // Handle single price result
        return { price: results.price, source: results.source };
      }
    }

    console.log("No flight prices found from Google Flights scraper, trying Amadeus API...");
    // Try Amadeus API as fallback
    return getAmadeusPrice(origin, destination, dates);
  } catch (error) {
    console.error("Error scraping Google Flights price:", error);
    // Try Amadeus API as fallback
    return getAmadeusPrice(origin, destination, dates);
  }
}
