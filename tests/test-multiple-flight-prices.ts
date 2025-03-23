import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { GoogleFlightsScraper } from "../src/utils/google-flights-scraper";
import { CoordinatesMapping, getCityCoordinates } from "../src/utils/coordinates";
import { getDistanceKmFromCities } from "../src/utils/distance";
import { calculateFlightCost } from "../src/utils/flights";
import defaultList from "./default-list.json";

// Configuration
const ORIGIN = "Seoul, South Korea";
const DEPARTURE_DATE = "2025-05-25";
const RETURN_DATE = "2025-06-01";
// Take a subset of destinations for this test
const DESTINATIONS_TO_TEST = defaultList.slice(0, 5);

interface FlightTestResult {
  origin: string;
  destination: string;
  distanceKm: number;
  actualPrice: number | null;
  estimatedPrice: number;
  errorPercent: number | null;
  errorMessage?: string;
  searchUrl?: string;
}

async function testMultipleFlightPrices() {
  let scraper: GoogleFlightsScraper | undefined;
  let coordinates: CoordinatesMapping;
  const results: FlightTestResult[] = [];
  const outputDir = join(process.cwd(), "test-results");

  try {
    // Create output directory if it doesn't exist
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }

    console.log("=== Multiple Flight Prices Test ===");
    console.log(`Origin: ${ORIGIN}`);
    console.log(`Testing ${DESTINATIONS_TO_TEST.length} destinations: ${DESTINATIONS_TO_TEST.join(", ")}`);
    console.log(`Dates: ${DEPARTURE_DATE} to ${RETURN_DATE}`);

    // Initialize coordinates mapping
    coordinates = new CoordinatesMapping();
    console.log("\nInitializing coordinates...");

    // Add origin coordinates
    const originCoords = await getCityCoordinates(ORIGIN);
    if (originCoords.length > 0) {
      coordinates.addCity(ORIGIN, originCoords[0]);
      console.log(`Added coordinates for ${ORIGIN}`);
    } else {
      console.warn(`No coordinates found for ${ORIGIN}`);
    }

    // Initialize Google Flights scraper
    scraper = new GoogleFlightsScraper(true);
    await scraper.initialize({ headless: true });
    console.log("Browser initialized");

    await scraper.navigateToGoogleFlights();
    console.log("Navigated to Google Flights");

    // Try currency change with retries
    let didChangeCurrency = false;
    for (let i = 0; i < 3; i++) {
      try {
        await scraper.changeCurrencyToUsd();
        didChangeCurrency = true;
        console.log("Changed currency to USD");
        break;
      } catch (error) {
        console.warn(`Currency change attempt ${i + 1} failed:`, error);
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    if (!didChangeCurrency) {
      console.warn("Could not change currency to USD, proceeding with test");
    }

    // Add delay after currency operations
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Test each destination
    for (const destination of DESTINATIONS_TO_TEST) {
      console.log(`\n------------------------------`);
      console.log(`Testing: ${ORIGIN} to ${destination}`);

      try {
        // Get coordinates for destination
        const destCoords = await getCityCoordinates(destination);
        if (destCoords.length > 0) {
          coordinates.addCity(destination, destCoords[0]);
          console.log(`Added coordinates for ${destination}`);
        } else {
          console.warn(`No coordinates found for ${destination}`);
          results.push({
            origin: ORIGIN,
            destination,
            distanceKm: 0,
            actualPrice: null,
            estimatedPrice: 0,
            errorPercent: null,
            errorMessage: "No coordinates found for destination"
          });
          continue;
        }

        // Calculate distance
        const distanceKm = await getDistanceKmFromCities(ORIGIN, destination, coordinates);
        console.log(`Distance: ${isNaN(distanceKm) ? "Unknown" : `${Math.round(distanceKm)}km`}`);

        // Skip if distance can't be calculated
        if (isNaN(distanceKm)) {
          results.push({
            origin: ORIGIN,
            destination,
            distanceKm: 0,
            actualPrice: null,
            estimatedPrice: 0,
            errorPercent: null,
            errorMessage: "Could not calculate distance"
          });
          continue;
        }

        // Calculate estimated price
        const estimatedPrice = calculateFlightCost(distanceKm, destination, ORIGIN);
        console.log(`Estimated price: $${estimatedPrice.toFixed(2)}`);

        // Search for actual price with retries
        let flightResult;
        let errorMessage: string | undefined;

        console.log(`Searching for flights on Google...`);
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            // Add a delay between attempts
            if (attempt > 1) {
              console.log(`Retry attempt ${attempt}/3...`);
              await new Promise(resolve => setTimeout(resolve, 3000));
            }

            flightResult = await scraper.searchFlights(
              ORIGIN,
              destination,
              DEPARTURE_DATE,
              RETURN_DATE
            );

            if (flightResult.success && "price" in flightResult) {
              break;
            }
          } catch (error) {
            console.error(`Flight search attempt ${attempt} failed:`, error);
            errorMessage = error instanceof Error ? error.message : String(error);

            // Last attempt failed, give up
            if (attempt === 3) {
              console.error("All flight search attempts failed");
            }
          }
        }

        // Process and store results
        if (flightResult && flightResult.success && "price" in flightResult) {
          const actualPrice = flightResult.price;
          const errorPercent = ((estimatedPrice - actualPrice) / actualPrice) * 100;

          console.log(`Actual price: $${actualPrice}`);
          console.log(`Error percentage: ${errorPercent.toFixed(2)}%`);

          results.push({
            origin: ORIGIN,
            destination,
            distanceKm,
            actualPrice,
            estimatedPrice,
            errorPercent,
            searchUrl: flightResult.searchUrl
          });
        } else {
          console.error("Flight search failed");
          results.push({
            origin: ORIGIN,
            destination,
            distanceKm,
            actualPrice: null,
            estimatedPrice,
            errorPercent: null,
            errorMessage: errorMessage || "Flight search failed"
          });
        }

        // Add delay between destinations to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));

      } catch (error) {
        console.error(`Error processing ${destination}:`, error);
        results.push({
          origin: ORIGIN,
          destination,
          distanceKm: 0,
          actualPrice: null,
          estimatedPrice: 0,
          errorPercent: null,
          errorMessage: error instanceof Error ? error.message : String(error)
        });
      }
    }

    // Summarize results
    console.log("\n=== Test Results Summary ===");
    console.log(`Total destinations tested: ${DESTINATIONS_TO_TEST.length}`);

    const successfulResults = results.filter(r => r.actualPrice !== null);
    console.log(`Successful price lookups: ${successfulResults.length}`);
    console.log(`Failed price lookups: ${results.length - successfulResults.length}`);

    if (successfulResults.length > 0) {
      const avgError = successfulResults.reduce((sum, r) => sum + Math.abs(r.errorPercent!), 0) /
                      successfulResults.length;
      console.log(`Average error: ${avgError.toFixed(2)}%`);

      console.log("\nIndividual results:");
      successfulResults.forEach(r => {
        console.log(`${r.destination}: Estimated $${r.estimatedPrice.toFixed(2)} vs. Actual $${r.actualPrice} (${r.errorPercent!.toFixed(2)}% error)`);
      });
    }

    // Save results to CSV
    const csvHeader = "Origin,Destination,Distance (km),Actual Price,Estimated Price,Error %,Search URL,Error Message";
    const csvRows = results.map(r => {
      return [
        r.origin,
        r.destination,
        isNaN(r.distanceKm) ? "N/A" : Math.round(r.distanceKm),
        r.actualPrice === null ? "N/A" : r.actualPrice,
        r.estimatedPrice.toFixed(2),
        r.errorPercent === null ? "N/A" : r.errorPercent.toFixed(2),
        r.searchUrl || "",
        r.errorMessage || ""
      ].join(",");
    });

    const csvContent = [csvHeader, ...csvRows].join("\n");
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const csvFilePath = join(outputDir, `flight-test-results-${timestamp}.csv`);
    writeFileSync(csvFilePath, csvContent);
    console.log(`\nResults saved to: ${csvFilePath}`);

  } catch (error) {
    console.error("Test failed:", error instanceof Error ? error.message : String(error));
  } finally {
    if (scraper) {
      console.log("\nClosing browser...");
      await scraper.close();
    }
  }
}

// Run the test
console.log("Starting multi-destination price test...");
testMultipleFlightPrices().catch(console.error);
