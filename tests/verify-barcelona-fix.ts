import { DEFAULT_TEST_ORIGIN } from "./utils/test-constants";
import { DatabaseService } from "../src/utils/database";
import { haversineDistance } from "../src/utils/distance";

async function verifyBarcelonaFix() {
  console.log("Verifying Barcelona fix:");
  console.log("----------------------");

  const db = DatabaseService.getInstance();

  try {
    // Get coordinates for Barcelona (should use our special case)
    const originCoords = await db.getCityCoordinates(DEFAULT_TEST_ORIGIN);
    const barceCoords = await db.getCityCoordinates("Barcelona");
    const barcelonaDistance = haversineDistance(originCoords[0], barceCoords[0]);
    console.log(`Distance from ${DEFAULT_TEST_ORIGIN} to Barcelona: ${Math.round(barcelonaDistance)} km`);

    // Get coordinates for Barcelona Spain (explicit)
    const spainCoords = await db.getCityCoordinates("Barcelona Spain");
    const spainDistance = haversineDistance(originCoords[0], spainCoords[0]);
    console.log(`Distance from ${DEFAULT_TEST_ORIGIN} to Barcelona Spain: ${Math.round(spainDistance)} km`);

    // Try to get coordinates for Barcelona Philippines
    try {
      const philippinesCoords = await db.getCityCoordinates("Barcelona Philippines");
      const philippinesDistance = haversineDistance(originCoords[0], philippinesCoords[0]);
      console.log(`Distance from ${DEFAULT_TEST_ORIGIN} to Barcelona Philippines: ${Math.round(philippinesDistance)} km`);
    } catch (error) {
      // Try with comma format as fallback
      try {
        const philippinesCommaCoords = await db.getCityCoordinates("Barcelona, Philippines");
        const philippinesCommaDistance = haversineDistance(originCoords[0], philippinesCommaCoords[0]);
        console.log(`Distance from ${DEFAULT_TEST_ORIGIN} to Barcelona, Philippines: ${Math.round(philippinesCommaDistance)} km`);
      } catch (innerError) {
        console.log(`Error getting distance to Barcelona, Philippines: ${(innerError as Error).message}`);
      }
    }

    // Check if the fix is working
    const isFixWorking = Math.abs(barcelonaDistance - spainDistance) < 1;
    console.log(`\nIs the fix working? ${isFixWorking ? "YES" : "NO"}`);

    if (isFixWorking) {
      console.log("Success! 'Barcelona' now correctly matches with 'Barcelona, Spain'");
    } else {
      console.log("Fix not working. 'Barcelona' is still matching with a different city");
    }
  } catch (error) {
    console.log(`Error: ${(error as Error).message}`);
  } finally {
    await db.close();
  }
}

verifyBarcelonaFix().catch(console.error);
