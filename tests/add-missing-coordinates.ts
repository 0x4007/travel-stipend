import { Coordinates } from "../src/types";
import { DatabaseService } from "../src/utils/database";

/**
 * This script adds missing coordinates for cities that our system currently can't locate
 * Based on the test results, these cities were identified as problematic
 */

// Define coordinates for missing cities
// These coordinates were obtained from reliable sources like Google Maps
const MISSING_CITIES: Record<string, Coordinates> = {
  // North America
  "Brooklyn, USA": { lat: 40.6782, lng: -73.9442 },
  "Montreal, Canada": { lat: 45.5017, lng: -73.5673 },
  "Arlington VA, USA": { lat: 38.8799, lng: -77.1067 },
  "Grapevine Texas, USA": { lat: 32.9343, lng: -97.0781 },

  // Europe
  "Florence, Italy": { lat: 43.7696, lng: 11.2558 },
  "Cannes, France": { lat: 43.5528, lng: 7.0174 },
  "Milan, Italy": { lat: 45.4642, lng: 9.1900 },

  // Asia
  "Taipei, Taiwan": { lat: 25.0330, lng: 121.5654 },
  "Kyoto, Japan": { lat: 35.0116, lng: 135.7681 }
};

/**
 * Add missing coordinates to the database
 */
async function addMissingCoordinates() {
  console.log("=== Adding Missing City Coordinates ===");

  const db = DatabaseService.getInstance();
  let addedCount = 0;

  try {
    // Add each missing city
    for (const [city, coordinates] of Object.entries(MISSING_CITIES)) {
      try {
        // First check if the coordinates are already in the database
        const existingCoords = await db.getCityCoordinates(city);

        if (existingCoords.length === 0) {
          // Use the database's internal method to add coordinates to the database
          await db.addCityCoordinates(city, coordinates.lat, coordinates.lng);
          console.log(`✅ Added coordinates for ${city}: ${JSON.stringify(coordinates)}`);
          addedCount++;
        } else {
          console.log(`ℹ️ Coordinates for ${city} already exist: ${JSON.stringify(existingCoords[0])}`);
        }
      } catch (error) {
        console.error(`❌ Error adding coordinates for ${city}:`, error);
      }
    }

    console.log(`\n=== Summary ===`);
    console.log(`Total cities processed: ${Object.keys(MISSING_CITIES).length}`);
    console.log(`Successfully added: ${addedCount}`);
  } catch (error) {
    console.error("Error during operation:", error);
  } finally {
    // Close the database connection
    await db.close();
  }
}

// Run the script
addMissingCoordinates().catch(console.error);
