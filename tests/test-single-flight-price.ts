import { GoogleFlightsScraper } from "../src/utils/google-flights-scraper";

const ORIGIN = "Seoul, South Korea";
const DESTINATION = "Tokyo, Japan"; // A relatively close destination for quick testing
const DEPARTURE_DATE = "2025-05-25";
const RETURN_DATE = "2025-06-01";

async function testSingleFlightPrice() {
  let scraper: GoogleFlightsScraper | undefined;

  try {
    console.log("=== Single Flight Price Test ===");
    console.log(`Testing route: ${ORIGIN} → ${DESTINATION}`);
    console.log(`Dates: ${DEPARTURE_DATE} to ${RETURN_DATE}`);

    // Initialize scraper in training mode with more logging
    scraper = new GoogleFlightsScraper(true);
    await scraper.initialize({ headless: true });
    console.log("Browser initialized");

    await scraper.navigateToGoogleFlights();
    console.log("Navigated to Google Flights");

    // Add delay before currency change
    await new Promise((resolve) => setTimeout(resolve, 3000));

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

    // Search for flights
    console.log("\nSearching for flights...");
    const result = await scraper.searchFlights(ORIGIN, DESTINATION, DEPARTURE_DATE, RETURN_DATE);

    if (result.success && "price" in result) {
      console.log("\nFlight search successful!");
      console.log(`Price: $${result.price}`);
      if (result.searchUrl) {
        console.log(`URL: ${result.searchUrl}`);
      }
    } else {
      console.error("\nFlight search failed");
      console.error("Result:", JSON.stringify(result, null, 2));
    }
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
console.log("Starting test...");
testSingleFlightPrice().catch(console.error);
