import { DatabaseService } from "../src/utils/database";

async function main() {
  const db = DatabaseService.getInstance();

  try {
    // Test getting conferences
    const conferences = await db.getConferences();
    console.log("Conferences:", conferences);

    // Test getting coordinates for a city
    const coordinates = await db.getCityCoordinates("London");
    console.log("London coordinates:", coordinates);

    // Test getting airport codes
    const airports = await db.getAirportCodes("London");
    console.log("London airports:", airports);

    // Test getting cost of living
    const col = await db.getCostOfLiving("London");
    console.log("London cost of living:", col);

    // Test getting taxi rates
    const taxi = await db.getTaxiRates("London");
    console.log("London taxi rates:", taxi);

  } catch (error) {
    console.error("Test failed:", error);
  } finally {
    await db.close();
  }
}

main().catch(console.error);
