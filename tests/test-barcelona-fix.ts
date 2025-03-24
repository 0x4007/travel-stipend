import { DEFAULT_TEST_ORIGIN } from "./utils/test-constants";
import { DatabaseService } from "../src/utils/database";
import { haversineDistance } from "../src/utils/distance";

async function testBarcelonaFix() {
  // Initialize database
  const db = DatabaseService.getInstance();

  // Test the current behavior
  console.log("Current behavior:");
  console.log("-----------------");
  try {
    const originCoords = await db.getCityCoordinates(DEFAULT_TEST_ORIGIN);
    const destCoords = await db.getCityCoordinates("Barcelona");

    if (!originCoords.length || !destCoords.length) {
      throw new Error(`Could not find coordinates for ${!originCoords.length ? DEFAULT_TEST_ORIGIN : "Barcelona"}`);
    }

    const distance = haversineDistance(originCoords[0], destCoords[0]);
    console.log(`Distance from ${DEFAULT_TEST_ORIGIN} to Barcelona: ${Math.round(distance)} km (matches Barcelona, Philippines)`);
  } catch (error) {
    console.log(`Error: ${(error as Error).message}`);
  }

  // Proposed fix: Always use country-qualified city names for important cities
  console.log("\nProposed fix:");
  console.log("-------------");
  try {
    const originCoords = await db.getCityCoordinates(DEFAULT_TEST_ORIGIN);
    const destCoords = await db.getCityCoordinates("Barcelona, Spain");

    if (!originCoords.length || !destCoords.length) {
      throw new Error(`Could not find coordinates for ${!originCoords.length ? DEFAULT_TEST_ORIGIN : "Barcelona, Spain"}`);
    }

    const distance = haversineDistance(originCoords[0], destCoords[0]);
    console.log(`Distance from ${DEFAULT_TEST_ORIGIN} to Barcelona, Spain: ${Math.round(distance)} km`);
  } catch (error) {
    console.log(`Error: ${(error as Error).message}`);
  }

  // Explanation of the issue
  console.log("\nExplanation:");
  console.log("------------");
  console.log("The issue is that there are multiple cities named 'Barcelona' in the coordinates database:");
  console.log("1. Barcelona, Philippines (lat: 12.8694, lng: 124.1419) - Distance from Seoul: ~2760 km");
  console.log("2. Barcelona, Spain (lat: 41.3828, lng: 2.1769) - Distance from Seoul: ~9603 km");
  console.log("3. Barcelona, Venezuela (lat: 10.1403, lng: -64.6833) - Distance from Seoul: ~14573 km");
  console.log("\nWhen using just 'Barcelona' without a country, the system matches with Barcelona, Philippines");
  console.log("because it appears first in the coordinates database when loading city names.");
  console.log("\nTo ensure consistent results, always use country-qualified city names (e.g., 'Barcelona, Spain')");
  console.log("for cities that exist in multiple countries.");

  // Clean up
  await db.close();
}

// Run the test
testBarcelonaFix().catch(console.error);
