import { GoogleFlightsScraper } from "../src/utils/google-flights-scraper";

interface SearchParams {
  from: string;
  to: string;
  departureDate: string;
  returnDate?: string;
}

interface SearchResult {
  success: boolean;
  price: number;
  source: string;
  prices?: {
    price: number;
    airline: string;
    departureTime: string;
    arrivalTime: string;
    duration: string;
    stops: number;
    isTopFlight: boolean;
  }[];
}

export async function searchFlightPrices(params: SearchParams): Promise<SearchResult | null> {
  console.log("Starting Google Flights search...");
  console.log(`From: ${params.from}`);
  console.log(`To: ${params.to}`);
  console.log(`Departure: ${params.departureDate}`);
  if (params.returnDate) {
    console.log(`Return: ${params.returnDate}`);
  }

  // Create and initialize the scraper
  const scraper = new GoogleFlightsScraper();

  try {
    // Initialize the browser
    await scraper.initialize({ headless: true });
    console.log("Browser initialized");

    // Navigate to Google Flights
    await scraper.navigateToGoogleFlights();
    console.log("Navigated to Google Flights");

    // Change currency to USD
    await scraper.changeCurrencyToUsd();
    console.log("Changed currency to USD");

    // Search for flights
    const flightData = await scraper.searchFlights(
      params.from,
      params.to,
      params.departureDate,
      params.returnDate
    );

    // Display flight data
    console.log("\nFlight search results:");
    console.log("=====================");

    if (flightData.success && 'prices' in flightData && flightData.prices) {
      console.log(`Found ${flightData.prices.length} flight prices`);

      const formattedPrices = flightData.prices.map((price) => ({
        price: `$${price.price}`,
        airline: price.airline,
        departure: price.departureTime,
        arrival: price.arrivalTime,
        duration: price.duration,
        stops: price.stops,
        isTopFlight: price.isTopFlight
      }));

      console.table(formattedPrices);
      return flightData as SearchResult;
    } else if (flightData.success && 'price' in flightData) {
      // Handle case where we get a single price
      console.log(`Found flight price: $${flightData.price}`);
      return {
        success: true,
        price: flightData.price,
        source: flightData.source
      };
    } else {
      console.log("No flight data found");
      return null;
    }
  } catch (error) {
    console.error("Error during flight search:", error);
    throw error;
  } finally {
    // Close the browser
    await scraper.close();
    console.log("Browser closed");
  }
}

// Example usage:
if (require.main === module) {
  // If running this file directly, perform a test search
  const params: SearchParams = {
    from: process.argv[2] || "Seoul, South Korea",
    to: process.argv[3] || "Tokyo, Japan",
    departureDate: process.argv[4] || "2024-05-20",
    returnDate: process.argv[5]
  };

  searchFlightPrices(params)
    .then(result => {
      if (result && 'prices' in result && result.prices) {
        const averagePrice = result.prices.reduce((sum, p) => sum + p.price, 0) / result.prices.length;
        console.log(`\nAverage price: $${averagePrice.toFixed(2)}`);
      } else if (result && 'price' in result) {
        console.log(`\nFlight price: $${result.price}`);
      }
      process.exit(0);
    })
    .catch(error => {
      console.error("Search failed:", error);
      process.exit(1);
    });
}
