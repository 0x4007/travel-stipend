import { Page } from "puppeteer";
import { LOG_LEVEL } from "./config";
import { log } from "./log";

export async function verifyCurrencyChangeToUsd(page: Page): Promise<boolean> {
  if (!page) {
    log(LOG_LEVEL.ERROR, "Cannot verify currency change: page is null");
    return false;
  }

  try {
    log(LOG_LEVEL.DEBUG, "Verifying currency change to USD");

    // Wait a moment for the page to update after currency change
    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 3000)));

    // Check if the currency has been changed to USD
    const isUsdVerified = await page.evaluate((): boolean => {
      try {
        // Look for price elements on the page
        const priceElements = Array.from(document.querySelectorAll('[aria-label*="price"], [class*="price"]'));

        // Check if any price element contains a dollar sign
        for (const element of priceElements) {
          const text = element.textContent?.trim();
          if (text?.includes("$")) {
            return true;
          }
        }

        // If we couldn't find price elements, look for any visible currency indicators
        const currencyElements = Array.from(document.querySelectorAll('[aria-label*="currency"], [class*="currency"]'));
        for (const element of currencyElements) {
          const text = element.textContent?.trim();
          if (text && (text.includes("USD") || text.includes("$"))) {
            return true;
          }
        }

        // If we still couldn't find any indicators, look for any text containing "$" or "USD"
        const allElements = Array.from(document.querySelectorAll("*"));
        for (const element of allElements) {
          const text = element.textContent?.trim();
          if (text && (text.includes("USD") || text.includes("$"))) {
            // Check if element is visible
            const rect = element.getBoundingClientRect();
            const isVisible = rect.width > 0 && rect.height > 0 && window.getComputedStyle(element).display !== "none";

            if (isVisible) {
              return true;
            }
          }
        }

        return false;
      } catch (e) {
        console.error("Error verifying currency change:", e);
        return false;
      }
    });

    if (isUsdVerified) {
      log(LOG_LEVEL.INFO, "Verified currency is now USD");
    } else {
      log(LOG_LEVEL.WARN, "Could not verify currency change to USD");
    }

    return isUsdVerified;
  } catch (error) {
    log(LOG_LEVEL.ERROR, "Error verifying currency change to USD:", error);
    return false;
  }
}
