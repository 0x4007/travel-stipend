import { getAirlineAlliance, isMajorCarrier } from "../src/utils/airline-alliances";
import { createHashKey, PersistentCache } from "../src/utils/cache";
import { getDistanceKmFromCities } from "../src/utils/distance";
import { calculateFlightCost, scrapeFlightPrice } from "../src/utils/flights";

// Interface for comparison results
interface ComparisonResult {
  origin: string;
  destination: string;
  departureDate: string;
  returnDate: string;
  amadeusPrice: number | null;
  googleFlightsPrice: number | null;
  distanceBasedPrice: number | null;
  amadeusSource: string;
  googleFlightsSource: string;
  distanceBasedSource: string;
  distanceKm: number | null;
}

// Amadeus API client for flight price fetching (reused from test-amadeus-flight-prices.ts)
class AmadeusApi {
  private _apiKey: string;
  private _apiSecret: string;
  private _accessToken: string | null = null;
  private _tokenExpiry: number = 0;
  private _cache: PersistentCache<{ price: number; timestamp: string; source: string }>;
  private _filterMajorCarriersOnly: boolean;

  constructor(apiKey: string, apiSecret: string, filterMajorCarriersOnly: boolean = false) {
    this._apiKey = apiKey;
    this._apiSecret = apiSecret;
    this._filterMajorCarriersOnly = filterMajorCarriersOnly;
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
      this._filterMajorCarriersOnly ? "amadeus-major-carriers-v1" : "amadeus-v1",
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

        // Filter for major carriers if requested
        let flightsToUse = prices;
        let sourceDescription = "Amadeus API";

        if (this._filterMajorCarriersOnly) {
          const majorCarrierFlights = prices.filter((flight: { airline: string }) => isMajorCarrier(flight.airline));

          // Only use major carrier flights if we found some
          if (majorCarrierFlights.length > 0) {
            flightsToUse = majorCarrierFlights;
            sourceDescription = "Amadeus API (Major Carriers Only)";
            console.log(`Filtered to ${majorCarrierFlights.length} major carrier flights out of ${prices.length} total flights`);

            // Log the airlines and their alliances
            majorCarrierFlights.forEach((flight: { airline: string; price: number }) => {
              const alliance = getAirlineAlliance(flight.airline);
              console.log(`  - ${flight.airline}: ${alliance} - $${flight.price}`);
            });
          } else {
            console.log("No major carrier flights found, using all flights");
          }
        }

        // Calculate average price
        const sum = flightsToUse.reduce((total: number, flight: { price: number }) => total + flight.price, 0);
        const avgPrice = Math.round(sum / flightsToUse.length);

        // Store in cache
        console.log(`Storing result in cache with key: ${cacheKey}`);
        this._cache.set(cacheKey, {
          price: avgPrice,
          timestamp: new Date().toISOString(),
          source: sourceDescription,
        });
        // Save cache to disk
        (this._cache as PersistentCache<{ price: number; timestamp: string; source: string }>).saveToDisk();
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


async function getDistanceInfo(origin: string, destination: string): Promise<{ distanceKm: number | null }> {
  try {
    console.log("Calculating distance between cities...");
    const { loadCoordinatesData } = await import("../src/utils/coordinates");
    const coordinates = loadCoordinatesData("fixtures/coordinates.csv");
    const distance = getDistanceKmFromCities(origin, destination, coordinates);
    console.log(`Distance: ${distance.toFixed(2)} km`);
    return { distanceKm: distance };
  } catch (error) {
    console.error("Error calculating distance:", error);
    return { distanceKm: null };
  }
}

async function getDistanceBasedPrice(distanceKm: number | null, origin: string, destination: string): Promise<{ price: number | null; source: string }> {
  if (distanceKm === null) {
    return { price: null, source: "Not available" };
  }

  try {
    console.log("Calculating distance-based flight price...");
    const price = calculateFlightCost(distanceKm, destination, origin);
    console.log(`Distance-based price: $${price}`);
    return { price, source: "Distance-based calculation" };
  } catch (error) {
    console.error("Error calculating distance-based price:", error);
    return { price: null, source: "Error in calculation" };
  }
}

async function getGoogleFlightsPrice(origin: string, destination: string, dates: { departureDate: string; returnDate: string }): Promise<{ price: number | null; source: string }> {
  try {
    console.log("Getting Google Flights price...");
    let result = { price: null as number | null, source: "Not initialized" };
    const maxRetries = 2;

    for (let retryCount = 0; retryCount <= maxRetries; retryCount++) {
      if (retryCount > 0) {
        console.log(`Retry attempt ${retryCount} for Google Flights scraping...`);
      }

      result = await scrapeFlightPrice(origin, destination, {
        outbound: dates.departureDate,
        return: dates.returnDate,
      });

      if (result.price !== null || retryCount === maxRetries) break;

      console.log(`Scraping failed. Will retry (${retryCount}/${maxRetries})...`);
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    console.log(`Google Flights price: ${result.price ? "$" + result.price : "Not available"}`);
    console.log(`Source: ${result.source}`);
    return result;
  } catch (error) {
    console.error("Error getting Google Flights price:", error);
    return { price: null, source: "Error in scraping" };
  }
}

async function getAmadeusPrice(origin: string, destination: string, dates: { departureDate: string; returnDate: string }): Promise<{ price: number | null; source: string }> {
  try {
    console.log("Getting Amadeus API price...");
    const originCode = cityToAirportCode(origin);
    const destinationCode = cityToAirportCode(destination);

    if (originCode === "Unknown" || destinationCode === "Unknown") {
      console.error("Could not determine airport codes for the cities provided");
      return { price: null, source: "Invalid airport codes" };
    }

    const apiKey = process.env.AMADEUS_API_KEY;
    const apiSecret =process.env.AMADEUS_API_SECRET;
    const amadeus = new AmadeusApi(apiKey, apiSecret, true);

    console.log("Searching with major carriers only (alliance members)...");
    const result = await amadeus.searchFlights(
      originCode,
      destinationCode,
      dates.departureDate,
      dates.returnDate
    );

    if (result.success) {
      console.log(`Amadeus API price: $${result.price}`);
      console.log(`Source: ${result.source}`);
      return { price: result.price, source: result.source };
    }

    console.log("No flight data found from Amadeus API");
    return { price: null, source: result.source };
  } catch (error) {
    console.error("Error getting Amadeus API price:", error);
    return { price: null, source: "API error" };
  }
}

async function compareFlightPriceStrategies(
  origin: string,
  destination: string,
  departureDate: string,
  returnDate: string
): Promise<ComparisonResult> {
  console.log(`\n=== Comparing flight price strategies for ${origin} to ${destination} ===`);

  // Format city names
  origin = !origin.includes(",") ? origin.replace(" ", ", ") : origin;
  destination = !destination.includes(",") ? destination.replace(" ", ", ") : destination;
  console.log(`Dates: ${departureDate} to ${returnDate}\n`);

  // Initialize result
  const result: ComparisonResult = {
    origin,
    destination,
    departureDate,
    returnDate,
    amadeusPrice: null,
    googleFlightsPrice: null,
    distanceBasedPrice: null,
    amadeusSource: "Not available",
    googleFlightsSource: "Not available",
    distanceBasedSource: "Not available",
    distanceKm: null,
  };

  // Get distance and all prices
  const { distanceKm } = await getDistanceInfo(origin, destination);
  result.distanceKm = distanceKm;

  const distancePrice = await getDistanceBasedPrice(distanceKm, origin, destination);
  result.distanceBasedPrice = distancePrice.price;
  result.distanceBasedSource = distancePrice.source;

  const dates = { departureDate, returnDate };
  const googlePrice = await getGoogleFlightsPrice(origin, destination, dates);
  result.googleFlightsPrice = googlePrice.price;
  result.googleFlightsSource = googlePrice.source;

  const amadeusPrice = await getAmadeusPrice(origin, destination, dates);
  result.amadeusPrice = amadeusPrice.price;
  result.amadeusSource = amadeusPrice.source;

  return result;
}


function displayComparisonResults(results: ComparisonResult[]): void {
  console.log("\n=== Flight Price Strategy Comparison Results ===\n");

  // Display each result
  results.forEach((result, index) => {
    console.log(`\nComparison #${index + 1}: ${result.origin} to ${result.destination}`);
    console.log(`Dates: ${result.departureDate} to ${result.returnDate}`);
    console.log(`Distance: ${result.distanceKm ? result.distanceKm.toFixed(2) + " km" : "Unknown"}`);
    console.log("\nPrices:");
    console.log(`1. Amadeus API: ${result.amadeusPrice ? "$" + result.amadeusPrice : "Not available"} (${result.amadeusSource})`);
    console.log(`2. Google Flights: ${result.googleFlightsPrice ? "$" + result.googleFlightsPrice : "Not available"} (${result.googleFlightsSource})`);
    console.log(`3. Distance-based: ${result.distanceBasedPrice ? "$" + result.distanceBasedPrice : "Not available"} (${result.distanceBasedSource})`);

    // Calculate differences if all prices are available
    if (result.amadeusPrice && result.googleFlightsPrice && result.distanceBasedPrice) {
      console.log("\nDifferences:");

      // Amadeus vs Google Flights
      const diffAmadeusGoogle = result.amadeusPrice - result.googleFlightsPrice;
      const percentDiffAmadeusGoogle = ((diffAmadeusGoogle / result.googleFlightsPrice) * 100).toFixed(2);
      console.log(`Amadeus vs Google Flights: $${diffAmadeusGoogle} (${percentDiffAmadeusGoogle}%)`);

      // Amadeus vs Distance-based
      const diffAmadeusDistance = result.amadeusPrice - result.distanceBasedPrice;
      const percentDiffAmadeusDistance = ((diffAmadeusDistance / result.distanceBasedPrice) * 100).toFixed(2);
      console.log(`Amadeus vs Distance-based: $${diffAmadeusDistance} (${percentDiffAmadeusDistance}%)`);

      // Google Flights vs Distance-based
      const diffGoogleDistance = result.googleFlightsPrice - result.distanceBasedPrice;
      const percentDiffGoogleDistance = ((diffGoogleDistance / result.distanceBasedPrice) * 100).toFixed(2);
      console.log(`Google Flights vs Distance-based: $${diffGoogleDistance} (${percentDiffGoogleDistance}%)`);
    }

    console.log("\n" + "-".repeat(50));
  });
}


async function main() {
  console.log("Starting flight price strategy comparison...");

  // Get date for next week
  const today = new Date();
  const nextWeek = new Date(today);
  nextWeek.setDate(today.getDate() + 7);

  // Format departure date (next week)
  const departureDate = `${nextWeek.getFullYear()}-${String(nextWeek.getMonth() + 1).padStart(2, "0")}-${String(
    nextWeek.getDate()
  ).padStart(2, "0")}`;

  // Format return date (departure + 7 days)
  const returnDay = new Date(nextWeek);
  returnDay.setDate(returnDay.getDate() + 7);
  const returnDate = `${returnDay.getFullYear()}-${String(returnDay.getMonth() + 1).padStart(2, "0")}-${String(
    returnDay.getDate()
  ).padStart(2, "0")}`;

  // Define test cases with different characteristics
  const testCases = [
    // Short-haul flight
    {
      origin: "Seoul, Korea",
      destination: "Tokyo, Japan",
      departureDate,
      returnDate,
    },
    // Medium-haul flight - using airport codes for more reliable matching
    {
      origin: "ICN", // Incheon International Airport (Seoul)
      destination: "SIN", // Singapore Changi Airport
      departureDate,
      returnDate,
    },
    // Long-haul flight
    {
      origin: "Seoul, Korea",
      destination: "New York, United States",
      departureDate,
      returnDate,
    },
  ];

  // Run comparisons for all test cases
  const results: ComparisonResult[] = [];
  for (const testCase of testCases) {
    const result = await compareFlightPriceStrategies(
      testCase.origin,
      testCase.destination,
      testCase.departureDate,
      testCase.returnDate
    );
    results.push(result);
  }

  // Display results
  displayComparisonResults(results);
}

// Run the main function
main().catch(console.error);
