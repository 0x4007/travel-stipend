import { loadAirportCoordinatesData } from "../src/utils/coordinates";
import { getDistanceKmFromCities } from "../src/utils/distance";
import { calculateFlightCost, scrapeFlightPrice } from "../src/utils/flights";
import { AmadeusApi } from "../src/utils/amadeus-api";

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
    const airportCoordinates = loadAirportCoordinatesData("fixtures/airport-codes.csv");
    const distance = getDistanceKmFromCities(origin, destination, coordinates, airportCoordinates);
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

async function retryGoogleFlightsScraping(
  origin: string,
  destination: string,
  dates: { departureDate: string; returnDate: string },
  maxRetries: number
): Promise<{ price: number | null; source: string }> {
  let result = { price: null as number | null, source: "Not initialized" };

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

  return result;
}

async function getGoogleFlightsPrice(origin: string, destination: string, dates: { departureDate: string; returnDate: string }): Promise<{ price: number | null; source: string }> {
  try {
    console.log("Getting Google Flights price...");
    const result = await retryGoogleFlightsScraping(origin, destination, dates, 2);

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

    const apiKey = process.env.AMADEUS_API_KEY as string;
    const apiSecret = process.env.AMADEUS_API_SECRET as string;
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

  // Initialize result (using original values without reformatting)
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


interface PriceDifference {
  name: string;
  difference: number;
  percentDifference: string;
  isHigher: boolean;
}

function calculatePriceDifference(comparePrice: number | null, basePrice: number): PriceDifference | null {
  if (!comparePrice) return null;

  const difference = comparePrice - basePrice;
  const percentDifference = ((difference / basePrice) * 100).toFixed(2);

  return {
    name: "",  // Set by caller
    difference,
    percentDifference,
    isHigher: difference >= 0
  };
}

function formatPriceDifference(diff: PriceDifference): string {
  return `${diff.name}: ${diff.isHigher ? "+" : ""}$${diff.difference} (${diff.percentDifference}% ${diff.isHigher ? "higher" : "lower"})`;
}

function displayComparisonResults(results: ComparisonResult[]): void {
  console.log("\n=== Flight Price Strategy Comparison Results ===\n");

  results.forEach((result, index) => {
    console.log(`\nComparison #${index + 1}: ${result.origin} to ${result.destination}`);
    console.log(`Dates: ${result.departureDate} to ${result.returnDate}`);
    console.log(`Distance: ${result.distanceKm ? result.distanceKm.toFixed(2) + " km" : "Unknown"}`);
    console.log("\nPrices:");
    console.log(`1. Amadeus API: ${result.amadeusPrice ? "$" + result.amadeusPrice : "Not available"} (${result.amadeusSource})`);
    console.log(`2. Google Flights: ${result.googleFlightsPrice ? "$" + result.googleFlightsPrice : "Not available"} (${result.googleFlightsSource})`);
    console.log(`3. Distance-based: ${result.distanceBasedPrice ? "$" + result.distanceBasedPrice : "Not available"} (${result.distanceBasedSource})`);

    if (result.googleFlightsPrice) {
      console.log("\nDifferences (compared to Google Flights):");

      const diffs = [
        { ...calculatePriceDifference(result.distanceBasedPrice, result.googleFlightsPrice), name: "Distance-based" },
        { ...calculatePriceDifference(result.amadeusPrice, result.googleFlightsPrice), name: "Amadeus API" }
      ].filter((diff): diff is PriceDifference => diff != null);

      diffs.forEach(diff => console.log(formatPriceDifference(diff)));
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
