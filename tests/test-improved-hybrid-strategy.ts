import { AmadeusStrategy } from "../src/strategies/amadeus-strategy";
import { DistanceBasedStrategy } from "../src/strategies/distance-based-strategy";
import { HybridStrategy } from "../src/strategies/hybrid-strategy";
import { ImprovedHybridStrategy } from "../src/strategies/improved-hybrid-strategy";

async function testImprovedHybridStrategy() {
  const origin = "Seoul, South Korea";
  const destination = "Barcelona, Spain";

  // Use a date range a few months in the future
  const departureDate = "2025-06-15";
  const returnDate = "2025-06-22";

  const dates = { outbound: departureDate, return: returnDate };

  console.log("===== BARCELONA IMPROVED HYBRID STRATEGY TEST =====");
  console.log(`Testing route: ${origin} to ${destination}`);
  console.log(`Dates: ${departureDate} to ${returnDate}\n`);

  // 1. Test with Distance-Based Strategy
  console.log("1. DISTANCE-BASED CALCULATION:");
  const distanceStrategy = new DistanceBasedStrategy();
  try {
    const result1 = await distanceStrategy.getFlightPrice(origin, destination, dates);
    console.log(`Distance-based result: $${result1.price} (${result1.source})\n`);
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await distanceStrategy.cleanup();
  }

  // 2. Test with Amadeus Strategy (all carriers)
  console.log("2. AMADEUS API (ALL CARRIERS):");
  const amadeusStrategy = new AmadeusStrategy(false); // false = don't filter for major carriers
  try {
    const result2 = await amadeusStrategy.getFlightPrice(origin, destination, dates);
    console.log(`Amadeus result (all carriers): $${result2.price} (${result2.source})\n`);
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await amadeusStrategy.cleanup();
  }

  // 3. Test with original Hybrid Strategy
  console.log("3. ORIGINAL HYBRID STRATEGY:");
  const hybridStrategy = new HybridStrategy();
  try {
    const result3 = await hybridStrategy.getFlightPrice(origin, destination, dates);
    console.log(`Original hybrid result: $${result3.price} (${result3.source})\n`);
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await hybridStrategy.cleanup();
  }

  // 4. Test with Improved Hybrid Strategy (default settings)
  console.log("4. IMPROVED HYBRID STRATEGY (DEFAULT SETTINGS):");
  const improvedHybridDefault = new ImprovedHybridStrategy();
  try {
    const result4 = await improvedHybridDefault.getFlightPrice(origin, destination, dates);
    console.log(`Improved hybrid result (default): $${result4.price} (${result4.source})\n`);
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await improvedHybridDefault.cleanup();
  }

  // 5. Test with Improved Hybrid Strategy (using lowest Amadeus price)
  console.log("5. IMPROVED HYBRID STRATEGY (USING LOWEST PRICE):");
  const improvedHybridLowest = new ImprovedHybridStrategy(30, true, false);
  try {
    const result5 = await improvedHybridLowest.getFlightPrice(origin, destination, dates);
    console.log(`Improved hybrid result (lowest): $${result5.price} (${result5.source})\n`);
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await improvedHybridLowest.cleanup();
  }

  // 6. Test with Improved Hybrid Strategy (strict discrepancy check)
  console.log("6. IMPROVED HYBRID STRATEGY (STRICT DISCREPANCY CHECK):");
  const improvedHybridStrict = new ImprovedHybridStrategy(15, true, false);
  try {
    const result6 = await improvedHybridStrict.getFlightPrice(origin, destination, dates);
    console.log(`Improved hybrid result (strict): $${result6.price} (${result6.source})\n`);
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await improvedHybridStrict.cleanup();
  }

  console.log("===== TEST COMPLETE =====");
}

// Run the test
testImprovedHybridStrategy()
  .catch(console.error)
  .finally(() => process.exit(0));
