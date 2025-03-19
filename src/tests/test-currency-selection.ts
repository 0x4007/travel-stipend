import { GoogleFlightsScraper } from './utils/google-flights-scraper/google-flights-scraper';

async function testCurrencySelection() {
  console.log('Starting currency selection test with headful browser...');

  const scraper = new GoogleFlightsScraper();

  try {
    // Initialize the scraper (this will launch a visible browser)
    await scraper.initialize();
    console.log('Browser initialized');

    // Navigate to Google Flights
    await scraper.navigateToGoogleFlights();
    console.log('Navigated to Google Flights');

    // Change currency to USD
    await scraper.changeCurrencyToUSD();
    console.log('Successfully changed currency to USD');

    console.log('Test completed successfully!');
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    // Close the browser
    await scraper.close();
    console.log('Browser closed');
  }
}

// Run the test
testCurrencySelection().catch(console.error);
