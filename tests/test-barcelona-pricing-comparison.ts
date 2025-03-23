import { AmadeusStrategy } from "../src/strategies/amadeus-strategy";
import { DistanceBasedStrategy } from "../src/strategies/distance-based-strategy";
import { GoogleFlightsStrategy } from "../src/strategies/google-flights-strategy";

async function testBarcelonaPricing() {
  const origin = "Seoul, South Korea";
  const destination = "Barcelona, Spain";

  // Use a date range a few months in the future
  const departureDate = "2025-06-15";
  const returnDate = "2025-06-22";

  const dates = { outbound: departureDate, return: returnDate };

  console.log("===== BARCELONA FLIGHT PRICING COMPARISON =====");
  console.log(`Testing route: ${origin} to ${destination}`);
  console.log(`Dates: ${departureDate} to ${returnDate}\n`);

  // Test with major carriers only (current default)
  const amadeusWithMajorCarriers = new AmadeusStrategy(true);
  console.log("Testing Amadeus with MAJOR CARRIERS ONLY...");
  try {
    const result1 = await amadeusWithMajorCarriers.getFlightPrice(origin, destination, dates);
    console.log(`Result: $${result1.price} (${result1.source})\n`);
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await amadeusWithMajorCarriers.cleanup();
  }

  // Test with ALL carriers (including budget airlines)
  const amadeusAllCarriers = new AmadeusStrategy(false);
  console.log("Testing Amadeus with ALL CARRIERS (including budget)...");
  try {
    const result2 = await amadeusAllCarriers.getFlightPrice(origin, destination, dates);
    console.log(`Result: $${result2.price} (${result2.source})\n`);
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await amadeusAllCarriers.cleanup();
  }

  // Get distance-based price for comparison
  const distanceStrategy = new DistanceBasedStrategy();
  console.log("Testing DISTANCE-BASED calculation...");
  try {
    const result3 = await distanceStrategy.getFlightPrice(origin, destination, dates);
    console.log(`Result: $${result3.price} (${result3.source})\n`);
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await distanceStrategy.cleanup();
  }

  // Try Google Flights if available
  const googleStrategy = new GoogleFlightsStrategy();
  console.log("Testing GOOGLE FLIGHTS scraper...");
  try {
    if (await googleStrategy.isAvailable()) {
      const result4 = await googleStrategy.getFlightPrice(origin, destination, dates);
      console.log(`Result: $${result4.price} (${result4.source})\n`);
    } else {
      console.log("Google Flights scraper not available\n");
    }
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await googleStrategy.cleanup();
  }

  console.log("===== TEST COMPLETE =====");
}

// Run the test
testBarcelonaPricing()
  .catch(console.error)
  .finally(() => process.exit(0));
