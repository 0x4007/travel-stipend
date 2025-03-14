import { parse } from "csv-parse/sync";
import { readFileSync } from "fs";
import { getJson } from "serpapi";
import { createHashKey, PersistentCache } from "./cache";
import { DEFAULT_DEPARTURE_AIRPORT } from "./constants";
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
    const cityAirports = airports.filter((a) => a.type === "large_airport" && a.iata_code && a.municipality?.toLowerCase().includes(city.toLowerCase()));

    if (cityAirports.length === 0) {
      throw new Error(`No airports found for city: ${city}`);
    }

    // If only one airport, return it
    if (cityAirports.length === 1) {
      return cityAirports[0].iata_code;
    }

    // For multiple airports, find the closest one to city center
    const cityCenter = {
      lat: parseFloat(cityAirports[0].coordinates.split(",")[0]),
      lng: parseFloat(cityAirports[0].coordinates.split(",")[1]),
    };

    let closestAirport = cityAirports[0];
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

    return closestAirport.iata_code;
  } catch (error) {
    console.error("Error extracting airport code:", error);
    return "Unknown";
  }
}

// Initialize flight cache
const flightCache = new PersistentCache<{ price: number; timestamp: string }>("fixtures/cache/flight-cache.json");

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
