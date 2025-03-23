import { AmadeusApi } from "../src/utils/amadeus-api";
import { DatabaseService } from "../src/utils/database";
import { haversineDistance } from "../src/utils/distance";
import { calculateFlightCost } from "../src/utils/flights";

async function testBarcelonaPricingDetailed() {
  // Define test parameters
  const origin = "Seoul, South Korea";
  const destination = "Barcelona, Spain";

  // Use a date range a few months in the future
  const departureDate = "2025-06-15";
  const returnDate = "2025-06-22";

  console.log("===== BARCELONA FLIGHT PRICING DETAILED ANALYSIS =====");
  console.log(`Testing route: ${origin} to ${destination}`);
  console.log(`Dates: ${departureDate} to ${returnDate}\n`);

  // Get API key and secret from environment variables
  const apiKey = process.env.AMADEUS_API_KEY;
  const apiSecret = process.env.AMADEUS_API_SECRET;

  if (!apiKey || !apiSecret) {
    console.error("Missing Amadeus API credentials in environment variables");
    return;
  }

  // Extract city names
  const originCity = origin.split(",")[0].trim();
  const destCity = destination.split(",")[0].trim();

  console.log("1. DISTANCE-BASED CALCULATION:");
  try {
    // Get coordinates from database
    const db = DatabaseService.getInstance();
    const originCoords = await db.getCityCoordinates(origin);
    const destCoords = await db.getCityCoordinates(destination);

    if (!originCoords.length || !destCoords.length) {
      throw new Error(`Could not find coordinates for ${!originCoords.length ? origin : destination}`);
    }

    // Create coordinates objects
    const originCoord = originCoords[0];
    const destCoord = destCoords[0];

    // Calculate distance directly with haversine
    const distanceKm = haversineDistance(originCoord, destCoord);
    console.log(`Distance from ${origin} to ${destination}: ${distanceKm.toFixed(1)} km`);

    // Calculate flight cost
    const flightCost = calculateFlightCost(distanceKm, destination, origin);
    console.log(`Distance-based flight cost: $${flightCost}\n`);
  } catch (err) {
    console.error("Error calculating distance-based price:", err);
  }

  console.log("2. AMADEUS API WITH MAJOR CARRIERS ONLY:");
  try {
    console.log("Searching for flights with major carriers only...");
    const amadeusWithMajor = new AmadeusApi(apiKey, apiSecret, true);
    const resultMajor = await amadeusWithMajor.searchFlights(
      originCity,
      destCity,
      departureDate,
      returnDate
    );

    if (resultMajor.success && resultMajor.price) {
      console.log(`Major carriers average price: $${resultMajor.price}`);

      // Show individual flight options if available
      if (resultMajor.prices && resultMajor.prices.length > 0) {
        console.log(`\nFound ${resultMajor.prices.length} flight options from major carriers:`);
        resultMajor.prices.sort((a, b) => a.price - b.price);
        resultMajor.prices.forEach((flight, index) => {
          console.log(`${index + 1}. ${flight.airline}: $${flight.price}`);
        });
      }

      // Show stats about available flights
      if (resultMajor.allPrices && resultMajor.allPrices.length > 0) {
        console.log(`\nTotal flights found (including non-major carriers): ${resultMajor.allPrices.length}`);
        console.log(`Number of flights filtered out: ${resultMajor.allPrices.length - (resultMajor.prices?.length || 0)}`);
      }
    } else {
      console.log("No major carrier flights found");
    }
    console.log("\n");
  } catch (err) {
    console.error("Error searching with major carriers:", err);
  }

  console.log("3. AMADEUS API WITH ALL CARRIERS:");
  try {
    console.log("Searching for flights with all carriers (including budget)...");
    const amadeusAllCarriers = new AmadeusApi(apiKey, apiSecret, false);
    const resultAll = await amadeusAllCarriers.searchFlights(
      originCity,
      destCity,
      departureDate,
      returnDate
    );

    if (resultAll.success && resultAll.price) {
      console.log(`All carriers average price: $${resultAll.price}`);

      // Show individual flight options if available
      if (resultAll.prices && resultAll.prices.length > 0) {
        console.log(`\nFound ${resultAll.prices.length} flight options (all carriers):`);
        resultAll.prices.sort((a, b) => a.price - b.price);

        // Show the top 10 cheapest flights
        const topFlights = resultAll.prices.slice(0, 10);
        topFlights.forEach((flight, index) => {
          console.log(`${index + 1}. ${flight.airline}: $${flight.price}`);
        });

        // Calculate percentage difference between major carriers and all carriers
        if (resultAll.allPrices && resultAll.allPrices.length > 0) {
          const minPriceMajor = resultAll.prices[0].price;
          console.log(`\nCheapest flight: $${minPriceMajor}`);

          // Calculate average price
          const avgPrice = resultAll.prices.reduce((sum, flight) => sum + flight.price, 0) /
                          resultAll.prices.length;
          console.log(`Average price: $${Math.round(avgPrice)}`);
        }
      }
    } else {
      console.log("No flights found");
    }
  } catch (err) {
    console.error("Error searching with all carriers:", err);
  }

  console.log("\n===== ANALYSIS COMPLETE =====");
}

// Run the test
testBarcelonaPricingDetailed()
  .catch(console.error)
  .finally(() => process.exit(0));
