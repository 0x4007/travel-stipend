import * as fs from "fs";
import * as path from "path";
import { GoogleFlightsScraper } from "../src/utils/google-flights-scraper/index";

// Create a log file for direct output
const logDir = path.join(process.cwd(), "logs");
const logFile = path.join(logDir, `test-run-${new Date().toISOString().replace(/:/g, "-")}.log`);

// Ensure log directory exists
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Function to log to both console and file
function log(message: string) {
  console.log(message);
  fs.appendFileSync(logFile, message + "\n");
}

// Simple test function
async function testCurrencySelection() {
  log("Starting simple currency selection test...");

  try {
    log("Creating scraper instance...");
    const scraper = new GoogleFlightsScraper();
    log("Created scraper instance");

    // Initialize with visible browser
    log("Initializing browser...");
    await scraper.initialize({ headless: false });
    log("Browser initialized");

    // Navigate to Google Flights
    log("Navigating to Google Flights...");
    await scraper.navigateToGoogleFlights();
    log("Navigated to Google Flights");

    // Try to change currency to USD
    log("Attempting to change currency to USD...");
    await scraper.changeCurrencyToUsd();
    log("Successfully changed currency to USD");

    // Close the browser
    log("Closing browser...");
    await scraper.close();
    log("Browser closed");

    log("Test completed successfully!");
  } catch (error) {
    log(`Test failed: ${error}`);
    if (error instanceof Error) {
      log(`Error stack: ${error.stack}`);
    }
  }
}

// Run the test
log("Starting test...");
testCurrencySelection()
  .then(() => log("Test function completed"))
  .catch((error) => {
    log(`Error in test execution: ${error}`);
    process.exit(1);
  });

log(`Logs are being written to: ${logFile}`);
