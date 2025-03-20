import { createHashKey, PersistentCache } from "./cache";
import { ORIGIN } from "./constants";
import { GoogleFlightsScraper } from "./google-flights-scraper";

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

  // Base cost parameters - increased to better match real-world prices
  const BASE_COST = 200; // Minimum cost for any flight (booking fees, taxes, etc.)

  // Multi-tier distance factors - adjusted to better match observed prices
  const DISTANCE_TIERS = [
    { threshold: 500, factor: 0.5, exponent: 0.9 }, // Very short flights (<500km)
    { threshold: 1500, factor: 0.4, exponent: 0.85 }, // Short flights (500-1500km)
    { threshold: 4000, factor: 0.25, exponent: 0.82 }, // Medium flights (1500-4000km)
    { threshold: 8000, factor: 0.15, exponent: 0.78 }, // Long flights (4000-8000km)
    { threshold: Infinity, factor: 0.08, exponent: 0.75 }, // Very long flights (>8000km)
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
      { from: "North America", to: "Asia", factor: 1.3 },
      { from: "Asia", to: "North America", factor: 1.3 },
      { from: "Europe", to: "Australia", factor: 1.4 },
      { from: "Australia", to: "Europe", factor: 1.4 },
      { from: "South America", to: "Asia", factor: 1.35 },
      { from: "Asia", to: "South America", factor: 1.35 },
    ];

    const premiumRoute = premiumRoutes.find((route) => route.from === originRegion && route.to === destRegion);

    return premiumRoute ? premiumRoute.factor : 1.1; // Default premium increased slightly
  }

  // Popular route discount (major city pairs often have more competition)
  function getPopularityFactor(origin: string, destination: string): number {
    const popularRoutes = [
      { cities: ["Seoul", "Tokyo"], factor: 0.9 },
      { cities: ["Seoul", "Beijing"], factor: 0.95 },
      { cities: ["Seoul", "Shanghai"], factor: 0.95 },
      { cities: ["Seoul", "Hong Kong"], factor: 1.0 }, // Adjusted to match observed price
      { cities: ["Seoul", "Singapore"], factor: 1.2 }, // Increased to match observed price
      { cities: ["Seoul", "Taipei"], factor: 1.1 }, // Added to match observed price
      { cities: ["Seoul", "Bangkok"], factor: 1.05 }, // Added to match observed price
      { cities: ["Seoul", "San Francisco"], factor: 1.0 },
      { cities: ["Seoul", "Los Angeles"], factor: 1.0 },
      { cities: ["Seoul", "New York"], factor: 1.0 },
      { cities: ["Seoul", "London"], factor: 1.0 },
      { cities: ["Seoul", "Paris"], factor: 1.0 },
      { cities: ["Seoul", "Sydney"], factor: 1.0 },
    ];

    // Check if this is a popular route (in either direction)
    const originCity = origin.split(",")[0].trim();
    const destCity = destination.split(",")[0].trim();

    const popularRoute = popularRoutes.find((route) => route.cities.includes(originCity) && route.cities.includes(destCity));

    return popularRoute ? popularRoute.factor : 1.0;
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


export async function scrapeFlightPrice(
  origin: string,
  destination: string,
  dates: { outbound: string; return: string }
): Promise<{ price: number | null; source: string }> {
  const cacheKey = createHashKey([origin, destination, dates.outbound, dates.return, "scraper-v1"]);

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

    if (results.success && results.prices.length > 0) {
      // Filter top flights
      const topFlights = results.prices.filter(flight => flight.isTopFlight);

      if (topFlights.length > 0) {
        // Calculate average of top flights
        const sum = topFlights.reduce((total, flight) => total + flight.price, 0);
        const avg = Math.round(sum / topFlights.length);

        // Store in cache only if we have a valid price
        if (avg > 0) {
          flightCache.set(cacheKey, {
            price: avg,
            timestamp: new Date().toISOString(),
            source: "Google Flights"
          });
          console.log(`Stored flight price in cache: $${avg} (from top flights)`);
        }

        return { price: avg, source: "Google Flights" };
      } else {
        // Calculate average of all flights
        const sum = results.prices.reduce((total, flight) => total + flight.price, 0);
        const avg = Math.round(sum / results.prices.length);

        // Store in cache only if we have a valid price
        if (avg > 0) {
          flightCache.set(cacheKey, {
            price: avg,
            timestamp: new Date().toISOString(),
            source: "Google Flights"
          });
          console.log(`Stored flight price in cache: $${avg} (from all flights)`);
        }

        return { price: avg, source: "Google Flights" };
      }
    }

    console.log("No flight prices found from scraper");
    return { price: null, source: "Scraping failed" };
  } catch (error) {
    console.error("Error scraping flight price:", error);
    return { price: null, source: "Scraping error" };
  }
}
