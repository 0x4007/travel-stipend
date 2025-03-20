import { createHashKey, PersistentCache } from "./cache";
import { ORIGIN } from "./constants";
import { GoogleFlightsScraper } from "./google-flights-scraper";
import { AmadeusApi } from "./amadeus-api";
import { config } from "dotenv";

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

  // Base cost parameters - reduced to match observed prices
  const BASE_COST = 150; // Reduced base cost as prices are generally lower than expected

  // Multi-tier distance factors - adjusted based on test data without overfitting
  const DISTANCE_TIERS = [
    { threshold: 500, factor: 0.3, exponent: 0.9 }, // Very short flights (<500km)
    { threshold: 1500, factor: 0.2, exponent: 0.85 }, // Short flights (500-1500km)
    { threshold: 4000, factor: 0.1, exponent: 0.8 }, // Medium flights - further reduced factor for better accuracy
    { threshold: 8000, factor: 0.08, exponent: 0.75 }, // Long flights (4000-8000km)
    { threshold: Infinity, factor: 0.05, exponent: 0.7 }, // Very long flights (>8000km)
  ];

  // Regional factors (multipliers based on regions)
  function getRegionalFactor(origin: string, destination: string): number {
    // Extract regions from origin and destination
    const originRegion = getRegion(origin);
    const destRegion = getRegion(destination);

    // Same region flights are typically cheaper due to competition
    if (originRegion === destRegion) {
      return 1.0; // Adjusted from 0.9 to better match observed prices in Asia
    }

    // Premium for flights between certain regions
    const premiumRoutes = [
      { from: "North America", to: "Asia", factor: 1.2 },
      { from: "Asia", to: "North America", factor: 1.2 },
      { from: "Europe", to: "Australia", factor: 1.3 },
      { from: "Australia", to: "Europe", factor: 1.3 },
      { from: "South America", to: "Asia", factor: 1.25 },
      { from: "Asia", to: "South America", factor: 1.25 },
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

function getRegion(location: string): string {
  const locationLower = location.toLowerCase();

  // Extract country if available
  let country = "";
  if (location.includes(",")) {
    country = location.split(",")[1].trim().toLowerCase();
  }

  // North America
  if (
    country.includes("united states") ||
    country.includes("usa") ||
    country.includes("canada") ||
    country.includes("mexico") ||
    locationLower.includes("new york") ||
    locationLower.includes("san francisco") ||
    locationLower.includes("los angeles") ||
    locationLower.includes("toronto") ||
    locationLower.includes("vancouver") ||
    locationLower.includes("mexico city")
  ) {
    return "North America";
  }

  // Europe
  if (
    country.includes("uk") ||
    country.includes("united kingdom") ||
    country.includes("france") ||
    country.includes("germany") ||
    country.includes("italy") ||
    country.includes("spain") ||
    country.includes("netherlands") ||
    country.includes("switzerland") ||
    country.includes("sweden") ||
    country.includes("norway") ||
    country.includes("denmark") ||
    country.includes("finland") ||
    country.includes("poland") ||
    country.includes("belgium") ||
    locationLower.includes("london") ||
    locationLower.includes("paris") ||
    locationLower.includes("berlin") ||
    locationLower.includes("rome") ||
    locationLower.includes("madrid") ||
    locationLower.includes("amsterdam") ||
    locationLower.includes("zurich") ||
    locationLower.includes("stockholm") ||
    locationLower.includes("oslo") ||
    locationLower.includes("copenhagen")
  ) {
    return "Europe";
  }

  // Asia
  if (
    country.includes("korea") ||
    country.includes("japan") ||
    country.includes("china") ||
    country.includes("taiwan") ||
    country.includes("hong kong") ||
    country.includes("singapore") ||
    country.includes("malaysia") ||
    country.includes("thailand") ||
    country.includes("vietnam") ||
    country.includes("india") ||
    locationLower.includes("seoul") ||
    locationLower.includes("tokyo") ||
    locationLower.includes("beijing") ||
    locationLower.includes("shanghai") ||
    locationLower.includes("taipei") ||
    locationLower.includes("hong kong") ||
    locationLower.includes("singapore") ||
    locationLower.includes("kuala lumpur") ||
    locationLower.includes("bangkok") ||
    locationLower.includes("mumbai")
  ) {
    return "Asia";
  }

  // Australia/Oceania
  if (
    country.includes("australia") ||
    country.includes("new zealand") ||
    locationLower.includes("sydney") ||
    locationLower.includes("melbourne") ||
    locationLower.includes("brisbane") ||
    locationLower.includes("auckland") ||
    locationLower.includes("wellington")
  ) {
    return "Australia";
  }

  // South America
  if (
    country.includes("brazil") ||
    country.includes("argentina") ||
    country.includes("chile") ||
    country.includes("colombia") ||
    country.includes("peru") ||
    locationLower.includes("são paulo") ||
    locationLower.includes("sao paulo") ||
    locationLower.includes("rio de janeiro") ||
    locationLower.includes("buenos aires") ||
    locationLower.includes("santiago") ||
    locationLower.includes("bogota") ||
    locationLower.includes("lima")
  ) {
    return "South America";
  }

  // Africa
  if (
    country.includes("south africa") ||
    country.includes("egypt") ||
    country.includes("morocco") ||
    country.includes("kenya") ||
    country.includes("nigeria") ||
    locationLower.includes("johannesburg") ||
    locationLower.includes("cape town") ||
    locationLower.includes("cairo") ||
    locationLower.includes("casablanca") ||
    locationLower.includes("nairobi") ||
    locationLower.includes("lagos")
  ) {
    return "Africa";
  }

  // Default to 'Other' if region can't be determined
  return "Other";
}

async function getAmadeusPrice(
  origin: string,
  destination: string,
  dates: { outbound: string; return: string }
): Promise<{ price: number | null; source: string }> {
  // Extract city names and convert to airport codes
  const originCity = origin.split(",")[0].trim();
  const destCity = destination.split(",")[0].trim();

  // Airport code mapping (extend as needed)
  const cityToCode: Record<string, string> = {
    Seoul: "ICN",
    Tokyo: "HND",
    Taipei: "TPE",
    "Hong Kong": "HKG",
    Singapore: "SIN",
    Bangkok: "BKK",
    "San Francisco": "SFO",
    "Los Angeles": "LAX",
    "New York": "JFK",
    London: "LHR",
    Paris: "CDG",
    Sydney: "SYD",
    Beijing: "PEK",
    Shanghai: "PVG",
  };

  const originCode = cityToCode[originCity];
  const destCode = cityToCode[destCity];

  if (!originCode || !destCode) {
    console.log("Could not find airport code for one of the cities:", originCity, destCity);
    return { price: null, source: "Amadeus API - Invalid city" };
  }

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
