import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { CoordinatesMapping, getCityCoordinates } from "../src/utils/coordinates";
import { getDistanceKmFromCities } from "../src/utils/distance";
import { calculateFlightCost } from "../src/utils/flights";
import { GoogleFlightsScraper } from "../src/utils/google-flights-scraper";
import defaultList from "./default-list.json";

// Use the default list from JSON for this test
const DESTINATIONS_TO_TEST = defaultList;
const ORIGIN = "Seoul, South Korea";

interface RouteAnalysis {
  origin: string;
  destination: string;
  distanceKm: number;
  actualPrice: number | null;
  pricePerKm: number | null;
  estimatedPrice: number;
  errorPercent: number | null;
  distanceTier: string;
  dateCollected: string;
  googleFlightsUrl?: string;
  errorMessage?: string;
}

// Helper function to identify distance tier
function getDistanceTier(distanceKm: number): string {
  if (distanceKm < 500) return "Short (0-500km)";
  if (distanceKm < 1000) return "Medium-Short (500-1000km)";
  if (distanceKm < 2000) return "Medium (1000-2000km)";
  if (distanceKm < 4000) return "Medium-Long (2000-4000km)";
  if (distanceKm < 7000) return "Long (4000-7000km)";
  if (distanceKm < 10000) return "Extended (7000-10000km)";
  if (distanceKm < 13000) return "Very-Long (10000-13000km)";
  return "Ultra-Long (>13000km)";
}

// Initialize Google Flights scraper and set up browser
async function initializeScraper(): Promise<GoogleFlightsScraper> {
  const scraper = new GoogleFlightsScraper(true); // Use training mode
  await scraper.initialize({ headless: true });
  console.log("Browser initialized");

  await scraper.navigateToGoogleFlights();
  console.log("Navigated to Google Flights");

  // Add delay before currency change
  await new Promise((resolve) => setTimeout(resolve, 2000));

  try {
    await scraper.changeCurrencyToUsd();
    console.log("Changed currency to USD");
  } catch {
    console.warn("Warning: Currency change may have failed, continuing with test");
  }

  // Add delay after currency change
  await new Promise((resolve) => setTimeout(resolve, 2000));

  return scraper;
}

// Initialize coordinate mapping for origin and destinations
async function initializeCoordinates(cities: string[]): Promise<CoordinatesMapping> {
  const coordinates = new CoordinatesMapping();
  console.log("Initializing coordinates mapping...");

  for (const city of cities) {
    try {
      const cityCoords = await getCityCoordinates(city);
      if (cityCoords.length > 0) {
        coordinates.addCity(city, cityCoords[0]);
        console.log(`Added coordinates for ${city}`);
      } else {
        console.warn(`No coordinates found for ${city}`);
      }
    } catch (error) {
      console.error(`Error getting coordinates for ${city}:`, error);
    }
  }

  return coordinates;
}

