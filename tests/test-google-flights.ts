import { GoogleFlightsScraper } from "../src/utils/google-flights-scraper";

async function main() {
  console.log("Starting Google Flights scraper test...");

  // Create and initialize the scraper
  const scraper = new GoogleFlightsScraper();

  try {
    // Initialize the browser
    await scraper.initialize();
    console.log("Browser initialized");

    // Navigate to Google Flights
    await scraper.navigateToGoogleFlights();
    console.log("Navigated to Google Flights");

    // Change currency to USD
    await scraper.changeCurrencyToUsd();
    console.log("Changed currency to USD");

    // Set search parameters
    const from = "Seoul, South Korea";
    const to = "Tokyo, Japan";

    // Get date for next week
    const today = new Date();
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);

    // Format departure date (next week, same day of the week)
    const departureDate = `${nextWeek.getFullYear()}-${String(nextWeek.getMonth() + 1).padStart(2, "0")}-${String(nextWeek.getDate()).padStart(2, "0")}`;

    // Format return date (departure + 7 days)
    const returnDay = new Date(nextWeek);
    returnDay.setDate(returnDay.getDate() + 7);
    const returnDate = `${returnDay.getFullYear()}-${String(returnDay.getMonth() + 1).padStart(2, "0")}-${String(returnDay.getDate()).padStart(2, "0")}`;

    console.log(`Searching for flights from ${from} to ${to}`);
    console.log(`Departure: ${departureDate}, Return: ${returnDate}`);

    // Search for flights
    const flightData = await scraper.searchFlights(from, to, departureDate, returnDate);

    // Display flight data
    console.log("\nFlight search results:");
    console.log("=====================");

    if (flightData) {
      console.log(`Found ${flightData.prices.length} flight prices`);

      console.trace("Flight data:", flightData);

      if (flightData.prices.length > 0) {
        console.log("\nPrices:");
        flightData.prices.forEach((price: number, index: number) => {
          console.log(`  ${index + 1}. ${price}`);
        });
      }

      if (flightData.airlines.length > 0) {
        console.log("\nAirlines:");
        flightData.airlines.forEach((airline: string, index: number) => {
          console.log(`  ${index + 1}. ${airline}`);
        });
      }

      if (flightData.durations.length > 0) {
        console.log("\nDurations:");
        flightData.durations.forEach((duration: string, index: number) => {
          console.log(`  ${index + 1}. ${duration}`);
        });
      }

      // Times are no longer included in the flight data

      // Log price elements count if available
      if ("priceElements" in flightData) {
        console.log("\nPrice elements found:");
        console.log(`  Count: ${flightData.priceElements}`);
      }
    } else {
      console.log("No flight data found");
    }
  } catch (error) {
    console.error("Error during flight search:", error);
  } finally {
    // Close the browser
    await scraper.close();
    console.log("Browser closed");
  }
}

// Run the main function
main().catch(console.error);
