import { GoogleFlightsScraper } from './utils/google-flights-scraper/google-flights-scraper';

async function main() {
  console.log('Starting Google Flights currency change test...');

  // Create and initialize the scraper
  const scraper = new GoogleFlightsScraper();

  try {
    // Initialize the browser
    await scraper.initialize();
    console.log('Browser initialized');

    // Navigate to Google Flights
    await scraper.navigateToGoogleFlights();
    console.log('Navigated to Google Flights');

    // Test changing currency to USD
    console.log('Attempting to change currency to USD...');
    await scraper.changeCurrencyToUSD();
    console.log('Currency change operation completed');

    // Pause to allow manual verification
    console.log('\nTest completed. Please verify in the browser if the currency was changed to USD.');
    console.log('The browser will close in 10 seconds...');
    await new Promise(resolve => setTimeout(resolve, 10000));
  } catch (error) {
    console.error('Error during currency change test:', error);
  } finally {
    // Close the browser
    await scraper.close();
    console.log('Browser closed');
  }
}

// Run the main function
main().catch(console.error);
