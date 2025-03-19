import { Page } from "puppeteer";
import { LOG_LEVEL } from "./config";
import { log } from "./log";
import { logAllClickableElements } from "./log-all-clickable-elements";
import { logAllInputs } from "./log-all-inputs";

export async function navigateToGoogleFlights(page: Page): Promise<void> {
  if (!page) throw new Error("Page not initialized");

  log(LOG_LEVEL.INFO, "Navigating directly to Google Flights");
  try {
    // Navigate directly to Google Flights
    log(LOG_LEVEL.INFO, "Using direct navigation to Google Flights");
    await page.goto("https://www.google.com/travel/flights", {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    // Wait for the page to load
    log(LOG_LEVEL.INFO, "Waiting for Google Flights page to load");
    await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 5000)));

    // Wait for the page to be fully loaded
    log(LOG_LEVEL.INFO, "Google Flights page loaded");

    // Log page title and URL
    try {
      const title = await page.title();
      const url = page.url();
      log(LOG_LEVEL.INFO, `Page loaded: ${title} (${url})`);
    } catch (error) {
      log(LOG_LEVEL.WARN, "Could not get page title or URL:", error);
    }

    // Check if we're on the right page
    const isOnGoogleFlights = await page.evaluate(() => {
      return (
        window.location.href.includes("google.com/travel/flights") ||
        document.title.includes("Google Flights") ||
        document.body.textContent?.includes("Google Flights") ||
        false
      );
    });

    if (isOnGoogleFlights) {
      log(LOG_LEVEL.INFO, "Successfully navigated to Google Flights");
    } else {
      log(LOG_LEVEL.WARN, "May not be on Google Flights page, but continuing anyway");
    }

    // Try to log inputs and clickable elements, but don't fail if it doesn't work
    try {
      await logAllInputs(page);
      await logAllClickableElements(page);
    } catch (error) {
      log(LOG_LEVEL.WARN, "Could not log page elements:", error);
    }
  } catch (error) {
    log(LOG_LEVEL.ERROR, "Error navigating to Google Flights:", error);

    throw error;
  }
}
