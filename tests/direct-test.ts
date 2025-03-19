import * as fs from "fs";
import * as path from "path";
import puppeteer from "puppeteer";
import { findAndClickCurrencyButton } from "../src/utils/google-flights-scraper/find-and-click-currency-button";
import { navigateToGoogleFlights } from "../src/utils/google-flights-scraper/navigation";
import { selectUsdInCurrencyDialog } from "../src/utils/google-flights-scraper/select-usd-in-currency-dialog";

// Create a log file for direct output
const logDir = path.join(process.cwd(), "logs");
const logFile = path.join(logDir, `direct-test-${new Date().toISOString().replace(/:/g, "-")}.log`);

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
  log("Starting direct currency selection test...");

  let browser;
  let page;

  try {
    // Launch browser
    log("Launching browser...");
    browser = await puppeteer.launch({ headless: false });
    page = await browser.newPage();
    log("Browser launched");

    // Navigate to Google Flights
    log("Navigating to Google Flights...");
    await navigateToGoogleFlights(page);
    log("Navigated to Google Flights");

    // Find and click currency button
    log("Finding and clicking currency button...");
    const isCurrencyButtonFound = await findAndClickCurrencyButton(page);
    log(`Currency button found and clicked: ${isCurrencyButtonFound}`);

    if (isCurrencyButtonFound) {
      // Select USD in currency dialog
      log("Selecting USD in currency dialog...");
      const isUsdSelected = await selectUsdInCurrencyDialog(page);
      log(`USD selected in currency dialog: ${isUsdSelected}`);
    } else {
      log("Could not find currency button");
    }

    // Wait a moment before closing
    await new Promise((resolve) => setTimeout(resolve, 5000));

    log("Test completed!");
  } catch (error) {
    log(`Test failed: ${error}`);
    if (error instanceof Error) {
      log(`Error stack: ${error.stack}`);
    }
  } finally {
    // Close the browser
    if (browser) {
      log("Closing browser...");
      await browser.close();
      log("Browser closed");
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
