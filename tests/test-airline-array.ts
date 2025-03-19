// Test for the new airlines array data structure

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

// Test cases
const testCases = [
  "China Airlines, Korean Air, China AirlinesKorean Air",
  "Asiana Airlines, Asiana AirlinesEVA Air",
  "Korean Air, China Airlines, Korean AirChina Airlines",
  "Jin Air, Korean Air, Jin AirKorean Air"
];

// Run tests and write results to a file
let output = "Airline Array Test Results\n";
output += "=========================\n\n";

for (const testCase of testCases) {
  output += `Original: "${testCase}"\n`;

  // Show split results
  const splitResults = splitConcatenatedNames(testCase);
  output += `Split results: ${JSON.stringify(splitResults)}\n`;

  // Show processed results as array
  const processed = processAirlineDetails(testCase);
  output += `Processed array: ${JSON.stringify(processed)}\n\n`;
}

// Sample flight data with the new structure
const sampleFlights = [
  {
    price: 262,
    airlines: ["Asiana Airlines"],
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
    airlines: ["China Airlines", "Korean Air"],
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
    airlines: ["Asiana Airlines", "EVA Air"],
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

// Display the sample flights
output += "Sample Flights with New Structure:\n";
output += "================================\n\n";

sampleFlights.forEach((flight, index) => {
  output += `Flight ${index + 1}:\n`;
  output += `Price: $${flight.price}\n`;
  output += `Airlines: ${JSON.stringify(flight.airlines)}\n`;
  output += `Departure: ${flight.departureTime}\n`;
  output += `Arrival: ${flight.arrivalTime}\n`;
  output += `Duration: ${flight.duration}\n`;
  output += `Stops: ${flight.stops}\n`;
  output += `Route: ${flight.origin} -> ${flight.destination}\n\n`;
});

// Print results to console
console.log(output);
