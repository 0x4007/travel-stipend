import * as puppeteer from "puppeteer";
import { findDestinationInput } from "./find-destination-input";
import { selectDropdownItem } from "./select-dropdown-item";
import { tryFallbackApproach } from "./try-fallback-approach";
import { verifySelection } from "./verify-selection";

async function main() {
  console.log("Starting Google Flights specific destination input test...");

  // Launch browser in headful mode
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: { width: 1366, height: 768 },
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--window-size=1366,768"],
  });

  try {
    // Create a new page
    const page = await browser.newPage();

    // Set user agent
    await page.setUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36");

    // Navigate to Google Flights
    console.log("Navigating to Google Flights...");
    await page.goto("https://www.google.com/travel/flights", {
      waitUntil: "networkidle2",
      timeout: 60000,
    });
    console.log("Google Flights loaded");

    // Wait for the page to be fully loaded
    await page.waitForSelector("body", { timeout: 10000 });

    // Find destination input field
    const destinationInput = await findDestinationInput(page);

    if (!destinationInput) {
      throw new Error("Could not find destination input field");
    }

    console.log("Found destination input field, clicking on it...");
    await destinationInput.click();

    // Type "Tokyo" in the destination field
    console.log('Typing "Tokyo" in destination field...');
    await page.keyboard.type("Tokyo", { delay: 100 });

    // Wait for 500ms to allow dropdown to appear
    console.log("Waiting 500ms for dropdown to appear...");
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Wait for the dropdown list to appear
    console.log("Waiting for dropdown list...");
    await page.waitForSelector('ul[role="listbox"]', { timeout: 5000 });

    // Select the first item in the dropdown - improved approach
    console.log("Selecting first dropdown item...");

    // Add a longer delay to ensure dropdown is fully loaded
    console.log("Waiting additional time for dropdown to fully load...");
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Log all available dropdown items for debugging
    console.log("Checking available dropdown items...");
    const dropdownItems = await page.$$('li[role="option"]');
    console.log(`Found ${dropdownItems.length} dropdown items`);

    // Try multiple selector approaches
    try {
      await selectDropdownItem(page);
    } catch (error) {
      console.error("Error during dropdown selection:", error);
      console.log("Falling back to Enter key press");
      await page.keyboard.press("Enter");
    }

    // Take a screenshot after selection
    console.log("Taking screenshot after dropdown selection...");
    const screenshotPath = `./logs/screenshots/after-dropdown-selection-${Date.now()}.png`;
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`Screenshot saved to: ${screenshotPath}`);

    // Verify selection was successful by checking for visual indicators on the page
    const selectionSuccessful = await verifySelection(page);

    console.log("Selection verification result:", selectionSuccessful);

    if (selectionSuccessful.success) {
      console.log('✅ Selection successful: Found "Tokyo" on the page');
    } else {
      console.log('❌ Selection may have failed: Could not find "Tokyo" on the page');
      await tryFallbackApproach(page);
    }

    // Pause for manual debugging
    console.log("\n-----------------------------------------");
    console.log("Script paused for manual debugging.");
    console.log("The browser will remain open until you press Ctrl+C in the terminal.");
    console.log("-----------------------------------------\n");

    // Keep the script running to allow manual debugging
    // This effectively pauses the script while keeping the browser open
    await new Promise(() => {
      // This promise never resolves, keeping the script running
      // until manually terminated
    });
  } catch (error) {
    console.error("Error during test:", error);
  }
  // We don't close the browser here to allow for manual debugging
}

// Run the main function
main().catch(console.error);
