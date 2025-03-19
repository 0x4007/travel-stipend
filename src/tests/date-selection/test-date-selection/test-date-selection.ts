import { clickDoneButton } from './clickDoneButton';
import { enterDestination } from './enterDestination';
import { findAndClickSearchButton } from './findAndClickSearchButton';
import { initializeBrowser } from './initializeBrowser';
import { navigateToGoogleFlights } from './navigateToGoogleFlights';
import { selectDates } from './selectDates';
import { takeResultScreenshot } from './takeResultScreenshot';

/**
 * Main function to run the test
 */
async function main(): Promise<void> {
  const browser = await initializeBrowser();

  try {
    const page = await browser.newPage();

    await navigateToGoogleFlights(page);
    await enterDestination(page, 'Tokyo');
    await selectDates(page);
    await clickDoneButton(page);
    await findAndClickSearchButton(page);
    await takeResultScreenshot(page);

    // Pause for manual debugging
    console.log('\n-----------------------------------------');
    console.log('Script paused for manual debugging.');
    console.log('The browser will remain open until you press Ctrl+C in the terminal.');
    console.log('-----------------------------------------\n');

    // Keep the script running to allow manual debugging
    await new Promise(() => {
      // This promise never resolves, keeping the script running
      // until manually terminated
    });
  } catch (testError) {
    console.error('Error during test:', testError instanceof Error ? testError.message : String(testError));
  }
  // We don't close the browser here to allow for manual debugging
}

// Run the main function
main().catch(mainError => console.error('Error in main function:', mainError instanceof Error ? mainError.message : String(mainError)));
