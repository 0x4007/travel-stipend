import { AmadeusApi } from "../src/utils/amadeus-api";
import { DatabaseService } from "../src/utils/database";
import { haversineDistance } from "../src/utils/distance";
import { calculateFlightCost } from "../src/utils/flights";

async function testBarcelonaPricingFixed() {
  // Define test parameters
  const origin = "Seoul, South Korea";
  const destination = "Barcelona, Spain";

  // Use IATA airport codes for Amadeus API
  const originCode = "ICN"; // Incheon International Airport (Seoul)
  const destCode = "BCN"; // Barcelona El Prat Airport

  // Use a date range a few months in the future
  const departureDate = "2025-06-15";
  const returnDate = "2025-06-22";

  console.log("===== BARCELONA FLIGHT PRICING COMPARISON (FIXED) =====");
  console.log(`Testing route: ${origin} to ${destination}`);
  console.log(`Using airport codes: ${originCode} to ${destCode}`);
  console.log(`Dates: ${departureDate} to ${returnDate}\n`);

  // Get API key and secret from environment variables
  const apiKey = process.env.AMADEUS_API_KEY;
  const apiSecret = process.env.AMADEUS_API_SECRET;

  if (!apiKey || !apiSecret) {
    console.error("Missing Amadeus API credentials in environment variables");
    return;
  }

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
      originCode, // Using airport code instead of city name
      destCode, // Using airport code instead of city name
      departureDate,
      returnDate
    );

    if (resultMajor.success && resultMajor.price) {
      console.log(`Major carriers average price: $${resultMajor.price}`);

      // Show individual flight options if available
      if (resultMajor.prices && resultMajor.prices.length > 0) {
        console.log(`\nFound ${resultMajor.prices.length} flight options from major carriers:`);
        resultMajor.prices.sort((a, b) => a.price - b.price);

        console.log("\nTop 5 cheapest major carrier flights:");
        const topFlights = resultMajor.prices.slice(0, 5);
        topFlights.forEach((flight, index) => {
          console.log(`${index + 1}. ${flight.airline}: $${flight.price}`);
        });

        // Calculate statistics
        const lowestPrice = resultMajor.prices[0].price;
        const highestPrice = resultMajor.prices[resultMajor.prices.length - 1].price;
        const avgPrice = Math.round(resultMajor.prices.reduce((sum, flight) => sum + flight.price, 0) / resultMajor.prices.length);

        console.log(`\nPrice statistics for major carriers:`);
        console.log(`- Lowest price: $${lowestPrice}`);
        console.log(`- Highest price: $${highestPrice}`);
        console.log(`- Average price: $${avgPrice}`);
      }

      // Show stats about available flights
      if (resultMajor.allPrices && resultMajor.allPrices.length > 0) {
        console.log(`\nTotal flights found (including non-major carriers): ${resultMajor.allPrices.length}`);
        console.log(`Number of flights filtered out: ${resultMajor.allPrices.length - (resultMajor.prices?.length || 0)}`);

        // Calculate filtering impact percentage
        const filterPercentage = Math.round(((resultMajor.allPrices.length - (resultMajor.prices?.length || 0)) / resultMajor.allPrices.length) * 100);
        console.log(`Percentage of flights filtered out: ${filterPercentage}%`);
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
      originCode, // Using airport code instead of city name
      destCode, // Using airport code instead of city name
      departureDate,
      returnDate
    );

    if (resultAll.success && resultAll.price) {
      console.log(`All carriers average price: $${resultAll.price}`);

      // Show individual flight options if available
      if (resultAll.prices && resultAll.prices.length > 0) {
        console.log(`\nFound ${resultAll.prices.length} flight options (all carriers):`);

        // Show the top 10 cheapest flights
        console.log("\nTop 10 cheapest flights (all carriers):");
        resultAll.prices.sort((a, b) => a.price - b.price);
        const topFlights = resultAll.prices.slice(0, 10);
        topFlights.forEach((flight, index) => {
          console.log(`${index + 1}. ${flight.airline}: $${flight.price}`);
        });

        // Calculate statistics
        const lowestPrice = resultAll.prices[0].price;
        const highestPrice = resultAll.prices[resultAll.prices.length - 1].price;
        const avgPrice = Math.round(resultAll.prices.reduce((sum, flight) => sum + flight.price, 0) / resultAll.prices.length);

        console.log(`\nPrice statistics for all carriers:`);
        console.log(`- Lowest price: $${lowestPrice}`);
        console.log(`- Highest price: $${highestPrice}`);
        console.log(`- Average price: $${avgPrice}`);

        // Compare to distance-based price
        const db = DatabaseService.getInstance();
        const originCoords = await db.getCityCoordinates(origin);
        const destCoords = await db.getCityCoordinates(destination);

        if (originCoords.length && destCoords.length) {
          const distanceKm = haversineDistance(originCoords[0], destCoords[0]);
          const distanceBasedPrice = calculateFlightCost(distanceKm, destination, origin);

          console.log(`\nComparison to Distance-Based Price ($${distanceBasedPrice}):`);
          const amadeusVsDistance = Math.round(((avgPrice - distanceBasedPrice) / distanceBasedPrice) * 100);
          console.log(`- Amadeus average is ${amadeusVsDistance}% ${amadeusVsDistance >= 0 ? "higher" : "lower"} than distance-based`);

          const lowestVsDistance = Math.round(((lowestPrice - distanceBasedPrice) / distanceBasedPrice) * 100);
          console.log(`- Amadeus lowest is ${lowestVsDistance}% ${lowestVsDistance >= 0 ? "higher" : "lower"} than distance-based`);
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
testBarcelonaPricingFixed()
  .catch(console.error)
  .finally(() => process.exit(0));
