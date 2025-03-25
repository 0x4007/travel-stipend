import { DEFAULT_TEST_ORIGIN } from "./utils/test-constants";
import { DatabaseService } from "../src/utils/database";
import { haversineDistance } from "../src/utils/distance";

async function debugCityMatching() {
  const db = DatabaseService.getInstance();

  console.log("\nTesting city matching and coordinate lookup...");
  console.log("--------------------------------------------");

  // Test cities in different formats
  const formats = [
    "Singapore",
    "Singapore, SG",
    "Barcelona",
    "Barcelona, Spain",
    "Barcelona, ES",
    "Seoul",
    "Seoul, Korea",
    "Seoul, KR",
    "London",
    "London, UK",
    "London, GB",
  ];

  try {
    const originCoords = await db.getCityCoordinates(DEFAULT_TEST_ORIGIN);
    if (!originCoords.length) {
      throw new Error(`Could not find coordinates for ${DEFAULT_TEST_ORIGIN}`);
    }

    for (const format of formats) {
      try {
        const destCoords = await db.getCityCoordinates(format);
        if (!destCoords.length) {
          console.log(`\nFormat: "${format}"`);
          console.log("Result: No coordinates found");
          continue;
        }

        const distance = haversineDistance(originCoords[0], destCoords[0]);
        console.log(`\nFormat: "${format}"`);
        console.log(`Coordinates: ${JSON.stringify(destCoords[0])}`);
        console.log(`Distance from ${DEFAULT_TEST_ORIGIN}: ${Math.round(distance)} km`);
      } catch (error) {
        console.log(`\nFormat: "${format}"`);
        console.log(`Error: ${(error as Error).message}`);
      }
    }

    console.log("\nAnalysis:");
    console.log("---------");
    console.log("1. Two-letter country codes (e.g., 'SG', 'ES', 'KR') are preferred");
    console.log("2. City names without country are matched to the most common/relevant entry");
    console.log("3. Legacy country names (e.g., 'Korea' vs 'KR') are supported but not preferred");
    console.log("4. GB vs UK: GB (Great Britain) is the official ISO code");
  } catch (error) {
    console.error("\nError:", (error as Error).message);
  } finally {
    await db.close();
  }
}

debugCityMatching().catch(console.error);
