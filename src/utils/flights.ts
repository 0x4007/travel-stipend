import { parse } from "csv-parse/sync";
import { readFileSync } from "fs";
import { getJson } from "serpapi";
import { createHashKey, PersistentCache } from "./cache";
import { DEFAULT_DEPARTURE_AIRPORT, ORIGIN } from "./constants";
import { haversineDistance } from "./distance";
import { AirportCode, Conference, FlightResults } from "./types";

// Extract airport code from location string
export function extractAirportCode(location: string): string {
  try {
    // Read and parse the airport codes CSV
    const csvContent = readFileSync("fixtures/airport-codes.csv", "utf-8");
    const airports = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
    }) as AirportCode[];

    // Extract city name from location (e.g., "New York, USA" -> "New York")
    const city = location.split(",")[0].trim();

    // Filter for large airports in the target city
    let cityAirports = airports.filter((a) => a.type === "large_airport" && a.iata_code && a.municipality?.toLowerCase().includes(city.toLowerCase()));

    // If no airports found by city name, try a broader search
    if (cityAirports.length === 0) {
      console.log(`No exact match for city: ${city}, trying broader search...`);

      // Try partial matching (any part of municipality name)
      cityAirports = airports.filter(
        (a) =>
          a.type === "large_airport" &&
          a.iata_code &&
          a.municipality &&
          (a.municipality.toLowerCase().includes(city.toLowerCase()) || city.toLowerCase().includes(a.municipality.toLowerCase()))
      );

      // If still no matches, get all large airports in the country if country is specified
      if (cityAirports.length === 0 && location.includes(",")) {
        const country = location.split(",")[1].trim();
        console.log(`Trying to find airports in country: ${country}`);

        // Get all large airports in the country
        cityAirports = airports.filter((a) => a.type === "large_airport" && a.iata_code && a.name.toLowerCase().includes(country.toLowerCase()));
      }

      // If still no matches, just get the first few large airports with IATA codes
      if (cityAirports.length === 0) {
        console.log(`Falling back to any large airport with IATA code`);
        cityAirports = airports.filter((a) => a.type === "large_airport" && a.iata_code).slice(0, 5);
      }

      if (cityAirports.length === 0) {
        throw new Error(`No airports found for location: ${location}`);
      }
    }

    // If only one airport, return it
    if (cityAirports.length === 1) {
      console.log(`Found airport: ${cityAirports[0].name} (${cityAirports[0].iata_code}) for ${location}`);
      return cityAirports[0].iata_code;
    }

    // For multiple airports, find the closest one to city center or just pick the first one
    let closestAirport = cityAirports[0];

    try {
      const cityCenter = {
        lat: parseFloat(cityAirports[0].coordinates.split(",")[0]),
        lng: parseFloat(cityAirports[0].coordinates.split(",")[1]),
      };

      let shortestDistance = Number.MAX_VALUE;

      for (const airport of cityAirports) {
        const airportCoords = {
          lat: parseFloat(airport.coordinates.split(",")[0]),
          lng: parseFloat(airport.coordinates.split(",")[1]),
        };
        const distance = haversineDistance(cityCenter, airportCoords);
        if (distance < shortestDistance) {
          shortestDistance = distance;
          closestAirport = airport;
        }
      }
    } catch (coordError) {
      console.error("Error calculating closest airport:", coordError);
      // Just use the first airport if there's an error with coordinates
    }

    console.log(`Selected airport: ${closestAirport.name} (${closestAirport.iata_code}) for ${location}`);
    return closestAirport.iata_code;
  } catch (error) {
    console.error("Error extracting airport code:", error);
    return "Unknown";
  }
}

// Initialize flight cache
const flightCache = new PersistentCache<{ price: number; timestamp: string }>("fixtures/cache/flight-cache.json");
const flightCostCache = new PersistentCache<number>("fixtures/cache/flight-cost-cache.json");

/**
 * Enhanced flight cost estimation model based on distance and regional factors.
 * This model uses a multi-tier approach with regional adjustments to better
 * approximate real-world flight pricing patterns.
 *
 * @param distanceKm - Distance in kilometers between origin and destination
 * @param destination - Destination city/country
 * @param origin - Origin city/country (defaults to ORIGIN constant)
 * @returns Estimated flight cost in USD
 */
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

/**
 * Helper function to determine the region of a location
 * @param location - Location string in format "City, Country"
 * @returns Region name
 */
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

// Look up flight prices using SerpAPI
export async function lookupFlightPrice(destination: string, dates: { outbound: string; return: string }): Promise<number | null> {
  const cacheKey = createHashKey([destination, dates.outbound, dates.return]);

  // Check cache first
  const cachedData = flightCache.get(cacheKey);
  if (cachedData) {
    console.log(`Using cached flight price from ${cachedData.timestamp}`);
    return cachedData.price;
  }
  try {
    const arrivalCode = extractAirportCode(destination);
    if (arrivalCode === "Unknown") {
      console.error(`Could not find airport code for ${destination}`);
      return null;
    }

    const searchParams = {
      api_key: process.env.SERPAPI_API_KEY,
      engine: "google_flights",
      hl: "en",
      gl: "us",
      departure_id: DEFAULT_DEPARTURE_AIRPORT,
      arrival_id: arrivalCode,
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

    // Handle case where best_flights is undefined or empty
    if (!result.best_flights || result.best_flights.length === 0) {
      console.error(`No flights found for ${destination}`);
      return null;
    }

    // Get the lowest price from best_flights
    const lowestPrice = result.best_flights.reduce(
      (min, flight) => {
        if (flight.price && (min === null || flight.price < min)) {
          return flight.price;
        }
        return min;
      },
      null as number | null
    );

    if (lowestPrice !== null) {
      // Store price and timestamp in cache
      flightCache.set(cacheKey, {
        price: lowestPrice,
        timestamp: new Date().toISOString(),
      });
      return lowestPrice;
    }

    return null;
  } catch (error) {
    console.error("Error looking up flight price:", error);
    return null;
  }
}

// Find upcoming conferences from CSV file
export function findUpcomingConferences(limit?: number): Conference[] {
  try {
    const csvContent = readFileSync("fixtures/conferences.csv", "utf-8");
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
    });

    const currentDate = new Date();

    // Find conferences that haven't happened yet
    const upcomingConferences = records
      .filter((conf: Conference) => {
        const startDate = new Date(`${conf.Start} 2025`);
        return startDate > currentDate;
      })
      .slice(0, limit); // Take only the first 'limit' conferences if specified

    if (upcomingConferences.length === 0) {
      throw new Error("No upcoming conferences found");
    }

    return upcomingConferences;
  } catch (error) {
    console.error("Error finding upcoming conferences:", error);
    throw error;
  }
}
