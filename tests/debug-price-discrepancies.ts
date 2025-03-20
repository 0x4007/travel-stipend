import * as csvParser from "csv-parser";
import * as fs from "fs";
import * as path from "path";
import { GoogleFlightsScraper } from "../src/utils/google-flights-scraper";
import { LOG_LEVEL } from "../src/utils/google-flights-scraper/config";
import { log } from "../src/utils/google-flights-scraper/log";

interface FlightPriceData {
  Origin: string;
  Destination: string;
  "Distance (km)": string;
  "Actual Price": string;
  "Estimated Price": string;
  "Error %": string;
  "Price per km": string;
  "Distance Tier": string;
  "Date Collected": string;
  "Suggested Factor Adjustment": string;
  "Suggested Exponent Adjustment": string;
  "Google Flights URL": string;
}

interface DiscrepancyTest {
  origin: string;
  destination: string;
  expectedPrice: number;
  actualPrice: number;
  discrepancyPercent: number;
  url: string;
}

// Function to read the CSV file and parse the data
async function readCsvFile(filePath: string): Promise<FlightPriceData[]> {
  return new Promise<FlightPriceData[]>((resolve, reject) => {
    const results: FlightPriceData[] = [];
    fs.createReadStream(filePath)
      .pipe(csvParser.default())
      .on("data", (data: FlightPriceData) => results.push(data))
      .on("end", () => resolve(results))
      .on("error", (error: Error) => reject(error));
  });
}

// Function to calculate the absolute discrepancy percentage
function calculateDiscrepancy(actual: number, expected: number): number {
  return Math.abs(((actual - expected) / expected) * 100);
}

// Function to filter cities with >25% price discrepancy
function filterHighDiscrepancies(data: FlightPriceData[]): DiscrepancyTest[] {
  return data
    .map((row) => {
      const actualPrice = parseFloat(row["Actual Price"]);
      const expectedPrice = parseFloat(row["Estimated Price"]);
      const discrepancyPercent = calculateDiscrepancy(actualPrice, expectedPrice);

      return {
        origin: row.Origin,
        destination: row.Destination,
        expectedPrice,
        actualPrice,
        discrepancyPercent,
        url: row["Google Flights URL"]
      };
    })
    .filter((test) => test.discrepancyPercent > 25)
    .sort((a, b) => b.discrepancyPercent - a.discrepancyPercent); // Sort by highest discrepancy first
}

// Main function to run the test
async function runDiscrepancyTest() {
  try {
    // Find the most recent test results file
    const testResultsDir = path.join(process.cwd(), "test-results");
    const files = fs.readdirSync(testResultsDir)
      .filter(file => file.startsWith("flight-price-analysis") && file.endsWith(".csv"))
      .sort()
      .reverse(); // Most recent first

    if (files.length === 0) {
      throw new Error("No test results files found");
    }

    const latestFile = path.join(testResultsDir, files[0]);
    log(LOG_LEVEL.INFO, `Using latest test results file: ${latestFile}`);

    // Read and parse the CSV file
    const data = await readCsvFile(latestFile);

    // Filter cities with >25% price discrepancy
    const highDiscrepancies = filterHighDiscrepancies(data);

    log(LOG_LEVEL.INFO, `Found ${highDiscrepancies.length} cities with >25% price discrepancy`);

    // Create a timestamp for this debug run
    const timestamp = new Date().toISOString().replace(/:/g, "-");
    const debugDir = path.join(process.cwd(), "test-results", `debug-${timestamp}`);

    // Create debug directory
    if (!fs.existsSync(debugDir)) {
      fs.mkdirSync(debugDir, { recursive: true });
    }

    // Save discrepancy summary
    fs.writeFileSync(
      path.join(debugDir, "discrepancy-summary.json"),
      JSON.stringify(highDiscrepancies, null, 2)
    );

    log(LOG_LEVEL.INFO, `Saved discrepancy summary to ${path.join(debugDir, "discrepancy-summary.json")}`);

    // Initialize the Google Flights scraper
    const scraper = new GoogleFlightsScraper();
    await scraper.initialize({ headless: false });
    await scraper.navigateToGoogleFlights();
    await scraper.changeCurrencyToUsd();

    // Test each high discrepancy city
    const results = [];
    for (const test of highDiscrepancies) {
      log(LOG_LEVEL.INFO, `Testing ${test.destination} (${test.discrepancyPercent.toFixed(2)}% discrepancy)`);

      try {
        // Use fixed dates for consistency
        const departureDate = "2025-05-25";
        const returnDate = "2025-06-01";

        // Search flights with screenshots enabled
        const result = await scraper.searchFlights(
          test.origin,
          test.destination,
          departureDate,
          returnDate,
          true // Enable screenshots
        );

        // Extract price from result
        let price = 0;
        if ('price' in result) {
          price = result.price;
        } else if (result.prices && result.prices.length > 0) {
          price = Math.round(result.prices.reduce((sum, p) => sum + p.price, 0) / result.prices.length);
        }

        // Extract other properties safely
        const screenshotPath = 'screenshotPath' in result ? result.screenshotPath : undefined;
        const selectedDestination = 'selectedDestination' in result ? result.selectedDestination : undefined;
        const hasAllianceFilters = 'allianceFiltersApplied' in result ? result.allianceFiltersApplied : undefined;

        // Save the result
        const debugResult = {
          ...test,
          newPrice: price,
          newDiscrepancyPercent: calculateDiscrepancy(price, test.expectedPrice),
          screenshotPath,
          selectedDestination,
          hasAllianceFilters,
          timestamp: new Date().toISOString()
        };

        results.push(debugResult);

        // Save individual result
        const sanitizedDestination = test.destination
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "-")
          .replace(/-+/g, "-")
          .replace(/(^-)|(-$)/g, "");

        fs.writeFileSync(
          path.join(debugDir, `${sanitizedDestination}-debug.json`),
          JSON.stringify(debugResult, null, 2)
        );

        log(LOG_LEVEL.INFO, `Saved debug result for ${test.destination}`);

        // Wait a bit between searches to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        log(LOG_LEVEL.ERROR, `Error testing ${test.destination}:`, error instanceof Error ? error.message : String(error));
      }
    }

    // Save all results
    fs.writeFileSync(
      path.join(debugDir, "all-results.json"),
      JSON.stringify(results, null, 2)
    );

    log(LOG_LEVEL.INFO, `Saved all results to ${path.join(debugDir, "all-results.json")}`);

    // Close the scraper
    await scraper.close();

    log(LOG_LEVEL.INFO, "Discrepancy test completed successfully");
  } catch (error) {
    log(LOG_LEVEL.ERROR, "Error running discrepancy test:", error instanceof Error ? error.message : String(error));
  }
}

// Run the test
runDiscrepancyTest().catch(console.error);
