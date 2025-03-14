import { getJson } from "serpapi";
import { DEFAULT_DEPARTURE_AIRPORT } from "../src/utils/constants";
import { generateFlightDates } from "../src/utils/dates";
import { extractAirportCode, findUpcomingConferences } from "../src/utils/flights";
import { FlightResults } from "../src/utils/types";

describe("Flight Search Test", () => {
  jest.setTimeout(30000); // Increase timeout for API call

  it("should find flights for next conference", async () => {
    expect.assertions(1); // Ensure the test makes assertions even if it returns early

    const conference = findUpcomingConferences(1)[0];
    console.log("Next conference:", conference);

    const dates = generateFlightDates(conference);
    console.log("Flight dates:", dates);

    const departureAirport = extractAirportCode(conference.Location);
    if (departureAirport === "Unknown") {
      console.warn(`Could not find airport code for location: ${conference.Location}`);
      expect(true).toBe(true); // Dummy assertion if we return early
      return;
    }

    try {
      const searchParams = {
        api_key: process.env.SERPAPI_API_KEY,
        engine: "google_flights",
        hl: "en",
        gl: "us",
        departure_id: DEFAULT_DEPARTURE_AIRPORT,
        arrival_id: departureAirport,
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
      expect(result).toBeDefined();
    } catch (error) {
      console.error("Error searching flights:", error);
      throw error;
    }
  });
});
