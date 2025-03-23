#!/usr/bin/env bun
/**
 * Test script to verify all the fixes we made:
 * 1. Accept simple city names like "dubai"
 * 2. Fix CSV import paths
 * 3. Fix Amadeus API key reading
 * 4. Remove "calculated with enhanced model" text
 * 5. Fix end date display in output table
 */

import { calculateStipend } from "./travel-stipend-calculator";
import { DatabaseService } from "./utils/database";
import { AmadeusStrategy } from "./strategies/amadeus-strategy";
import { validateDestination } from "./utils/destination-validator";
import { ORIGIN } from "./utils/constants";

// Test a simple destination validation
async function testDestinationValidation() {
  console.log("\n===== TESTING DESTINATION VALIDATION =====");
  const tests = ["dubai", "Dubai", "Dubai, AE", "Singapore", "New York"];

  for (const test of tests) {
    const result = await validateDestination(test);
    console.log(`Validating '${test}': ${result.isValid ? "✅ VALID" : "❌ INVALID"}`);
    if (result.validatedDestination) {
      console.log(`  Validated as: ${result.validatedDestination}`);
    }
    if (result.error) {
      console.log(`  Error: ${result.error}`);
    }
  }
}

// Test database seed data
async function testDatabaseSeed() {
  console.log("\n===== TESTING DATABASE SEED DATA =====");
  const db = DatabaseService.getInstance();

  // Check coordinates table
  const dubaiFull = await db.getCityCoordinates("Dubai, AE");
  const dubaiSimple = await db.getCityCoordinates("dubai");
  const singapore = await db.getCityCoordinates("Singapore");

  console.log(`'Dubai, AE' coordinates: ${dubaiFull.length > 0 ? "✅ Found" : "❌ Not found"}`);
  console.log(`'dubai' coordinates: ${dubaiSimple.length > 0 ? "✅ Found" : "❌ Not found"}`);
  console.log(`'Singapore' coordinates: ${singapore.length > 0 ? "✅ Found" : "❌ Not found"}`);
}

// Test Amadeus API keys
async function testAmadeusKeys() {
  console.log("\n===== TESTING AMADEUS API =====");

  const amadeus = new AmadeusStrategy();
  const isAvailable = await amadeus.isAvailable();

  console.log(`Amadeus API available: ${isAvailable ? "✅ YES" : "❌ NO"}`);

  if (!isAvailable) {
    // Log available environment variables for debugging
    console.log("Environment variables:");
    console.log(`  AMADEUS_API_KEY: ${process.env.AMADEUS_API_KEY ? "Set" : "Not set"}`);
    console.log(`  AMADEUS_API_SECRET: ${process.env.AMADEUS_API_SECRET ? "Set" : "Not set"}`);
  }
}

// Test the stipend calculation with different formats
async function testStipendCalculation() {
  console.log("\n===== TESTING STIPEND CALCULATION =====");

  // Create test conference records
  const conferences = [
    {
      conference: "Test Conference Dubai",
      location: "dubai", // Simple format test
      start_date: "1 April",
      end_date: "3 April", // End date specified
      category: "Test",
      ticket_price: "",  // Add required properties to match Conference type
      description: ""
    },
    {
      conference: "Test Conference Singapore",
      location: "Singapore, SG", // Full format test
      start_date: "10 May",
      end_date: "", // Empty end date
      category: "Test",
      ticket_price: "",
      description: ""
    }
  ];

  // Calculate stipend for each test case
  for (const conf of conferences) {
    console.log(`\nCalculating stipend for ${conf.conference} in ${conf.location}...`);
    try {
      const result = await calculateStipend(conf);
      console.log("Result:");
      console.log(`  Start: ${result.conference_start}`);
      console.log(`  End: ${result.conference_end}`);
      console.log(`  Flight cost: $${result.flight_cost} (Source: ${result.flight_price_source})`);
      console.log(`  Total stipend: $${result.total_stipend}`);

      // Check if "enhanced model" text appears in the flight price source
      if (result.flight_price_source.includes("enhanced model")) {
        console.log("❌ Found 'enhanced model' text in flight price source");
      } else {
        console.log("✅ No 'enhanced model' text in flight price source");
      }

      // Check if end date is correctly populated when the original was empty
      if (conf.end_date === "" && result.conference_end && result.conference_end !== result.conference_start) {
        console.log("✅ End date was correctly populated from conference duration");
      } else if (conf.end_date === "" && (!result.conference_end || result.conference_end === result.conference_start)) {
        console.log("❌ End date was not correctly calculated");
      }
    } catch (error) {
      console.error(`Error calculating stipend for ${conf.conference}:`, error);
    }
  }
}

// Main function
async function main() {
  try {
    console.log("STARTING TEST SCRIPT");
    console.log(`Origin: ${ORIGIN}`);

    // Run tests
    await testDestinationValidation();
    await testDatabaseSeed();
    await testAmadeusKeys();
    await testStipendCalculation();

    console.log("\nTEST SCRIPT COMPLETED");
  } catch (error) {
    console.error("Error:", error);
  } finally {
    // Clean up
    await DatabaseService.getInstance().close();
  }
}

// Execute the main function and handle any errors
void main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
