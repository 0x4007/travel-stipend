import { FlightResults } from "../src/types";
import { findUpcomingConferences } from "../src/utils/flights";
import { searchFlights } from "./utils/flight-search";

describe("Limited Flight Search Test", () => {
  jest.setTimeout(30000); // Increase timeout for API calls

  it("should find flights for first three upcoming conferences", async () => {
    const conferences = findUpcomingConferences(3);
    const results: FlightResults[] = [];

    for (const conference of conferences) {
      console.log("\nConference details:");
      console.table({
        name: conference.Conference,
        location: conference.Location,
        start: conference.Start,
        end: conference.End,
      });

      try {
        const result = await searchFlights(conference);
        results.push(result);

        // Display flight options
        console.log("Flight options:");
        const flightData = result.best_flights.map((flight) => ({
          price: flight.price ? `$${flight.price}` : "N/A",
          duration: flight.flights?.[0]?.duration ? `${Math.round(flight.flights[0].duration / 60)}h ${flight.flights[0].duration % 60}m` : "N/A",
          airline: flight.flights?.[0]?.airline || "N/A",
          departure: flight.flights?.[0]?.departure_airport?.time || "N/A",
          arrival: flight.flights?.[0]?.arrival_airport?.time || "N/A",
          stops: flight.flights?.length - 1 || "N/A",
        }));
        console.table(flightData);

        // Additional insights if available
        if (result.price_insights) {
          console.log("\nPrice insights:");
          console.table({
            lowestPrice: `$${result.price_insights.lowest_price}`,
            priceLevel: result.price_insights.price_level,
            typicalRange: result.price_insights.typical_price_range.map((p) => `$${p}`).join(" - "),
          });
        }

        console.log(`Successfully found flights for ${conference.Conference}\n`);
      } catch (error) {
        console.error(`Error searching flights for ${conference.Conference}:`, error);
        throw error;
      }
    }

    // Verify we got results for all conferences
    expect(results.length).toBe(conferences.length);
    results.forEach((result) => {
      expect(result.best_flights.length).toBeGreaterThan(0);
      expect(result.best_flights.some((f) => typeof f.price === "number" && f.price > 0)).toBe(true);
    });
  });
});
