import { findUpcomingConferences } from "../src/utils/flights";
import { searchFlights } from "./utils/flight-search";

describe("Flight Search Test", () => {
  jest.setTimeout(30000); // Increase timeout for API call

  it("should find flights for next conference with valid prices", async () => {
    const conference = findUpcomingConferences(1)[0];
    console.log("Searching flights for conference:", conference.Conference);

    const result = await searchFlights(conference);

    // Validate flight search results
    expect(result).toBeDefined();
    expect(result.best_flights).toBeDefined();
    expect(result.best_flights.length).toBeGreaterThan(0);

    // Check that we got valid prices
    const hasValidPrices = result.best_flights.some((flight) => typeof flight.price === "number" && flight.price > 0);
    expect(hasValidPrices).toBe(true);
  });
});
