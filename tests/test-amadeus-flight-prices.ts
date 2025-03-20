import { config } from "dotenv";
import { getAirlineAlliance, isMajorCarrier } from "../src/utils/airline-alliances";
import { createHashKey, isWithinSixHours, PersistentCache } from "../src/utils/cache";

// Load environment variables
config();

if (!process.env.AMADEUS_API_KEY || !process.env.AMADEUS_API_SECRET) {
  console.error("Missing required environment variables. Please check your .env file.");
  process.exit(1);
}

// API Response Types
interface AmadeusFlightOffer {
  price: {
    total: string;
  };
  validatingAirlineCodes: string[];
  itineraries: FlightItinerary[];
}

interface AmadeusApiResponse {
  data?: AmadeusFlightOffer[];
}

// Flight Data Types
interface FlightSegment {
  departure: { iataCode: string; at: string };
  arrival: { iataCode: string; at: string };
  carrierCode: string;
  number: string;
  duration: string;
}

interface FlightItinerary {
  segments: FlightSegment[];
}

interface FlightOption {
  price: number;
  airline: string;
  itineraries: FlightItinerary[];
}

interface FlightDataResponse {
  success: boolean;
  price: number | null;
  source: string;
  rawData?: unknown;
  prices?: FlightOption[];
  allPrices?: FlightOption[];
  filteredForMajorCarriers?: boolean;
}

// Amadeus API client for flight price fetching
class AmadeusApi {
  private _apiKey: string;
  private _apiSecret: string;
  private _accessToken: string | null = null;
  private _tokenExpiry: number = 0;
  private _cache: PersistentCache<{ price: number; timestamp: string; source: string }>;
  private _filterMajorCarriersOnly: boolean;

  // Public accessor for filter setting
  set filterMajorCarriersOnly(value: boolean) {
    this._filterMajorCarriersOnly = value;
  }

  get filterMajorCarriersOnly(): boolean {
    return this._filterMajorCarriersOnly;
  }

  constructor(apiKey: string, apiSecret: string, filterMajorCarriersOnly: boolean = true) {
    this._apiKey = apiKey;
    this._apiSecret = apiSecret;
    this._filterMajorCarriersOnly = filterMajorCarriersOnly;
    this._cache = new PersistentCache<{ price: number; timestamp: string; source: string }>("fixtures/cache/amadeus-flight-cache.json");
  }

