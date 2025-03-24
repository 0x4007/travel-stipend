import { DEFAULT_TEST_ORIGIN } from "./utils/test-constants";
import { DatabaseService } from "../src/utils/database";
import { haversineDistance } from "../src/utils/distance";

async function testBarcelonaMatching() {
  const db = DatabaseService.getInstance();

  console.log(`Origin: ${DEFAULT_TEST_ORIGIN}`);
  console.log("Testing different Barcelona formats:");
  console.log("----------------------------------");

  // Test different formats
  const formats = [
    "Barcelona",
    "Barcelona, Spain",
    "Barcelona Spain",
    "Barcelona ES",
    "Barcelona, ES",
    "Barcelona, Philippines",
    "Barcelona Philippines",
    "Barcelona PH",
    "Barcelona, PH",
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
          console.log(`Format: "${format}" => No coordinates found`);
          continue;
        }

        const distance = haversineDistance(originCoords[0], destCoords[0]);
        console.log(`Format: "${format}" => Distance: ${Math.round(distance)} km`);
      } catch (error) {
        console.log(`Format: "${format}" => Error: ${(error as Error).message}`);
      }
    }

    // Test misspelling
    try {
      const misspelledCoords = await db.getCityCoordinates("Barselona");
      if (!misspelledCoords.length) {
        console.log(`Format: "Barselona" (misspelled) => No coordinates found`);
      } else {
        const distance = haversineDistance(originCoords[0], misspelledCoords[0]);
        console.log(`Format: "Barselona" (misspelled) => Distance: ${Math.round(distance)} km`);
      }
    } catch (error) {
      console.log(`Format: "Barselona" (misspelled) => Error: ${(error as Error).message}`);
    }
  } catch (error) {
    console.error("Error:", (error as Error).message);
  } finally {
    await db.close();
  }
}

testBarcelonaMatching().catch(console.error);
