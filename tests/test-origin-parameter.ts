#!/usr/bin/env bun
import { calculateTestStipend } from "./utils/stipend-test-helper";
import { DEFAULT_TEST_DESTINATIONS, DEFAULT_TEST_ORIGIN } from "./utils/test-constants";

async function testOriginParameter() {
  console.log("Testing origin parameter functionality...\n");

  // Test with default origin
  try {
    console.log("1. Testing with default origin:");
    const result = await calculateTestStipend({ location: DEFAULT_TEST_DESTINATIONS[0] });
    console.log(`- Origin: ${DEFAULT_TEST_ORIGIN}`);
    console.log(`- Destination: ${result.location}`);
    console.log(`- Flight cost: $${result.flight_cost}`);
    console.log(`- Total stipend: $${result.total_stipend}\n`);
  } catch (error) {
    console.error("Error testing default origin:", error);
  }

  // Test with custom origin
  try {
    const customOrigin = "London, GB";
    console.log("2. Testing with custom origin:");
    const result = await calculateTestStipend({ location: DEFAULT_TEST_DESTINATIONS[0] }, customOrigin);
    console.log(`- Origin: ${customOrigin}`);
    console.log(`- Destination: ${result.location}`);
    console.log(`- Flight cost: $${result.flight_cost}`);
    console.log(`- Total stipend: $${result.total_stipend}\n`);
  } catch (error) {
    console.error("Error testing custom origin:", error);
  }

  // Test same origin and destination
  try {
    console.log("3. Testing same origin and destination:");
    const result = await calculateTestStipend({ location: DEFAULT_TEST_ORIGIN }, DEFAULT_TEST_ORIGIN);
    console.log(`- Origin: ${DEFAULT_TEST_ORIGIN}`);
    console.log(`- Destination: ${result.location}`);
    console.log(`- Flight cost: $${result.flight_cost}`);
    console.log(`- Total stipend: $${result.total_stipend}\n`);

    if (result.flight_cost === 0) {
      console.log("✅ Flight cost is correctly $0 for same origin/destination");
    } else {
      console.error("❌ Flight cost should be $0 for same origin/destination");
    }
  } catch (error) {
    console.error("Error testing same origin/destination:", error);
  }
}

testOriginParameter().catch(console.error);