  private async _getAccessToken(): Promise<string> {
    // Check if we have a valid token
    const now = Date.now();
    if (this._accessToken && now < this._tokenExpiry) {
      return this._accessToken;
    }

    console.log("Getting new Amadeus access token...");

    try {
      const response = await fetch("https://test.api.amadeus.com/v1/security/oauth2/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "client_credentials",
          client_id: this._apiKey,
          client_secret: this._apiSecret,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Token request failed:", errorText);
        throw new Error(`Failed to get access token: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      this._accessToken = data.access_token;
      // Set expiry time (convert seconds to milliseconds and subtract a buffer)
      this._tokenExpiry = now + data.expires_in * 1000 - 60000; // 1 minute buffer

      return this._accessToken as string;
    } catch (error: unknown) {
      console.error("Error getting Amadeus access token:", error);
      throw error;
    }
  }

  private _createCacheKey(originLocationCode: string, destinationLocationCode: string, departureDate: string, returnDate: string, adults: number): string {
    return createHashKey([
      originLocationCode,
      destinationLocationCode,
      departureDate,
      returnDate,
      adults.toString(),
      this._filterMajorCarriersOnly ? "amadeus-major-carriers-v1" : "amadeus-v1",
    ]);
  }

  private _checkCache(cacheKey: string): { shouldFetch: boolean; cachedResult?: FlightDataResponse } {
    console.log(`Checking cache with key: ${cacheKey}`);
    const cachedData = this._cache.get(cacheKey);

    if (!cachedData) {
      console.log("No cache entry found, fetching from API");
      return { shouldFetch: true };
    }

    if (isWithinSixHours(cachedData.timestamp)) {
      console.log(`Using cached flight price from ${cachedData.timestamp} (${cachedData.source})`);
      return {
        shouldFetch: false,
        cachedResult: { success: true, price: cachedData.price, source: cachedData.source },
      };
    }

    console.log(`Cached data from ${cachedData.timestamp} is older than 6 hours, fetching new data`);
    return { shouldFetch: true };
  }

  async searchFlights(
    originLocationCode: string,
    destinationLocationCode: string,
    departureDate: string,
    returnDate: string,
    adults: number = 1
  ): Promise<FlightDataResponse> {
    const cacheKey = this._createCacheKey(originLocationCode, destinationLocationCode, departureDate, returnDate, adults);
    // Check cache and return if valid
    const { shouldFetch, cachedResult } = this._checkCache(cacheKey);
    if (!shouldFetch && cachedResult) {
      return cachedResult;
    }

    try {
      // Get access token
      const token = await this._getAccessToken();

      // Build URL with query parameters
      const url = new URL("https://test.api.amadeus.com/v2/shopping/flight-offers");
      url.searchParams.append("originLocationCode", originLocationCode);
      url.searchParams.append("destinationLocationCode", destinationLocationCode);
      url.searchParams.append("departureDate", departureDate);
      url.searchParams.append("returnDate", returnDate);
      url.searchParams.append("adults", adults.toString());
      url.searchParams.append("currencyCode", "USD");
      url.searchParams.append("max", "100"); // Request more results for better sampling
      // Allow both direct and connecting flights for better options
      url.searchParams.append("nonStop", "false");
      // Request standard economy class and filter out business/first
      url.searchParams.append("travelClass", "ECONOMY");
      url.searchParams.append("maxPrice", "5000"); // Set a reasonable max price instead of maxConnections

      console.log(`Searching flights from ${originLocationCode} to ${destinationLocationCode}`);
      console.log(`Dates: ${departureDate} to ${returnDate}`);

      // Make API request with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

      console.log("Sending request to Amadeus API...");
      const response = await fetch(url.toString(), {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        signal: controller.signal,
      }).finally(() => clearTimeout(timeoutId));

      console.log(`Received response with status: ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Flight search failed:", errorText);
        throw new Error(`Flight search failed: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as AmadeusApiResponse;
      return (await this._processFlightData(data, cacheKey)) || { success: false, price: null, source: "Amadeus API - No results" };
    } catch (error: unknown) {
      console.error("Error searching flights with Amadeus API:", error);
      return { success: false, price: null, source: "Amadeus API error" };
    }
  }

  private async _processFlightData(data: AmadeusApiResponse, cacheKey: string): Promise<FlightDataResponse | null> {
    if (!data.data || data.data.length === 0) {
      console.log("No flight prices found from Amadeus API");
      return null;
    }

    // Extract prices from offers
    const prices = data.data.map((offer: AmadeusFlightOffer) => ({
      price: parseFloat(offer.price.total),
      airline: offer.validatingAirlineCodes[0],
      itineraries: offer.itineraries as FlightItinerary[],
    }));

    // Filter for major carriers if requested
    let flightsToUse = prices;
    const sourceDescription = "Amadeus API";

    if (this._filterMajorCarriersOnly) {
      // Filter for major carriers only, checking all segments
      const majorCarrierFlights = prices.filter((flight) => {
        // Check validating airline
        if (!isMajorCarrier(flight.airline)) {
          return false;
        }

        // Check all segments in both outbound and return itineraries
        return flight.itineraries.every((itinerary) => itinerary.segments.every((segment) => isMajorCarrier(segment.carrierCode)));
      });

      // Only use major carrier flights if we found some
      if (majorCarrierFlights.length > 0) {
        flightsToUse = majorCarrierFlights;
        console.log(`Filtered to ${majorCarrierFlights.length} major carrier flights out of ${prices.length} total flights`);

        // Log the airlines and their alliances
        majorCarrierFlights.forEach((flight) => {
          const alliance = getAirlineAlliance(flight.airline);
          console.log(`  - ${flight.airline}: ${alliance} - $${flight.price}`);

          // Log each segment's operating airline
          flight.itineraries.forEach((itinerary, i) => {
            console.log(`    ${i === 0 ? "Outbound" : "Return"} segments:`);
            itinerary.segments.forEach((segment) => {
              const segmentAlliance = getAirlineAlliance(segment.carrierCode);
              console.log(`      - ${segment.carrierCode}: ${segmentAlliance}`);
            });
          });
        });
      } else {
        console.log("No major carrier flights found, using all flights");
      }
    }

    // Group flights by airline for better filtering
    const airlineGroups = new Map<string, FlightOption[]>();
    flightsToUse.forEach((flight) => {
      const group = airlineGroups.get(flight.airline) || [];
      group.push(flight);
      airlineGroups.set(flight.airline, group);
    });

    // Calculate simple average price from all valid flights
    const avgPrice = Math.round(flightsToUse.reduce((sum, flight) => sum + flight.price, 0) / flightsToUse.length);

    // Store in cache
    console.log(`Storing result in cache with key: ${cacheKey}`);
    this._cache.set(cacheKey, {
      price: avgPrice,
      timestamp: new Date().toISOString(),
      source: sourceDescription,
    });
    // Save cache to disk
    this._cache.saveToDisk();
    console.log("Cache entry created and saved to disk");

    return {
      success: true,
      price: avgPrice,
      source: sourceDescription,
      rawData: data,
      prices: flightsToUse,
      allPrices: prices,
      filteredForMajorCarriers: this._filterMajorCarriersOnly,
    };
  }
}

function cityToAirportCode(city: string): string {
  const cityMapping: Record<string, string> = {
    Seoul: "ICN",
    Tokyo: "HND",
    Taipei: "TPE",
    "Hong Kong": "HKG",
    Singapore: "SIN",
    Bangkok: "BKK",
    "San Francisco": "SFO",
    "Los Angeles": "LAX",
    "New York": "JFK",
    London: "LHR",
    Paris: "CDG",
    Sydney: "SYD",
    Beijing: "PEK",
    Shanghai: "PVG",
  };

  // Extract city name from "City, Country" format
  const cityName = city.split(",")[0].trim();

  return cityMapping[cityName] || "Unknown";
}

/**
 * Test a single route with both all airlines and major carriers only
 */
async function testRoute(from: string, to: string, departureDate: string, returnDate: string): Promise<void> {
  // Convert city names to IATA airport codes
  const originCode = cityToAirportCode(from);
  const destinationCode = cityToAirportCode(to);

  if (originCode === "Unknown" || destinationCode === "Unknown") {
    console.error(`Could not determine airport codes for ${from} to ${to}`);
    return;
  }

  console.log(`\n\n========== TESTING ROUTE: ${from} (${originCode}) to ${to} (${destinationCode}) ==========`);
  console.log(`Departure: ${departureDate}, Return: ${returnDate}`);

  // Get API credentials from environment
  const credentials = getAmadeusCredentials();

  if (!credentials) {
    console.error("Missing API credentials");
    return;
  }

  try {
    // Search with major carriers only
    console.log("\n=== SEARCHING WITH MAJOR CARRIERS ONLY (ALLIANCE MEMBERS) ===");
    const api = new AmadeusApi(credentials.apiKey, credentials.apiSecret, true);
    const flightData = await api.searchFlights(originCode, destinationCode, departureDate, returnDate);

    // Display flight data
    displayFlightData(flightData, "Major Carriers");
  } catch (error: unknown) {
    console.error(`Error testing route ${from} to ${to}:`, error);
  }
}

async function main() {
  console.log("Starting Amadeus API flight price test with major carrier filtering...");

  // Get date for next week
  const today = new Date();
  const nextWeek = new Date(today);
  nextWeek.setDate(today.getDate() + 7);

  // Format departure date (next week, same day of the week)
  const departureDate = `${nextWeek.getFullYear()}-${String(nextWeek.getMonth() + 1).padStart(2, "0")}-${String(nextWeek.getDate()).padStart(2, "0")}`;

  // Format return date (departure + 7 days)
  const returnDay = new Date(nextWeek);
  returnDay.setDate(returnDay.getDate() + 7);
  const returnDate = `${returnDay.getFullYear()}-${String(returnDay.getMonth() + 1).padStart(2, "0")}-${String(returnDay.getDate()).padStart(2, "0")}`;

  // Test multiple routes to better demonstrate the difference between all airlines and major carriers
  const routes = [
    { from: "Seoul, South Korea", to: "Taipei, Taiwan" }, // Short-haul route with mix of carriers
    { from: "Seoul, South Korea", to: "Bangkok, Thailand" }, // Medium-haul route with many budget options
    { from: "Seoul, South Korea", to: "Singapore, Singapore" }, // Medium-haul route popular with alliances
  ];

  // Test each route
  for (const route of routes) {
    await testRoute(route.from, route.to, departureDate, returnDate);
  }

  console.log("\n\nTest completed. Summary of findings:");
  console.log("- Major carriers (alliance members) may have different pricing than budget airlines");
  console.log("- The price difference varies by route and time of booking");
  console.log("- Filtering for major carriers ensures higher quality service and better connections");
}

function displayFlightData(flightData: FlightDataResponse, label: string): void {
  console.log(`\n${label} Flight Search Results:`);
  console.log("=".repeat(label.length + 20));

  if (flightData.success) {
    console.log(`Average price: $${flightData.price}`);
    console.log(`Source: ${flightData.source}`);

    if (flightData.prices && flightData.prices.length > 0) {
      console.log(`\nFound ${flightData.prices.length} flight options:`);

      flightData.prices.forEach((flight, index) => {
        const alliance = getAirlineAlliance(flight.airline);
        console.log(`\nOption ${index + 1}:`);
        console.log(`Price: $${flight.price}`);

        const allianceInfo = alliance ? ` (${alliance})` : " (Not in alliance)";

        console.log(`Airline: ${flight.airline}${allianceInfo}`);

        // Display itinerary details (simplified for brevity)
        if (index === 0) {
          // Only show details for the first option to keep output manageable
          flight.itineraries.forEach((itinerary, itIndex) => {
            console.log(`\n  ${itIndex === 0 ? "Outbound" : "Return"} journey:`);

            itinerary.segments.forEach((segment, segIndex) => {
              console.log(`    Segment ${segIndex + 1}: ${segment.carrierCode} ${segment.number}`);
              console.log(`    From: ${segment.departure.iataCode} at ${segment.departure.at}`);
              console.log(`    To: ${segment.arrival.iataCode} at ${segment.arrival.at}`);
            });
          });
        }
      });

      // If we have all prices data, show airline distribution
      if (flightData.allPrices && flightData.allPrices.length > 0) {
        console.log("\nAirline Distribution:");
        const airlineCount: Record<string, number> = {};

        flightData.allPrices.forEach((flight) => {
          airlineCount[flight.airline] = (airlineCount[flight.airline] || 0) + 1;
        });

        Object.entries(airlineCount).forEach(([airline, count]) => {
          const alliance = getAirlineAlliance(airline);

          const allianceInfo = alliance ? ` (${alliance})` : " (Not in alliance)";

          console.log(`  ${airline}: ${count} flights${allianceInfo}`);
        });
      }
    }
  } else {
    console.log("No flight data found or search failed");
    console.log(`Source: ${flightData.source}`);
  }
}

// Run the main function
// Helper function to get and validate API credentials
function getAmadeusCredentials(): { apiKey: string; apiSecret: string } | null {
  const apiKey = process.env.AMADEUS_API_KEY;
  const apiSecret = process.env.AMADEUS_API_SECRET;

  if (!apiKey || !apiSecret) {
    return null;
  }

  return { apiKey, apiSecret };
}

main().catch(console.error);
