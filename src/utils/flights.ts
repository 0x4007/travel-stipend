import { parse } from "csv-parse/sync";
import { readFileSync } from "fs";
import { getJson } from "serpapi";
import { DEFAULT_DEPARTURE_AIRPORT } from "./constants";
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
  } catch (error) {
    console.error("Error extracting airport code:", error);
    return "Unknown";
  }
}

// Look up flight prices using SerpAPI
export async function lookupFlightPrice(destination: string, dates: { outbound: string; return: string }): Promise<number | null> {
  try {
    const searchParams = {
      api_key: process.env.SERPAPI_API_KEY,
      engine: "google_flights",
      hl: "en",
      gl: "us",
      departure_id: DEFAULT_DEPARTURE_AIRPORT,
      arrival_id: destination,
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
    const lowestPrice = result.best_flights.reduce(
      (min, flight) => {
        if (flight.price && (min === null || flight.price < min)) {
          return flight.price;
        }
        return min;
      },
      null as number | null
    );

    return lowestPrice;
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
