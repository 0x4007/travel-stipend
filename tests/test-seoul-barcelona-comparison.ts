import { writeFileSync } from "fs";
import { join } from "path";
import { Coordinates } from "../src/types";
import { getDistanceKmFromCities } from "../src/utils/distance";
import { calculateFlightCost } from "../src/utils/flights";
import { GoogleFlightsScraper } from "../src/utils/google-flights-scraper";

async function main() {
  console.log("Starting Seoul to Barcelona flight price analysis...");

  // Test parameters
  const ORIGIN = "Seoul, South Korea";
  const DESTINATION = "Barcelona, Spain";
  const DEPARTURE_DATE = "2025-05-25"; // Using same dates as comprehensive test
  const RETURN_DATE = "2025-06-01";

  // Define coordinates
  const coordinates: Record<string, Coordinates> = {
    "Seoul, South Korea": { lat: 37.5665, lng: 126.978 },
    "Barcelona, Spain": { lat: 41.3851, lng: 2.1734 }
  };

  // Calculate distance
  const distanceKm = getDistanceKmFromCities(ORIGIN, DESTINATION, coordinates);
  console.log(`\nDistance: ${distanceKm.toFixed(0)}km`);

  // Get predicted price
  const predictedPrice = calculateFlightCost(distanceKm, DESTINATION, ORIGIN);
  console.log(`Predicted Price: $${predictedPrice}`);

  // Initialize Google Flights scraper
  const scraper = new GoogleFlightsScraper();

  try {
    // Initialize browser
    await scraper.initialize({ headless: true });
    console.log("\nBrowser initialized");

    // Navigate to Google Flights
    await scraper.navigateToGoogleFlights();
    console.log("Navigated to Google Flights");

    // Change currency to USD
    await scraper.changeCurrencyToUsd();
    console.log("Changed currency to USD");

    // Search for flights
    console.log(`\nSearching flights for dates: ${DEPARTURE_DATE} - ${RETURN_DATE}`);
    const flightResult = await scraper.searchFlights(ORIGIN, DESTINATION, DEPARTURE_DATE, RETURN_DATE);

    if (!flightResult.success || !("price" in flightResult)) {
      throw new Error("Failed to get flight price");
    }

    const actualPrice = flightResult.price;
    const pricePerKm = actualPrice / distanceKm;
    const errorPercent = ((predictedPrice - actualPrice) / actualPrice) * 100;

    // Create analysis report
    const analysisReport = {
      route: {
        origin: ORIGIN,
        destination: DESTINATION,
        distance: `${distanceKm.toFixed(0)}km`,
      },
      prices: {
        predicted: `$${predictedPrice}`,
        actual: `$${actualPrice}`,
        pricePerKm: `$${pricePerKm.toFixed(4)}/km`,
      },
      comparison: {
        error: `${errorPercent.toFixed(2)}%`,
        difference: `$${(predictedPrice - actualPrice).toFixed(2)}`,
      },
      googleFlightsUrl: flightResult.searchUrl || "URL not available",
      searchDate: new Date().toISOString(),
      flightDates: {
        departure: DEPARTURE_DATE,
        return: RETURN_DATE,
      },
    };

    // Save results
    const outputPath = join(process.cwd(), "test-results", "seoul-barcelona-analysis.json");
    writeFileSync(outputPath, JSON.stringify(analysisReport, null, 2));

    // Print results
    console.log("\nAnalysis Results:");
    console.log("================");
    console.log(`Route: ${ORIGIN} to ${DESTINATION}`);
    console.log(`Distance: ${distanceKm.toFixed(0)}km`);
    console.log(`Predicted Price: $${predictedPrice}`);
    console.log(`Actual Price: $${actualPrice}`);
    console.log(`Price per KM: $${pricePerKm.toFixed(4)}`);
    console.log(`Error: ${errorPercent.toFixed(2)}%`);
    console.log(`Results saved to: ${outputPath}`);

    if (flightResult.searchUrl) {
      console.log(`\nGoogle Flights URL: ${flightResult.searchUrl}`);
    }

  } catch (error) {
    console.error("Error during analysis:", error);
    throw error;
  } finally {
    await scraper.close();
    console.log("\nBrowser closed");
  }
}

// Run the analysis
main().catch(console.error);
