import { getJson } from "serpapi";
import { DEFAULT_DEPARTURE_AIRPORT } from "../../src/utils/constants";
import { generateFlightDates } from "../../src/utils/dates";
import { extractAirportCode } from "../../src/utils/flights";
import { Conference, FlightResults } from "../../src/utils/types";

export async function searchFlights(conference: Conference): Promise<FlightResults> {
  const dates = generateFlightDates(conference);
  const departureAirport = extractAirportCode(conference.Location);

  if (departureAirport === "Unknown") {
    throw new Error(`Could not find airport code for location: ${conference.Location}`);
  }

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

  return (await getJson(searchParams)) as FlightResults;
}
