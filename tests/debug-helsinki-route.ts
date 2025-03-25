import { GoogleFlightsScraper } from "../src/utils/google-flights-scraper";

// Set up a minimal test for the Helsinki route
async function testHelsinki() {
  const origin = "Seoul, South Korea";
  const destination = "Helsinki, Finland";
  const departureDate = "2025-05-25";
  const returnDate = "2025-06-01";

  // Initialize scraper in training mode to avoid using cache
  const scraper = new GoogleFlightsScraper(true);
  console.log("Initializing browser...");
  await scraper.initialize({ headless: false });

  console.log("Navigating to Google Flights...");
  await scraper.navigateToGoogleFlights();

  // Wait to ensure page is loaded
  await new Promise((resolve) => setTimeout(resolve, 2000));

  console.log("Changing currency to USD...");
  await scraper.changeCurrencyToUsd();

  // Wait after currency change
  await new Promise((resolve) => setTimeout(resolve, 2000));

  console.log(`Searching flights from ${origin} to ${destination}...`);
  const result = await scraper.searchFlights(origin, destination, departureDate, returnDate, true);

  // Log detailed results
  if (result.success && "prices" in result) {
    console.log("Result:", result);

    // Show all prices
    console.log("\nAll flight prices:");
    result.prices.forEach((price, index) => {
      console.log(`[${index + 1}] $${price.price} - ${price.airline} - ${price.duration} - ${price.stops} stops - isTopFlight: ${price.isTopFlight}`);
    });

    // Calculate averages for comparison
    const topFlightPrices = result.prices.filter((p) => p.isTopFlight).map((p) => p.price);
    const allFlightPrices = result.prices.map((p) => p.price);

    const topFlightAvg = topFlightPrices.length > 0 ? topFlightPrices.reduce((sum, price) => sum + price, 0) / topFlightPrices.length : 0;

    const allFlightAvg = allFlightPrices.length > 0 ? allFlightPrices.reduce((sum, price) => sum + price, 0) / allFlightPrices.length : 0;

    console.log("\nPrice Analysis:");
    console.log(`Top Flights (${topFlightPrices.length}): $${Math.round(topFlightAvg)}`);
    console.log(`All Flights (${allFlightPrices.length}): $${Math.round(allFlightAvg)}`);
    console.log(`Final price used: $${"price" in result ? result.price : "N/A"}`);

    if (topFlightPrices.length === 0) {
      console.log("\nWARNING: No top flights found! Check DOM selectors in price-scraper.ts");
    }
  } else {
    console.error("Flight search failed:", result);
  }

  await scraper.close();
}

// Run the test
testHelsinki()
  .then(() => console.log("Test completed"))
  .catch((error) => console.error("Test failed:", error))
  .finally(() => process.exit());
