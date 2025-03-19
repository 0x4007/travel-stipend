import { GoogleFlightsScraper } from "../utils/google-flights-scraper/google-flights-scraper";

// Set up process listeners for better debugging
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
});

async function testCurrencySelection() {
  console.log("Starting currency selection test with headful browser...");
  console.log("This test will open a browser window and attempt to change the currency to USD");
  console.log("Screenshots will be saved to logs/screenshots directory");

  const scraper = new GoogleFlightsScraper();

  try {
    // Initialize the scraper (this will launch a visible browser)
    console.log("Initializing browser...");
    await scraper.initialize({ headless: false });
    console.log("Browser initialized successfully");

    // Navigate to Google Flights
    console.log("Navigating to Google Flights...");
    await scraper.navigateToGoogleFlights();
    console.log("Successfully navigated to Google Flights");

    // Change currency to USD
    console.log("Attempting to change currency to USD...");
    await scraper.changeCurrencyToUsd();
    console.log("Successfully changed currency to USD");

    console.log("Test completed successfully!");
  } catch (error) {
    console.error("Test failed with error:", error);
    if (error instanceof Error) {
      console.error("Error stack:", error.stack);
    }
  } finally {
    // Close the browser
    console.log("Closing browser...");
    await scraper.close();
    console.log("Browser closed");
  }
}

// Run the test
console.log("Starting test...");
testCurrencySelection()
  .then(() => console.log("Test function completed"))
  .catch((error) => {
    console.error("Error in test execution:", error);
    process.exit(1);
  });
