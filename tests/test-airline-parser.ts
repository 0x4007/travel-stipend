import { JSDOM } from "jsdom";

// Mock the DOM environment for testing
const dom = new JSDOM(`<!DOCTYPE html><html><body></body></html>`);
global.document = dom.window.document;
global.Element = dom.window.Element;
global.NodeList = dom.window.NodeList;

// Import the splitConcatenatedNames function from price-scraper
// We need to recreate it here since it's not exported from the original file
function splitConcatenatedNames(text: string): string[] {
  if (!text) return [];

  // First handle comma-separated parts
  if (text.includes(",")) {
    return text.split(",")
      .map(part => part.trim())
      .flatMap(part => splitConcatenatedNames(part))
      .filter(Boolean);
  }

  // Look for camelCase patterns (lowercase followed by uppercase)
  const splitPoints: number[] = [];
  for (let i = 0; i < text.length - 1; i++) {
    // Check if current char is lowercase and next char is uppercase
    if (/[a-z]/.test(text[i]) && /[A-Z]/.test(text[i+1])) {
      splitPoints.push(i + 1);
    }
  }

  // If no split points found, return the original text
  if (splitPoints.length === 0) {
    return [text];
  }

  // Split the text at the identified points
  const result: string[] = [];
  let startIndex = 0;

  for (const splitPoint of splitPoints) {
    const part = text.substring(startIndex, splitPoint).trim();
    if (part) result.push(part);
    startIndex = splitPoint;
  }

  // Add the last part
  const lastPart = text.substring(startIndex).trim();
  if (lastPart) result.push(lastPart);

  return result;
}

// Function to process airline details
function processAirlineDetails(airlineDetails: string | null): string | null {
  if (!airlineDetails) return null;

  const airlineNames: string[] = [];

  // Split and add each airline name
  const names = splitConcatenatedNames(airlineDetails);
  for (const name of names) {
    if (name && !airlineNames.includes(name)) {
      airlineNames.push(name);
    }
  }

  return airlineNames.length > 0 ? airlineNames.join(", ") : null;
}

// Test cases from the user's examples
const testCases = [
  "China Airlines, Korean Air, China AirlinesKorean Air",
  "Asiana Airlines, Asiana AirlinesEVA Air",
  "Korean Air, China Airlines, Korean AirChina Airlines",
  "Jin Air, Korean Air, Jin AirKorean Air",
  "Asiana Airlines",
  null,
  "",
  "China Airlines, Korean Air",
  "EVA Air, Asiana Airlines"
];

// Log the test cases to debug
console.error("Test cases:", JSON.stringify(testCases));

// Run the tests
console.error("Testing airline parser improvements:");
console.error("====================================");

testCases.forEach((testCase, index) => {
  const processed = processAirlineDetails(testCase);
  console.log(`\nTest Case ${index + 1}:`);
  console.log(`Original: "${testCase}"`);
  console.log(`Processed: "${processed}"`);

  // Show the split results for debugging
  if (testCase) {
    const splitResults = splitConcatenatedNames(testCase);
    console.log(`Split results: ${JSON.stringify(splitResults)}`);
  }
});

// Test with the full flight data example
console.log("\n\nTesting with full flight data example:");
console.log("======================================");

// Sample flight data from the user's example
const sampleFlights = [
  {
    price: 262,
    airline: "Asiana Airlines",
    airlineDetails: "Asiana Airlines",
    bookingCaution: null,
    departureTime: "11:40 AM",
    arrivalTime: "1:30 PM",
    duration: "2 hr 50 min.",
    stops: 0,
    origin: "ICN",
    destination: "TPE",
    isTopFlight: true,
  },
  {
    price: 262,
    airline: null,
    airlineDetails: "China Airlines, Korean Air, China AirlinesKorean Air",
    bookingCaution: null,
    departureTime: "12:25 PM",
    arrivalTime: "2:15 PM",
    duration: "2 hr 50 min.",
    stops: 0,
    origin: "ICN",
    destination: "TPE",
    isTopFlight: true,
  },
  {
    price: 310,
    airline: null,
    airlineDetails: "Asiana Airlines, Asiana AirlinesEVA Air",
    bookingCaution: null,
    departureTime: "2:00 PM",
    arrivalTime: "3:45 PM",
    duration: "2 hr 45 min.",
    stops: 0,
    origin: "ICN",
    destination: "TPE",
    isTopFlight: true,
  }
];

// Process the sample flights
const processedFlights = sampleFlights.map(flight => ({
  ...flight,
  airlineDetails: processAirlineDetails(flight.airlineDetails)
}));

// Display the results
processedFlights.forEach((flight, index) => {
  console.log(`\nFlight ${index + 1}:`);
  console.log(`Price: $${flight.price}`);
  console.log(`Airline: ${flight.airline}`);
  console.log(`Original Airline Details: "${sampleFlights[index].airlineDetails}"`);
  console.log(`Processed Airline Details: "${flight.airlineDetails}"`);

  // Show the split results for debugging
  if (sampleFlights[index].airlineDetails) {
    const splitResults = splitConcatenatedNames(sampleFlights[index].airlineDetails);
    console.log(`Split results: ${JSON.stringify(splitResults)}`);
  }
});
