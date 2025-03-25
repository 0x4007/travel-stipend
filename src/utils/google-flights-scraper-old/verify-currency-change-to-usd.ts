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
    await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 3000)));

    // Check if the currency has been changed to USD
    const isUsdVerified = await page.evaluate((): boolean => {
      try {
        const selectors = ['[aria-label*="price"], [class*="price"]', '[aria-label*="currency"], [class*="currency"]', "*"];

        for (const selector of selectors) {
          const elements = Array.from(document.querySelectorAll(selector));
          for (const element of elements) {
            const text = element.textContent?.trim();
            if (text && (text.includes("USD") || text.includes("$"))) {
              if (selector === "*" && !isElementVisible(element)) {
                continue;
              }
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

    function isElementVisible(element: Element): boolean {
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && window.getComputedStyle(element).display !== "none";
    }

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
