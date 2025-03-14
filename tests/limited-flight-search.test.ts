import { getJson } from "serpapi";
import { BASE_LODGING_PER_NIGHT, BASE_MEALS_PER_DAY, COST_PER_KM, DEFAULT_DEPARTURE_AIRPORT, DEFAULT_TICKET_PRICE, ORIGIN } from "../src/utils/constants";
import { loadCoordinatesData } from "../src/utils/coordinates";
import { getCostOfLivingFactor, loadCostOfLivingData } from "../src/utils/cost-of-living";
import { calculateDateDiff, generateFlightDates } from "../src/utils/dates";
import { getDistanceKmFromCities } from "../src/utils/distance";
import { extractAirportCode, findUpcomingConferences } from "../src/utils/flights";
import { FlightResults, StipendBreakdown } from "../src/utils/types";

describe("Limited Flight Search Test", () => {
  jest.setTimeout(30000); // Increase timeout for API calls

  it("should find flights for first three upcoming conferences", async () => {
    const conferences = findUpcomingConferences(3);
    const results: StipendBreakdown[] = [];
    console.log(`Processing ${conferences.length} upcoming conferences`);

    // Load required data
    const cityCoordinates = loadCoordinatesData("fixtures/coordinates.csv");
    const costOfLivingMapping = loadCostOfLivingData("fixtures/cost_of_living.csv");

    for (const conference of conferences) {
      console.log("\nProcessing conference:", conference.Conference);

      const dates = generateFlightDates(conference);
      console.log("Flight dates:", dates);

      const departureAirport = extractAirportCode(conference.Location);
      if (departureAirport === "Unknown") {
        console.warn(`Could not find airport code for location: ${conference.Location}`);
        continue;
      }

      // Calculate common values needed for both API and fallback cases
      const numberOfNights = calculateDateDiff(conference.Start, conference.End);
      const numberOfMealDays = numberOfNights + 1;
      const colFactor = getCostOfLivingFactor(conference.Location, costOfLivingMapping);
      const lodgingCost = BASE_LODGING_PER_NIGHT * colFactor * numberOfNights;
      const mealsCost = BASE_MEALS_PER_DAY * colFactor * numberOfMealDays;

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

        // Get the lowest price from best_flights
        const flightCost = result.best_flights.reduce(
          (min, flight) => {
            if (flight.price && (min === null || flight.price < min)) {
              return flight.price;
            }
            return min;
          },
          null as number | null
        );

        if (!flightCost) {
          throw new Error("No flight price found in API response");
        }

        const breakdown: StipendBreakdown = {
          conference: conference.Conference,
          location: conference.Location,
          distance_km: 0, // Not needed when we have actual flight prices
          flight_cost: Math.round(flightCost * 100) / 100,
          lodging_cost: Math.round(lodgingCost * 100) / 100,
          meals_cost: Math.round(mealsCost * 100) / 100,
          ticket_price: DEFAULT_TICKET_PRICE,
          total_stipend: Math.round((flightCost + lodgingCost + mealsCost + DEFAULT_TICKET_PRICE) * 100) / 100,
        };

        results.push(breakdown);
        console.log(`Successfully found flights for ${conference.Conference}`);
      } catch (error) {
        console.error(`Error searching flights for ${conference.Conference}:`, error);
        console.log("Falling back to distance-based calculation");

        // Only calculate distance when we need it as a fallback
        const distanceKm = getDistanceKmFromCities(ORIGIN, conference.Location, cityCoordinates);
        const flightCost = distanceKm * COST_PER_KM;

        const breakdown: StipendBreakdown = {
          conference: conference.Conference,
          location: conference.Location,
          distance_km: Math.round(distanceKm * 10) / 10,
          flight_cost: Math.round(flightCost * 100) / 100,
          lodging_cost: Math.round(lodgingCost * 100) / 100,
          meals_cost: Math.round(mealsCost * 100) / 100,
          ticket_price: DEFAULT_TICKET_PRICE,
          total_stipend: Math.round((flightCost + lodgingCost + mealsCost + DEFAULT_TICKET_PRICE) * 100) / 100,
        };
        results.push(breakdown);
      }
    }

    // Display results in a table format
    console.log("\nFlight Search Results:");
    console.table(results);
    expect(results.length).toBeGreaterThan(0);
  });
});
