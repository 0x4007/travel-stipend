import { GoogleFlightsScraper } from './utils/google-flights-scraper/google-flights-scraper';

async function main() {
  console.log('Starting Google Flights scraper test with specific dates...');

  // Create and initialize the scraper
  const scraper = new GoogleFlightsScraper();

  try {
    // Initialize the browser
    await scraper.initialize();
    console.log('Browser initialized');

    // Navigate to Google Flights
    await scraper.navigateToGoogleFlights();
    console.log('Navigated to Google Flights');

    // Change currency to USD
    await scraper.changeCurrencyToUSD();
    console.log('Changed currency to USD');

    // Set search parameters
    const from = 'Seoul South Korea';
    const to = 'Tokyo Japan';

    // Use the specific dates mentioned by the user
    const departureDate = '2025-03-26';
    const returnDate = '2025-04-02';

    console.log(`Searching for flights from ${from} to ${to}`);
    console.log(`Departure: ${departureDate} Return: ${returnDate}`);

    // Search for flights
    const flightData = await scraper.searchFlights(from, to, departureDate, returnDate);

    // Display flight data
    console.log('\nFlight search results:');
    console.log('=====================');

    if (flightData) {
      console.log(`Found ${flightData.prices.length} flight prices`);

      if (flightData.prices.length > 0) {
        console.log('\nPrices:');
        flightData.prices.forEach((price, index) => {
          console.log(`  ${index + 1}. ${price}`);
        });
      }

      if (flightData.airlines && flightData.airlines.length > 0) {
        console.log('\nAirlines:');
        flightData.airlines.forEach((airline, index) => {
          console.log(`  ${index + 1}. ${airline}`);
        });
      }

      if (flightData.durations && flightData.durations.length > 0) {
        console.log('\nDurations:');
        flightData.durations.forEach((duration, index) => {
          console.log(`  ${index + 1}. ${duration}`);
        });
      }

      // Log price elements count if available
      if ('priceElements' in flightData) {
        console.log('\nPrice elements found:');
        console.log(`  Count: ${flightData.priceElements}`);
      }
    } else {
      console.log('No flight data found');
    }
  } catch (error) {
    console.error('Error during flight search:', error);
  } finally {
    // Close the browser
    await scraper.close();
    console.log('Browser closed');
  }
}

// Run the main function
main().catch(console.error);
