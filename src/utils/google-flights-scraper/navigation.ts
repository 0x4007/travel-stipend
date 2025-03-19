import { Page } from "puppeteer";
import { LOG_LEVEL } from "./config";
import { log } from "./log";
import { logAllClickableElements } from "./log-all-clickable-elements";
import { logAllInputs } from "./log-all-inputs";

export async function navigateToGoogleFlights(page: Page): Promise<void> {
  if (!page) throw new Error("Page not initialized");

  log(LOG_LEVEL.INFO, "Navigating to Google Flights via Google homepage");
  try {
    // First navigate to Google's homepage
    log(LOG_LEVEL.INFO, "Navigating to Google homepage");
    await page.goto("https://www.google.com", {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    // Wait a bit for the page to stabilize
    log(LOG_LEVEL.INFO, "Waiting for Google homepage to stabilize");
    await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 3000)));

    // Now search for "Google Flights"
    log(LOG_LEVEL.INFO, "Searching for 'Google Flights'");

    // Try to find the search input
    const searchInput = await page.$('input[name="q"]');
    if (!searchInput) {
      log(LOG_LEVEL.WARN, "Could not find search input, trying alternative approach");

      // Try to navigate directly to Google Flights
      log(LOG_LEVEL.INFO, "Trying direct navigation to Google Flights");
      await page.goto("https://www.google.com/travel/flights", {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });
    } else {
      // Type "Google Flights" into the search input
      await searchInput.click();
      await searchInput.type("Google Flights");
      await page.keyboard.press("Enter");

      log(LOG_LEVEL.INFO, "Submitted search for 'Google Flights'");

      // Wait for search results
      log(LOG_LEVEL.INFO, "Waiting for search results");
      await page.waitForSelector("a", { timeout: 10000 })
        .catch(() => log(LOG_LEVEL.WARN, "Timeout waiting for search results, but continuing"));

      // Look for a link to Google Flights
      log(LOG_LEVEL.INFO, "Looking for Google Flights link in search results");
      const flightsLink = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll("a"));
        const flightsLink = links.find(link =>
          link.href.includes("/travel/flights") ||
          (link.textContent && link.textContent.includes("Google Flights"))
        );
        return flightsLink ? flightsLink.href : null;
      });

      if (flightsLink) {
        log(LOG_LEVEL.INFO, `Found Google Flights link: ${flightsLink}`);
        await page.goto(flightsLink, {
          waitUntil: "domcontentloaded",
          timeout: 30000,
        });
      } else {
        log(LOG_LEVEL.WARN, "Could not find Google Flights link, trying direct navigation");
        await page.goto("https://www.google.com/travel/flights", {
          waitUntil: "domcontentloaded",
          timeout: 30000,
        });
      }
    }

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
      return window.location.href.includes("google.com/travel/flights") ||
             document.title.includes("Google Flights") ||
             document.body.textContent?.includes("Google Flights") || false;
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
