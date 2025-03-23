import { DistanceBasedStrategy } from "../src/strategies/distance-based-strategy";
import { GoogleFlightsStrategy } from "../src/strategies/google-flights-strategy";
import { FlightDates } from "../src/strategies/flight-pricing-strategy";

/**

To run this test:
bun run tests/test-distance-pricing-validation.ts
This test compares distance-based pricing with actual Google Flights prices */ async function testDistancePricingValidation() { const testRoutes = [ { origin: "Seoul, South Korea", destination: "Barcelona, Spain" }, { origin: "Tokyo, Japan", destination: "Paris, France" }, { origin: "Singapore", destination: "London, UK" }, { origin: "Hong Kong", destination: "Madrid, Spain" }, { origin: "Bangkok, Thailand", destination: "Rome, Italy" }, ];
const dates: FlightDates = { outbound: "2025-06-15", return: "2025-06-22" };

const distanceStrategy = new DistanceBasedStrategy();
const googleFlights = new GoogleFlightsStrategy();

console.log("\n=== DISTANCE-BASED PRICING VS GOOGLE FLIGHTS COMPARISON ===\n");
console.log("Initializing Google Flights scraper (this may take a minute)...\n");

// Initialize Google Flights browser
await googleFlights.isAvailable();

const results = [];

for (const route of testRoutes) {
try {
console.log(`Testing ${route.origin} to ${route.destination}`);

  const [distancePrice, googlePrice] = await Promise.all([
    distanceStrategy.getFlightPrice(route.origin, route.destination, dates),
    googleFlights.getFlightPrice(route.origin, route.destination, dates)
  ]);

  results.push({
    route: `${route.origin} to ${route.destination}`,
    distancePrice: distancePrice.price,
    googlePrice: googlePrice.price,
    difference: ((distancePrice.price - googlePrice.price) / googlePrice.price * 100).toFixed(1)
  });

} catch (err) {
  console.error(`Error processing route:`, err);
}
}

// Print comparison results
console.log("\nPrice Comparison Results:");
results.forEach(r => {
console.log(`\n${r.route}`);
console.log(`Distance-based price: $${r.distancePrice}`);
console.log(`Google Flights price: $${r.googlePrice}`);
console.log(`Difference: ${r.difference}%`);
});

// Calculate average difference
const avgDiff = results.reduce((sum, r) => sum + Math.abs(Number(r.difference)), 0) / results.length;

console.log("\nOverall Analysis:");
console.log(`Average price difference: ${avgDiff.toFixed(1)}%`);

if (avgDiff > 30) {
console.log("\n❌ FAILED: Distance-based prices significantly differ from actual flight prices");
console.log("The pricing model needs adjustment to better reflect market rates");
} else if (avgDiff > 15) {
console.log("\n⚠️ WARNING: Distance-based prices show moderate deviation from actual prices");
console.log("Consider fine-tuning the pricing model");
} else {
console.log("\n✅ PASSED: Distance-based prices closely match actual flight prices");
console.log("The pricing model appears to be working well");
}

// Cleanup
await googleFlights.cleanup();
}

// Run the test
testDistancePricingValidation()
.catch(console.error)
.finally(() => process.exit(0));