import { getCityCoordinates } from "../src/utils/coordinates";
import { writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

// List of previously problematic destinations
const PROBLEMATIC_DESTINATIONS = [
  "Brooklyn, USA",
  "Montreal, Canada",
  "Florence, Italy",
  "Arlington VA, USA",
  "Grapevine Texas, USA",
  "Cannes, France",
  "Milan, Italy",
  "Taipei, Taiwan",
  "Kyoto, Japan"
];

// Some known working destinations for comparison
const KNOWN_WORKING_DESTINATIONS = [
  "New York, USA",
  "London, UK",
  "Tokyo, Japan",
  "Paris, France",
  "Berlin, Germany"
];

interface TestResult {
  destination: string;
  foundCoordinates: boolean;
  coordinates?: { lat: number; lng: number };
  strategy?: string;
  error?: string;
}

/**
 * Test our improved coordinate lookup functionality
 */
async function testImprovedCoordinates() {
  console.log("=== Testing Improved Coordinate Lookup ===");

  const results: TestResult[] = [];
  let totalSuccess = 0;
  const totalProblemDestinations = PROBLEMATIC_DESTINATIONS.length;

  // First test previously problematic destinations
  console.log("\nTesting previously problematic destinations:");
  for (const destination of PROBLEMATIC_DESTINATIONS) {
    const result = await testDestination(destination);
    results.push(result);

    if (result.foundCoordinates) {
      totalSuccess++;
      console.log(`✅ ${destination}: Found coordinates ${JSON.stringify(result.coordinates)}`);
      if (result.strategy) {
        console.log(`   Strategy: ${result.strategy}`);
      }
    } else {
      console.log(`❌ ${destination}: Failed to find coordinates`);
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
    }
  }

  // Then test some known working destinations as control group
  console.log("\nTesting control group (known working destinations):");
  for (const destination of KNOWN_WORKING_DESTINATIONS) {
    const result = await testDestination(destination);
    results.push(result);

    if (result.foundCoordinates) {
      console.log(`✅ ${destination}: Found coordinates ${JSON.stringify(result.coordinates)}`);
      if (result.strategy) {
        console.log(`   Strategy: ${result.strategy}`);
      }
    } else {
      console.log(`❌ ${destination}: Failed to find coordinates`);
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
    }
  }

  // Output summary
  console.log("\n=== Summary ===");
  console.log(`Previously problematic destinations: ${totalProblemDestinations}`);
  console.log(`Now successfully resolved: ${totalSuccess}`);
  console.log(`Success rate: ${Math.round(totalSuccess / totalProblemDestinations * 100)}%`);

  // Save results to CSV
  saveResultsToCsv(results);
}

/**
 * Test a single destination
 */
async function testDestination(destination: string): Promise<TestResult> {
  try {
    // Store console.log calls to detect which strategy was used
    const logMessages: string[] = [];
    const originalConsoleLog = console.log;
    console.log = (...args: any[]) => {
      logMessages.push(args.join(' '));
      originalConsoleLog(...args);
    };

    // Try to get coordinates
    const coordinates = await getCityCoordinates(destination);

    // Restore console.log
    console.log = originalConsoleLog;

    if (coordinates && coordinates.length > 0) {
      // Determine strategy from log messages
      let strategy = "Direct database match";
      if (logMessages.some(msg => msg.includes("Fuzzy match found"))) {
        strategy = "Fuzzy matching";
      } else if (logMessages.some(msg => msg.includes("Using airport coordinates"))) {
        strategy = "Nearest airport";
      }

      return {
        destination,
        foundCoordinates: true,
        coordinates: coordinates[0],
        strategy
      };
    } else {
      return {
        destination,
        foundCoordinates: false
      };
    }
  } catch (error) {
    return {
      destination,
      foundCoordinates: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Save test results to a CSV file
 */
function saveResultsToCsv(results: TestResult[]) {
  // Create output directory if it doesn't exist
  const outputDir = join(process.cwd(), "test-results");
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  // Create CSV content
  const header = "Destination,Success,Latitude,Longitude,Strategy,Error";
  const rows = results.map(r => {
    const success = r.foundCoordinates ? "Yes" : "No";
    const lat = r.coordinates ? r.coordinates.lat : "";
    const lng = r.coordinates ? r.coordinates.lng : "";
    const strategy = r.strategy ?? "";
    const error = r.error ?? "";

    return `"${r.destination}",${success},${lat},${lng},"${strategy}","${error}"`;
  });

  const csvContent = [header, ...rows].join("\n");

  // Save to file
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const csvFilePath = join(outputDir, `improved-coordinates-test-${timestamp}.csv`);
  writeFileSync(csvFilePath, csvContent);

  console.log(`\nResults saved to: ${csvFilePath}`);
}

// Run the test
testImprovedCoordinates().catch(console.error);
