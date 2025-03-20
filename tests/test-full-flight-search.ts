import * as puppeteer from "puppeteer";
import { changeCurrencyToUsd } from "../src/utils/google-flights-scraper/currency-handler";
import { searchFlights } from "../src/utils/google-flights-scraper/flight-search";

async function main() {
  console.log("Starting full Google Flights search test...");

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

    // Navigate to Google Flights
    console.log("Navigating to Google Flights...");
    await page.goto("https://www.google.com/travel/flights", {
      waitUntil: "networkidle2",
      timeout: 60000,
    });
    console.log("Google Flights loaded");

    // Change currency to USD
    console.log("Changing currency to USD...");
    await changeCurrencyToUsd(page);

    // Define search parameters
    // Note: We're removing commas from city names to avoid issues
    const from = "Seoul Korea"; // No comma
    const to = "Tokyo Japan"; // No comma
    const today = new Date();
    const departureDate = new Date(today);
    departureDate.setDate(today.getDate() + 7); // One week in advance
    const returnDate = new Date(today);
    returnDate.setDate(today.getDate() + 14); // Two weeks in advance

    const departureDateString = departureDate.toISOString().split("T")[0];
    const returnDateString = returnDate.toISOString().split("T")[0];

    console.log(`Searching flights from ${from} to ${to}`);
    console.log(`Departure: ${departureDateString}, Return: ${returnDateString}`);

    // Perform the flight search
    const result = await searchFlights(page, from, to, departureDateString, returnDateString);

    // Display the results
    console.log("\n-----------------------------------------");
    console.log("Flight Search Results:");
    console.log(`Success: ${result.success}`);
    console.log(`Found ${result.prices.length} flight prices:`);

    if (result.prices.length > 0) {
      result.prices.forEach((flight, index) => {
        console.log(`Price ${index + 1}: $${typeof flight.price === "number" ? flight.price.toFixed(2) : "N/A"}`);
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