// Process a single destination
async function processDestination(
  scraper: GoogleFlightsScraper,
  coordinates: CoordinatesMapping,
  origin: string,
  destination: string
): Promise<RouteAnalysis> {
  try {
    // Calculate distance
    console.log(`\nTesting ${origin} to ${destination}:`);
    const distanceKm = await getDistanceKmFromCities(origin, destination, coordinates);
    console.log(`Calculated distance: ${distanceKm.toFixed(0)}km`);

    // Skip destinations with NaN distance - could not calculate
    if (isNaN(distanceKm)) {
      const errorMsg = "Could not calculate distance - coordinates not found";
      console.error(errorMsg);
      return {
        origin,
        destination,
        distanceKm: 0,
        actualPrice: null,
        pricePerKm: null,
        estimatedPrice: 0,
        errorPercent: null,
        distanceTier: "Unknown",
        dateCollected: new Date().toISOString(),
        errorMessage: errorMsg
      };
    }

    // Get current estimated price using our algorithm
    const estimatedPrice = calculateFlightCost(distanceKm, destination, origin);

    // Get actual price from Google Flights
    const departureDate = "2025-05-25";
    const returnDate = "2025-06-01";
    console.log(`Searching flights for dates: ${departureDate} - ${returnDate}`);

    const { flightResult, errorMessage } = await searchFlightWithRetry(
      scraper, origin, destination, departureDate, returnDate
    );

    // Process results or handle failure
    if (flightResult?.success && flightResult?.price !== undefined) {
      const actualPrice = flightResult.price;
      const pricePerKm = actualPrice / distanceKm;
      const errorPercent = ((estimatedPrice - actualPrice) / actualPrice) * 100;

      // Extract searchUrl safely
      const searchUrl = flightResult.searchUrl && typeof flightResult.searchUrl === "string"
        ? flightResult.searchUrl
        : undefined;

      // Get tier for analysis
      const distanceTier = getDistanceTier(distanceKm);

      // Create result object with URL
      const result: RouteAnalysis = {
        origin,
        destination,
        distanceKm,
        actualPrice,
        pricePerKm,
        estimatedPrice,
        errorPercent,
        distanceTier,
        dateCollected: new Date().toISOString(),
        googleFlightsUrl: searchUrl,
      };

      // Log individual route results
      console.log(`Distance: ${distanceKm.toFixed(0)}km`);
      console.log(`Actual Price: $${actualPrice}`);
      console.log(`Estimated Price: $${estimatedPrice.toFixed(2)}`);
      console.log(`Price per KM: $${pricePerKm.toFixed(4)}`);
      console.log(`Error: ${errorPercent.toFixed(2)}%`);
      console.log(`Tier: ${distanceTier}`);
      if (searchUrl) {
        console.log(`URL: ${searchUrl}`);
      }

      return result;
    } else {
      // Failed to get flight price
      const error = errorMessage ?? "Failed to retrieve flight price";
      console.error(`Failed to get flight price for ${destination}: ${error}`);
      return {
        origin,
        destination,
        distanceKm,
        actualPrice: null,
        pricePerKm: null,
        estimatedPrice,
        errorPercent: null,
        distanceTier: getDistanceTier(distanceKm),
        dateCollected: new Date().toISOString(),
        errorMessage: error
      };
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`Error processing flight search for ${destination}:`, errorMsg);
    return {
      origin,
      destination,
      distanceKm: 0,
      actualPrice: null,
      pricePerKm: null,
      estimatedPrice: 0,
      errorPercent: null,
      distanceTier: "Unknown",
      dateCollected: new Date().toISOString(),
      errorMessage: errorMsg
    };
  }
}

interface FlightResult {
  success: boolean;
  price?: number;
  searchUrl?: string;
}

// Retry flight search with exponential backoff
async function searchFlightWithRetry(
  scraper: GoogleFlightsScraper,
  origin: string,
  destination: string,
  departureDate: string,
  returnDate: string
): Promise<{ flightResult?: FlightResult; errorMessage?: string }> {
  let retryCount = 0;
  const maxRetries = 3;
  let flightResult;
  let errorMessage: string | undefined;

  while (retryCount < maxRetries) {
    try {
      flightResult = await scraper.searchFlights(origin, destination, departureDate, returnDate);
      console.log("Flight search completed");

      if (flightResult.success && "price" in flightResult) {
        break;
      }

      console.log(`Retry ${retryCount + 1}/${maxRetries} for ${destination}`);
      retryCount++;
      await new Promise((resolve) => setTimeout(resolve, 3000));
    } catch (error) {
      console.error(`Error searching flights (attempt ${retryCount + 1}):`, error);
      errorMessage = error instanceof Error ? error.message : String(error);
      retryCount++;
      await new Promise((resolve) => setTimeout(resolve, 3000));

      if (retryCount === maxRetries) {
        break;
      }
    }
  }

  return { flightResult, errorMessage };
}

