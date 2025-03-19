import { Page } from "puppeteer";
import { LOG_LEVEL } from "./config";
import { log } from "./log";

export async function selectUsdInCurrencyDialog(page: Page): Promise<boolean> {
  if (!page) {
    log(LOG_LEVEL.ERROR, "Cannot select USD: page is null");
    return false;
  }

  try {
    log(LOG_LEVEL.DEBUG, "Attempting to select USD in currency dialog");

    // Try multiple approaches to select USD in the currency dialog
    const isUsdSelected = await page.evaluate((): boolean => {
      try {
        // Find the currency dialog
        const dialog = document.querySelector('[role="dialog"], .dialog, [aria-modal="true"]');
        if (!dialog) return false;

        // Look for elements containing "US Dollar" or "USD" text
        const usdTexts = ["US Dollar", "USD", "United States Dollar"];
        const allElements = Array.from(dialog.querySelectorAll("*"));

        // Try to find an element with matching text
        for (const text of usdTexts) {
          for (const element of allElements) {
            if (element.textContent?.includes(text)) {
              // Check if element is visible and clickable
              const rect = element.getBoundingClientRect();
              const isVisible = rect.width > 0 && rect.height > 0 && window.getComputedStyle(element).display !== "none";

              if (isVisible) {
                // Try to click the element itself
                (element as HTMLElement).click();

                // Also try to click any radio button or checkbox near this element
                const radioOrCheckbox = element.querySelector('input[type="radio"], input[type="checkbox"]');
                if (radioOrCheckbox) {
                  (radioOrCheckbox as HTMLElement).click();
                }

                // Also try to click the parent element (in case the text is in a label but the clickable part is the parent)
                if (element.parentElement) {
                  (element.parentElement as HTMLElement).click();
                }

                return true;
              }
            }
          }
        }

        // If we couldn't find by text, try to find by currency symbol
        const currencySymbols = document.querySelectorAll('[role="radio"], [role="checkbox"], .radio, .checkbox');
        for (const symbol of currencySymbols) {
          if (symbol.textContent?.includes("$") && !symbol.textContent?.includes("€") && !symbol.textContent?.includes("£")) {
            (symbol as HTMLElement).click();
            return true;
          }
        }

        return false;
      } catch (e) {
        console.error("Error selecting USD:", e);
        return false;
      }
    });

    if (isUsdSelected) {
      log(LOG_LEVEL.INFO, "Successfully selected USD in currency dialog");
    } else {
      log(LOG_LEVEL.WARN, "Could not find or select USD in currency dialog");
    }

    return isUsdSelected;
  } catch (error) {
    log(LOG_LEVEL.ERROR, "Error selecting USD in currency dialog:", error);
    return false;
  }
}
