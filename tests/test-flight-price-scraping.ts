import * as puppeteer from "puppeteer";
import { scrapeFlightPrices } from "../src/utils/google-flights-scraper/price-scraper";

async function main() {
  console.log("Starting Google Flights price scraping test...");

  // Launch browser in headful mode
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: { width: 1366, height: 768 },
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--window-size=1366,768"],
  });

  try {
    // Create a new page
    const page = await browser.newPage();

    // Set user agent
    await page.setUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36");

    // Navigate to Google Flights with a sample search
    // This URL simulates a search from Seoul to Tokyo for a specific date
    console.log("Navigating to Google Flights with a sample search...");
    await page.goto(
      "https://www.google.com/travel/flights/search?tfs=CBwQAhoeagcIARIDSUNOEgoyMDI1LTA0LTAxcgcIARIDTlJUGh5qBwgBEgNOUlQSCjIwMjUtMDQtMDVyBwgBEgNJQ04&hl=en&curr=USD",
      {
        waitUntil: "networkidle2",
        timeout: 60000,
      }
    );
    console.log("Google Flights search results loaded");

    // Wait for the page to be fully loaded
    await page.waitForSelector("body", { timeout: 10000 });

    // Take a screenshot of the search results

    // Wait for results to fully render
    console.log("Waiting for results to fully render...");
    await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 5000)));

    // Scrape flight prices
    console.log("Scraping flight prices...");
    const prices = await scrapeFlightPrices(page);

    // Display the results
    console.log("\n-----------------------------------------");
    console.log(`Found ${prices.length} flight prices:`);
    if (prices.length > 0) {
      prices.forEach((flight, index) => {
        console.log(`Price ${index + 1}: $${typeof flight.price === 'number' ? flight.price.toFixed(2) : 'N/A'}`);
      });
    } else {
      console.log("No prices found. Check the screenshots for debugging.");
    }
    console.log("-----------------------------------------\n");

    // Pause for manual debugging
    console.log("\n-----------------------------------------");
    console.log("Script paused for manual debugging.");
    console.log("The browser will remain open until you press Ctrl+C in the terminal.");
    console.log("-----------------------------------------\n");

    // Keep the script running to allow manual debugging
    // This effectively pauses the script while keeping the browser open
    await new Promise(() => {
      // This promise never resolves, keeping the script running
      // until manually terminated
    });
  } catch (error) {
    console.error("Error during test:", error);
  }
  // We don't close the browser here to allow for manual debugging
}

// Run the main function
main().catch(console.error);