// Generate analysis reports
function generateReports(
  results: RouteAnalysis[],
  failedDestinations: { destination: string; error: string }[],
  totalDestinations: number
): void {
  console.log("\n==========================================");
  console.log("Flight Price Prediction Test Results:");
  console.log("==========================================");

  // Filter out failed results for analysis
  const successfulResults = results.filter(r => r.actualPrice !== null);

  // Calculate and log aggregate statistics
  if (successfulResults.length > 0) {
    const avgErrorPercent = successfulResults.reduce(
      (sum, r) => sum + Math.abs(r.errorPercent ?? 0),
      0
    ) / successfulResults.length;

    const avgPricePerKm = successfulResults.reduce(
      (sum, r) => sum + (r.pricePerKm ?? 0),
      0
    ) / successfulResults.length;

    console.log("\nSuccessful Routes:");
    console.log(`Total Routes Tested: ${totalDestinations}`);
    console.log(`Successful Routes: ${successfulResults.length}`);
    console.log(`Failed Routes: ${failedDestinations.length}`);
    console.log(`Average Error: ${avgErrorPercent.toFixed(2)}%`);
    console.log(`Average Price per KM: $${avgPricePerKm.toFixed(4)}`);
  } else {
    console.log("\nNo successful routes to analyze");
  }

  // Group results by error level
  const highErrorResults = successfulResults.filter(r => Math.abs(r.errorPercent ?? 0) > 25);
  const moderateErrorResults = successfulResults.filter(
    r => Math.abs(r.errorPercent ?? 0) > 10 && Math.abs(r.errorPercent ?? 0) <= 25
  );
  const lowErrorResults = successfulResults.filter(r => Math.abs(r.errorPercent ?? 0) <= 10);

  console.log("\nError Analysis:");
  console.log(`High Error (>25%): ${highErrorResults.length} routes`);
  console.log(`Moderate Error (10-25%): ${moderateErrorResults.length} routes`);
  console.log(`Low Error (<10%): ${lowErrorResults.length} routes`);

  if (highErrorResults.length > 0) {
    console.log("\nHigh Error Routes (>25%):");
    highErrorResults.forEach(r => {
      console.log(
        `${r.destination}: ${r.errorPercent?.toFixed(2)}% error ($${r.actualPrice} vs. $${r.estimatedPrice.toFixed(2)})`
      );
    });
  }

  // Failed destinations report
  if (failedDestinations.length > 0) {
    console.log("\nFailed Destinations:");
    failedDestinations.forEach(({ destination, error }) => {
      console.log(`${destination}: ${error}`);
    });
  }
}

// Save results to CSV file
function saveResultsToCsv(results: RouteAnalysis[], outputDir: string): string {
  const csvHeader =
    "Origin,Destination,Distance (km),Actual Price,Estimated Price,Error %,Price per km,Distance Tier,Date Collected,Google Flights URL,Error Message";

  const csvRows = results.map(r => {
    const actualPrice = r.actualPrice ?? "N/A";
    const errorPercent = r.errorPercent !== null ? r.errorPercent.toFixed(2) : "N/A";
    const pricePerKm = r.pricePerKm !== null ? r.pricePerKm.toFixed(4) : "N/A";
    // Handle URL properly for CSV
    const urlStr = r.googleFlightsUrl ? `"${r.googleFlightsUrl}"` : '""';
    const errorMsg = r.errorMessage ? `"${r.errorMessage.replace(/"/g, '""')}"` : '""';

    return `"${r.origin}","${r.destination}",${r.distanceKm.toFixed(0)},${actualPrice},${r.estimatedPrice.toFixed(2)},${errorPercent},${pricePerKm},"${r.distanceTier}","${r.dateCollected}",${urlStr},${errorMsg}`;
  });

  const csvContent = [csvHeader, ...csvRows].join("\n");
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const csvFilePath = join(outputDir, `flight-price-analysis-${timestamp}.csv`);
  writeFileSync(csvFilePath, csvContent);

  return csvFilePath;
}

// Main test function
async function runFlightCostPredictionTest() {
  // Setup variables
  let scraper: GoogleFlightsScraper | undefined;

  // Create output directory
  const outputDir = join(process.cwd(), "test-results");
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  try {
    console.log("Starting flight price prediction test...");

    // Initialize scraper and coordinates mapping
    scraper = await initializeScraper();
    const coordinates = await initializeCoordinates([ORIGIN, ...DESTINATIONS_TO_TEST]);

    // Process each destination
    const results: RouteAnalysis[] = [];
    const failedDestinations: { destination: string; error: string }[] = [];

    for (const destination of DESTINATIONS_TO_TEST) {
      // Add delay between tests to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const result = await processDestination(scraper, coordinates, ORIGIN, destination);
      results.push(result);

      // Track failed destinations
      if (result.actualPrice === null && result.errorMessage) {
        failedDestinations.push({
          destination,
          error: result.errorMessage
        });
      }
    }

    // Generate reports
    generateReports(results, failedDestinations, DESTINATIONS_TO_TEST.length);

    // Save results to CSV
    const csvFilePath = saveResultsToCsv(results, outputDir);
    console.log(`\nResults saved to: ${csvFilePath}`);

  } catch (error) {
    console.error("Error running flight cost prediction test:", error instanceof Error ? error.message : String(error));
  } finally {
    // Clean up resources
    if (scraper) {
      await scraper.close();
    }
  }
}

// Run the test
runFlightCostPredictionTest().catch(console.error);
