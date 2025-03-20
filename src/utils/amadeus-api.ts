import { getAirlineAlliance, isMajorCarrier } from "./airline-alliances";
import { createHashKey, isWithinSixHours, PersistentCache } from "./cache";

// Response Types
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

export class AmadeusApi {
  private _apiKey: string;
  private _apiSecret: string;
  private _accessToken: string | null = null;
  private _tokenExpiry: number = 0;
  private _cache: PersistentCache<{ price: number; timestamp: string; source: string }>;
  private _filterMajorCarriersOnly: boolean;

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
      url.searchParams.append("maxPrice", "5000"); // Set a reasonable max price

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

    // Filter for major carriers only (default behavior)
    let flightsToUse = prices;
    let sourceDescription = "Amadeus API";

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
        sourceDescription = "Amadeus API";
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
