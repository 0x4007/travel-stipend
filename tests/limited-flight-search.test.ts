import { findUpcomingConferences } from "../src/utils/flights";
import { FlightResults } from "../src/utils/types";
import { searchFlights } from "./utils/flight-search";

describe("Limited Flight Search Test", () => {
  jest.setTimeout(30000); // Increase timeout for API calls

  it("should find flights for first three upcoming conferences", async () => {
    const conferences = findUpcomingConferences(3);
    const results: FlightResults[] = [];
    console.log(`Processing ${conferences.length} upcoming conferences`);

    for (const conference of conferences) {
      console.log("\nSearching flights for conference:", conference.Conference);
      try {
        const result = await searchFlights(conference);
        results.push(result);

        // Validate each flight search result
        expect(result.best_flights).toBeDefined();
        expect(result.best_flights.length).toBeGreaterThan(0);

        const hasValidPrices = result.best_flights.some((flight) => typeof flight.price === "number" && flight.price > 0);
        expect(hasValidPrices).toBe(true);

        console.log(`Successfully found flights for ${conference.Conference}`);
      } catch (error) {
        console.error(`Error searching flights for ${conference.Conference}:`, error);
        throw error; // Re-throw to fail the test
      }
    }

    // Verify we got results for all conferences
    expect(results.length).toBe(conferences.length);
  });
});
