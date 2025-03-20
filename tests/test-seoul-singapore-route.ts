import { GoogleFlightsScraper } from "../src/utils/google-flights-scraper";

async function main() {
  console.log("Starting Google Flights scraper test for Seoul to Singapore route...");

  // Create and initialize the scraper with headless mode disabled for visual inspection
  const scraper = new GoogleFlightsScraper();

  try {
    // Initialize the browser in non-headless mode to see what's happening
    await scraper.initialize({ headless: false });
    console.log("Browser initialized in non-headless mode for visual inspection");

    // Navigate to Google Flights
    await scraper.navigateToGoogleFlights();
    console.log("Navigated to Google Flights");

    // Change currency to USD
    await scraper.changeCurrencyToUsd();
    console.log("Changed currency to USD");

    // Set search parameters - try different variations of the city names
    const variations = [
      { from: "Seoul, South Korea", to: "Singapore" },
      { from: "Seoul", to: "Singapore" },
      { from: "ICN", to: "SIN" }, // Try airport codes
      { from: "Incheon International Airport", to: "Singapore Changi Airport" }, // Try full airport names
    ];

    // Use specific dates that are known to work for other routes
    const departureDate = "2025-03-27";
    const returnDate = "2025-04-03";

    // Try each variation
    for (const { from, to } of variations) {
      console.log(`\nTrying variation: ${from} to ${to}`);
      console.log(`Departure: ${departureDate}, Return: ${returnDate}`);

      try {
        // Search for flights
        const flightData = await scraper.searchFlights(from, to, departureDate, returnDate);

        // Display flight data
        console.log("\nFlight search results:");
        console.log("=====================");

        if (flightData?.success) {
          console.log(`Found ${flightData.prices.length} flight prices`);

          if (flightData.prices.length > 0) {
            console.log("\nPrices:");
            flightData.prices.forEach((flight, index) => {
              console.log(`  ${index + 1}. $${flight.price} (${flight.isTopFlight ? "Top Flight" : "Regular Flight"})`);

              // Handle airline property (might be string or array depending on implementation)
              if (typeof flight.airline === "string") {
                console.log(`     Airline: ${flight.airline}`);
              } else if (Array.isArray(flight.airline)) {
                console.log(`     Airlines: ${(flight.airline as string[]).join(", ")}`);
              } else {
                console.log(`     Airline: Unknown`);
              }

              console.log(`     Duration: ${flight.duration ?? "Unknown"}`);
              console.log(`     Stops: ${flight.stops}`);
              console.log(`     Route: ${flight.origin ?? "Unknown"} -> ${flight.destination ?? "Unknown"}`);
              console.log(`     Times: ${flight.departureTime ?? "Unknown"} - ${flight.arrivalTime ?? "Unknown"}`);
              console.log("");
            });

            console.log("\nThis variation worked successfully!");
            break; // Exit the loop if we found a working variation
          } else {
            console.log("No flight prices found in the results");
          }
        } else {
          console.log("No flight data found or search was not successful");
        }
      } catch (error) {
        console.error(`Error during flight search for ${from} to ${to}:`, error);
        console.log("Continuing with next variation...");
      }

      // Wait a bit before trying the next variation
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }

    // Pause to allow manual inspection
    console.log("\nPausing for manual inspection. Press Ctrl+C to exit.");
    await new Promise(() => {}); // This promise never resolves, keeping the browser open
  } catch (error) {
    console.error("Error during test:", error);
  } finally {
    // We don't close the browser here to allow for manual inspection
    console.log("Test completed. Browser left open for inspection.");
  }
}

// Run the main function
main().catch(console.error);
