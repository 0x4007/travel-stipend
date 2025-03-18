import { findUpcomingConferences } from "../src/utils/flights";
import { searchFlights } from "./utils/flight-search";

describe("Single Flight Search Test", () => {
  jest.setTimeout(30000); // Increase timeout for API call

  it("should find flights for next conference with valid prices", async () => {
    const conference = findUpcomingConferences(1)[0];
    console.log("\nNext conference details:");
    console.table({
      name: conference.Conference,
      location: conference.Location,
      start: conference.Start,
      end: conference.End,
    });

    const result = await searchFlights(conference);

    // Display flight options
    console.log("\nFlight options:");
    const flightData = result.best_flights.map((flight) => ({
      price: flight.price ? `$${flight.price}` : "N/A",
      duration: flight.flights?.[0]?.duration ? `${Math.round(flight.flights[0].duration / 60)}h ${flight.flights[0].duration % 60}m` : "N/A",
      airline: flight.flights?.[0]?.airline || "N/A",
      departure: flight.flights?.[0]?.departure_airport?.time || "N/A",
      arrival: flight.flights?.[0]?.arrival_airport?.time || "N/A",
      stops: flight.flights?.length - 1 || "N/A",
    }));
    console.table(flightData);

    // Validate we got flight results
    expect(result.best_flights.length).toBeGreaterThan(0);
    expect(flightData.some((f) => f.price !== "N/A")).toBe(true);
  });
});
