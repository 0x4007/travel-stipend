import { createHashKey, PersistentCache } from "../src/utils/cache";

// Amadeus API client for flight price fetching
class AmadeusApi {
  private _apiKey: string;
  private _apiSecret: string;
  private _accessToken: string | null = null;
  private _tokenExpiry: number = 0;
  private _cache: PersistentCache<{ price: number; timestamp: string; source: string }>;

  constructor(apiKey: string, apiSecret: string) {
    this._apiKey = apiKey;
    this._apiSecret = apiSecret;
    this._cache = new PersistentCache<{ price: number; timestamp: string; source: string }>(
      "fixtures/cache/amadeus-flight-cache.json"
    );
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
        throw new Error(`Failed to get access token: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      this._accessToken = data.access_token;
      // Set expiry time (convert seconds to milliseconds and subtract a buffer)
      this._tokenExpiry = now + (data.expires_in * 1000) - 60000; // 1 minute buffer

      return this._accessToken as string;
    } catch (error) {
      console.error("Error getting Amadeus access token:", error);
      throw error;
    }
  }

  
  async searchFlights(
    originLocationCode: string,
    destinationLocationCode: string,
    departureDate: string,
    returnDate: string,
    adults: number = 1
  ) {
    // Create cache key
    const cacheKey = createHashKey([
      originLocationCode,
      destinationLocationCode,
      departureDate,
      returnDate,
      adults.toString(),
      "amadeus-v1",
    ]);

    // Check cache first
    console.log(`Checking cache with key: ${cacheKey}`);
    const cachedData = this._cache.get(cacheKey);
    if (cachedData) {
      console.log(`Using cached flight price from ${cachedData.timestamp} (${cachedData.source})`);
      return { success: true, price: cachedData.price, source: cachedData.source };
    } else {
      console.log("No cache entry found, fetching from API");
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
      url.searchParams.append("max", "5"); // Limit to 5 results for testing

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
        },
        signal: controller.signal,
      }).finally(() => clearTimeout(timeoutId));

      console.log(`Received response with status: ${response.status}`);

      if (!response.ok) {
        throw new Error(`Flight search failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      // Process and return results
      if (data.data && data.data.length > 0) {
        // Extract prices from offers
        const prices = data.data.map((offer: { price: { total: string }; validatingAirlineCodes: string[]; itineraries: unknown }) => ({
          price: parseFloat(offer.price.total),
          airline: offer.validatingAirlineCodes[0],
          itineraries: offer.itineraries,
        }));

        // Calculate average price
        const sum = prices.reduce((total: number, flight: { price: number }) => total + flight.price, 0);
        const avgPrice = Math.round(sum / prices.length);

        // Store in cache
        console.log(`Storing result in cache with key: ${cacheKey}`);
        this._cache.set(cacheKey, {
          price: avgPrice,
          timestamp: new Date().toISOString(),
          source: "Amadeus API",
        });
        // Save cache to disk
        (this._cache as PersistentCache<any>).saveToDisk();
        console.log("Cache entry created and saved to disk");

        return {
          success: true,
          price: avgPrice,
          source: "Amadeus API",
          rawData: data,
          prices: prices,
        };
      }

      console.log("No flight prices found from Amadeus API");
      return { success: false, price: null, source: "Amadeus API - No results" };
    } catch (error) {
      console.error("Error searching flights with Amadeus API:", error);
      return { success: false, price: null, source: "Amadeus API error" };
    }
  }
}


function cityToAirportCode(city: string): string {
  const cityMapping: Record<string, string> = {
    "Seoul": "ICN",
    "Tokyo": "HND",
    "Taipei": "TPE",
    "Hong Kong": "HKG",
    "Singapore": "SIN",
    "Bangkok": "BKK",
    "San Francisco": "SFO",
    "Los Angeles": "LAX",
    "New York": "JFK",
    "London": "LHR",
    "Paris": "CDG",
    "Sydney": "SYD",
    "Beijing": "PEK",
    "Shanghai": "PVG",
  };

  // Extract city name from "City, Country" format
  const cityName = city.split(",")[0].trim();

  return cityMapping[cityName] || "Unknown";
}

async function main() {
  console.log("Starting Amadeus API flight price test...");

  // API credentials
  const apiKey = "u8Iyg6d1rXZEuVGZIzGGvKpTUptr7rAU";
  const apiSecret = "JxGS2dR8pOSuZ5E9";

  // Create Amadeus API client
  const amadeus = new AmadeusApi(apiKey, apiSecret);

  try {
    // Set search parameters (same as Google Flights test)
    const from = "Seoul, South Korea";
    const to = "Taipei, Taiwan";

    // Convert city names to IATA airport codes
    const originCode = cityToAirportCode(from);
    const destinationCode = cityToAirportCode(to);

    if (originCode === "Unknown" || destinationCode === "Unknown") {
      console.error("Could not determine airport codes for the cities provided");
      return;
    }

    // Get date for next week
    const today = new Date();
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);

    // Format departure date (next week, same day of the week)
    const departureDate = `${nextWeek.getFullYear()}-${String(nextWeek.getMonth() + 1).padStart(2, "0")}-${String(
      nextWeek.getDate()
    ).padStart(2, "0")}`;

    // Format return date (departure + 7 days)
    const returnDay = new Date(nextWeek);
    returnDay.setDate(returnDay.getDate() + 7);
    const returnDate = `${returnDay.getFullYear()}-${String(returnDay.getMonth() + 1).padStart(2, "0")}-${String(
      returnDay.getDate()
    ).padStart(2, "0")}`;

    console.log(`Searching for flights from ${from} (${originCode}) to ${to} (${destinationCode})`);
    console.log(`Departure: ${departureDate}, Return: ${returnDate}`);

    // Search for flights
    const flightData = await amadeus.searchFlights(originCode, destinationCode, departureDate, returnDate);

    // Display flight data
    console.log("\nFlight search results:");
    console.log("=====================");

    if (flightData.success) {
      console.log(`Average price: $${flightData.price}`);
      console.log(`Source: ${flightData.source}`);

      if (flightData.prices && flightData.prices.length > 0) {
        console.log(`\nFound ${flightData.prices.length} flight options:`);

        flightData.prices.forEach((flight: { price: number; airline: string; itineraries: any[] }, index: number) => {
          console.log(`\nOption ${index + 1}:`);
          console.log(`Price: $${flight.price}`);
          console.log(`Airline: ${flight.airline}`);

          // Display itinerary details
          flight.itineraries.forEach((itinerary: { segments: any[] }, itIndex: number) => {
            console.log(`\n  ${itIndex === 0 ? 'Outbound' : 'Return'} journey:`);

            itinerary.segments.forEach((segment: { departure: { iataCode: string; at: string }; arrival: { iataCode: string; at: string }; carrierCode: string; number: string; duration: string }, segIndex: number) => {
              console.log(`    Segment ${segIndex + 1}:`);
              console.log(`    From: ${segment.departure.iataCode} at ${segment.departure.at}`);
              console.log(`    To: ${segment.arrival.iataCode} at ${segment.arrival.at}`);
              console.log(`    Flight: ${segment.carrierCode} ${segment.number}`);
              console.log(`    Duration: ${segment.duration}`);
            });
          });
        });
      }

      return flightData;
    } else {
      console.log("No flight data found or search failed");
      console.log(`Source: ${flightData.source}`);
    }
  } catch (error) {
    console.error("Error during flight search:", error);
  }
}

// Run the main function
main().catch(console.error);
