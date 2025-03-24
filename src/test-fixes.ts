import { DEFAULT_TEST_ORIGIN } from "../tests/utils/test-constants";
import { DatabaseService } from "./utils/database";
import { haversineDistance } from "./utils/distance";

async function testFixes() {
  const db = DatabaseService.getInstance();

  // Test Barcelona fix
  console.log("\nTesting Barcelona fix:");
  console.log("---------------------");

  try {
    const originCoords = await db.getCityCoordinates(DEFAULT_TEST_ORIGIN);
    const barceCoords = await db.getCityCoordinates("Barcelona");
    const barcelonaDistance = haversineDistance(originCoords[0], barceCoords[0]);
    console.log(`Distance from ${DEFAULT_TEST_ORIGIN} to Barcelona: ${Math.round(barcelonaDistance)} km`);

    const spainCoords = await db.getCityCoordinates("Barcelona Spain");
    const spainDistance = haversineDistance(originCoords[0], spainCoords[0]);
    console.log(`Distance from ${DEFAULT_TEST_ORIGIN} to Barcelona Spain: ${Math.round(spainDistance)} km`);

    // Check if Barcelona is now correctly matching with Spain
    const isSpainMatch = Math.abs(barcelonaDistance - spainDistance) < 1;
    console.log(`\nBarcelona fix working: ${isSpainMatch ? "✅ Yes" : "❌ No"}`);
  } catch (error) {
    console.error("Error testing Barcelona fix:", error);
  }

  // Test Singapore format
  console.log("\nTesting Singapore format:");
  console.log("-----------------------");

  try {
    const originCoords = await db.getCityCoordinates(DEFAULT_TEST_ORIGIN);
    const sgCoords = await db.getCityCoordinates("Singapore");
    const sgDistance = haversineDistance(originCoords[0], sgCoords[0]);
    console.log(`Distance from ${DEFAULT_TEST_ORIGIN} to Singapore: ${Math.round(sgDistance)} km`);

    const sgCcCoords = await db.getCityCoordinates("Singapore, SG");
    const sgCcDistance = haversineDistance(originCoords[0], sgCcCoords[0]);
    console.log(`Distance from ${DEFAULT_TEST_ORIGIN} to Singapore, SG: ${Math.round(sgCcDistance)} km`);

    // Check if Singapore formats match
    const isSingaporeMatch = Math.abs(sgDistance - sgCcDistance) < 1;
    console.log(`\nSingapore format fix working: ${isSingaporeMatch ? "✅ Yes" : "❌ No"}`);
  } catch (error) {
    console.error("Error testing Singapore format:", error);
  }

  await db.close();
}

testFixes().catch(console.error);
