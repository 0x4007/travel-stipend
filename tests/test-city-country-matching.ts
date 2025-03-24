import { DEFAULT_TEST_ORIGIN } from "./utils/test-constants";
import { DatabaseService } from "../src/utils/database";
import { haversineDistance } from "../src/utils/distance";

async function testCityCountryMatching() {
  const db = DatabaseService.getInstance();

  // Test cities with and without country codes
  const citiesToTest = [
    "Barcelona",
    "Barcelona, Spain",
    "Barcelona Spain",
    "Barcelona, ES",
    "Singapore",
    "Singapore, SG",
    "Tokyo",
    "Tokyo, JP",
    "London",
    "London, GB",
  ];

  console.log("Testing city-country matching variations:");
  console.log("---------------------------------------");

  try {
    const originCoords = await db.getCityCoordinates(DEFAULT_TEST_ORIGIN);
    if (!originCoords.length) {
      throw new Error(`Could not find coordinates for ${DEFAULT_TEST_ORIGIN}`);
    }

    for (const city of citiesToTest) {
      try {
        const destCoords = await db.getCityCoordinates(city);
        if (!destCoords.length) {
          console.log(`Could not find coordinates for ${city}`);
          continue;
        }

        const distance = haversineDistance(originCoords[0], destCoords[0]);
        console.log(`Distance from ${DEFAULT_TEST_ORIGIN} to ${city}: ${Math.round(distance)} km`);
      } catch (error) {
        console.error(`Error processing ${city}:`, (error as Error).message);
      }
    }
  } catch (error) {
    console.error("Error:", (error as Error).message);
  } finally {
    await db.close();
  }
}

testCityCountryMatching().catch(console.error);
