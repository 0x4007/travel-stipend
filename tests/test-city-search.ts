import { GoogleFlightsScraper } from "../src/utils/google-flights-scraper";
import { LOG_LEVEL } from "../src/utils/google-flights-scraper/config";
import { log } from "../src/utils/google-flights-scraper/log";

/**
 * Test script to verify city search and alliance filter functionality
 * Tests a specific city to debug issues with destination selection and alliance filters
 */
async function testCitySearch() {
  try {
    // Initialize the Google Flights scraper
    const scraper = new GoogleFlightsScraper();
    await scraper.initialize({ headless: false });
    await scraper.navigateToGoogleFlights();
    await scraper.changeCurrencyToUsd();

    // Test a specific city that had issues
    const testCity = "Helsinki, Finland";
    const origin = "Seoul, South Korea";
    const departureDate = "2025-05-25";
    const returnDate = "2025-06-01";

    log(LOG_LEVEL.INFO, `Testing search for ${testCity}`);

    // Search flights with screenshots enabled
    const result = await scraper.searchFlights(
      origin,
      testCity,
      departureDate,
      returnDate,
      true // Enable screenshots
    );

    // Log the result
    log(LOG_LEVEL.INFO, "Search result:", JSON.stringify({
      success: result.success,
      price: 'price' in result ? result.price : undefined,
      numPrices: 'prices' in result ? result.prices.length : 0,
      screenshotPath: 'screenshotPath' in result ? result.screenshotPath : undefined,
      selectedDestination: 'selectedDestination' in result ? result.selectedDestination : undefined,
      allianceFiltersApplied: 'allianceFiltersApplied' in result ? result.allianceFiltersApplied : undefined
    }, null, 2));

    // Close the scraper
    await scraper.close();

    log(LOG_LEVEL.INFO, "Test completed successfully");
  } catch (error) {
    log(LOG_LEVEL.ERROR, "Error running test:", error instanceof Error ? error.message : String(error));
  }
}

// Run the test
testCitySearch().catch(console.error);
