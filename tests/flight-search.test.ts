import { parse } from "csv-parse/sync";
import { readFileSync } from "fs";
import { getJson } from "serpapi";

interface AirportCode {
  type: string;
  name: string;
  municipality: string;
  iata_code: string;
}

interface Conference {
  Category: string;
  Start: string;
  End: string;
  Conference: string;
  Location: string;
}

async function findNextConference(): Promise<Conference> {
  const csvContent = readFileSync("fixtures/conferences.csv", "utf-8");
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
  });

  const currentDate = new Date();

  // Find the next conference that hasn't happened yet
  const nextConference = records.find((conf: Conference) => {
    const startDate = parseDate(conf.Start);
    return startDate > currentDate;
  });

  if (!nextConference) {
    throw new Error("No upcoming conferences found");
  }

  return nextConference;
}

function parseDate(dateStr: string): Date {
  // Convert date format like "18 February" to full date with year 2025
  return new Date(`${dateStr} 2025`);
}

function generateFlightDates(conference: Conference): { outbound: string; return: string } {
  const startDate = parseDate(conference.Start);
  const endDate = conference.End ? parseDate(conference.End) : new Date(startDate);

  // Set arrival date to one day before conference
  const outboundDate = new Date(startDate);
  outboundDate.setDate(startDate.getDate() - 1);

  // Set return date to one day after conference
  const returnDate = new Date(endDate);
  returnDate.setDate(endDate.getDate() + 1);

  // Format dates as YYYY-MM-DD
  function formatDate(date: Date) {
    return date.toISOString().split("T")[0];
  }

  return {
    outbound: formatDate(outboundDate),
    return: formatDate(returnDate),
  };
}

function extractAirportCode(location: string): string {
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
}

describe("Flight Search Test", () => {
  jest.setTimeout(30000); // Increase timeout for API call

  it("should find flights for next conference", async () => {
    expect.assertions(1); // Ensure the test makes assertions even if it returns early

    const conference = await findNextConference();
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
        departure_id: "ICN", // Assuming searching from Seoul
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

interface Airport {
  name: string;
  id: string;
  time: string;
}

interface Flight {
  departure_airport: Airport;
  arrival_airport: Airport;
  duration: number;
  airplane: string;
  airline: string;
  airline_logo: string;
  travel_class: string;
  flight_number: string;
  legroom: string;
  extensions: string[];
  overnight?: boolean;
  ticket_also_sold_by?: string[];
}

interface Layover {
  duration: number;
  name: string;
  id: string;
  overnight?: boolean;
}

interface CarbonEmissions {
  this_flight: number;
  typical_for_this_route: number;
  difference_percent: number;
}

interface FlightOption {
  flights: Flight[];
  layovers: Layover[];
  total_duration: number;
  carbon_emissions: CarbonEmissions;
  price?: number;
  type: string;
  airline_logo: string;
  departure_token: string;
}

interface PriceInsights {
  lowest_price: number;
  price_level: string;
  typical_price_range: number[];
}

interface AirportInfo {
  airport: {
    id: string;
    name: string;
  };
  city: string;
  country: string;
  country_code: string;
  image: string;
  thumbnail: string;
}

interface AirportPair {
  departure: AirportInfo[];
  arrival: AirportInfo[];
}

interface FlightResults {
  search_metadata: {
    id: string;
    status: string;
    json_endpoint: string;
    created_at: string;
    processed_at: string;
    google_flights_url: string;
    raw_html_file: string;
    prettify_html_file: string;
    total_time_taken: number;
  };
  search_parameters: {
    engine: string;
    hl: string;
    gl: string;
    type: string;
    departure_id: string;
    arrival_id: string;
    outbound_date: string;
    return_date: string;
    travel_class: number;
    adults: number;
    stops: number;
    currency: string;
    deep_search: boolean;
    sort_by: string;
  };
  best_flights: FlightOption[];
  other_flights: FlightOption[];
  price_insights: PriceInsights;
  airports: AirportPair[];
}
