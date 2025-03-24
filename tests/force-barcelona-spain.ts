import { DEFAULT_TEST_ORIGIN } from "./utils/test-constants";
import { DatabaseService } from "../src/utils/database";
import { haversineDistance } from "../src/utils/distance";

async function forceBarcelonaSpain() {
  const db = DatabaseService.getInstance();

  console.log("Testing Barcelona location resolution:");
  console.log("---------------------------------");

  try {
    const originCoords = await db.getCityCoordinates(DEFAULT_TEST_ORIGIN);
    if (!originCoords.length) {
      throw new Error(`Could not find coordinates for ${DEFAULT_TEST_ORIGIN}`);
    }

    try {
      // Get coordinates for Barcelona without country
      const barceCoords = await db.getCityCoordinates("Barcelona");
      const distance = haversineDistance(originCoords[0], barceCoords[0]);
      console.log(`Distance from ${DEFAULT_TEST_ORIGIN} to Barcelona: ${Math.round(distance)} km`);

      // Get coordinates for Barcelona Spain for comparison
      const spainCoords = await db.getCityCoordinates("Barcelona Spain");
      const spainDistance = haversineDistance(originCoords[0], spainCoords[0]);
      console.log(`Distance from ${DEFAULT_TEST_ORIGIN} to Barcelona Spain: ${Math.round(spainDistance)} km`);

      // Compare distances to verify matching
      if (Math.abs(distance - spainDistance) < 1) {
        console.log("\n✅ Success: Barcelona is correctly resolving to Barcelona, Spain");
      } else {
        console.log("\n❌ Warning: Barcelona is not resolving to Barcelona, Spain");
        console.log(`   Distance difference: ${Math.abs(distance - spainDistance)} km`);
      }

    } catch (error) {
      console.error("Error comparing distances:", (error as Error).message);
    }
  } catch (error) {
    console.error("Error:", (error as Error).message);
  } finally {
    await db.close();
  }
}

forceBarcelonaSpain().catch(console.error);
