import * as puppeteer from "puppeteer";

async function main() {
  console.log("Starting Google Flights destination input test...");

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

    // Find the destination input field
    console.log("Looking for destination input field...");
    const destinationInput = await page.waitForSelector('input[placeholder="Where to?"], input[aria-label="Where to? "]', {
      visible: true,
      timeout: 10000,
    });

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

    // Select the first item in the dropdown
    console.log("Selecting first dropdown item...");
    const firstItem = await page.waitForSelector('li[role="option"]:first-child', { timeout: 5000 });

    if (firstItem) {
      await firstItem.click();
      console.log("Selected first dropdown item");
    } else {
      console.log("Could not find first dropdown item, trying to press Enter instead");
      await page.keyboard.press("Enter");
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
