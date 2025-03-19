// Simple test for the airline parser

// Make this a module to avoid global scope conflicts
export { };

// Test function
function testAirlineParser() {
  // Test cases
  const testCases = [
    "China Airlines, Korean Air, China AirlinesKorean Air",
    "Asiana Airlines, Asiana AirlinesEVA Air",
    "Korean Air, China Airlines, Korean AirChina Airlines",
    "Jin Air, Korean Air, Jin AirKorean Air"
  ];

  // Process each test case
  testCases.forEach((testCase, index) => {
    console.log(`\nTest Case ${index + 1}: "${testCase}"`);

    // Split the test case
    const splitResults = splitConcatenatedNames(testCase);
    console.log(`Split results:`, splitResults);

    // Process the test case
    const processed = processAirlineDetails(testCase);
    console.log(`Processed array:`, processed);
  });
}

// Function to split concatenated airline names
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

// Function to process airline details into an array
function processAirlineDetails(airlineDetails: string | null): string[] {
  if (!airlineDetails) return [];

  const airlineNames: string[] = [];

  // Split and add each airline name
  const names = splitConcatenatedNames(airlineDetails);
  for (const name of names) {
    if (name && !airlineNames.includes(name)) {
      airlineNames.push(name);
    }
  }

  // Extra deduplication step to ensure uniqueness
  return [...new Set(airlineNames)];
}

// Run the test
testAirlineParser();

// Show sample flight data with the new structure
console.log("\nSample Flights with New Structure:");
console.log("================================");

const sampleFlights = [
  {
    price: 262,
    airlines: ["Asiana Airlines"],
    departureTime: "11:40 AM",
    arrivalTime: "1:30 PM",
    duration: "2 hr 50 min.",
    stops: 0,
    origin: "ICN",
    destination: "TPE"
  },
  {
    price: 262,
    airlines: ["China Airlines", "Korean Air"],
    departureTime: "12:25 PM",
    arrivalTime: "2:15 PM",
    duration: "2 hr 50 min.",
    stops: 0,
    origin: "ICN",
    destination: "TPE"
  },
  {
    price: 310,
    airlines: ["Asiana Airlines", "EVA Air"],
    departureTime: "2:00 PM",
    arrivalTime: "3:45 PM",
    duration: "2 hr 45 min.",
    stops: 0,
    origin: "ICN",
    destination: "TPE"
  }
];

sampleFlights.forEach((flight, index) => {
  console.log(`\nFlight ${index + 1}:`);
  console.log(`Price: $${flight.price}`);
  console.log(`Airlines:`, flight.airlines);
  console.log(`Route: ${flight.origin} -> ${flight.destination}`);
});
