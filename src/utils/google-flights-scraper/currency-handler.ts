import { Page } from "puppeteer";
import { clickSaveButtonInCurrencyDialog } from "./click-save-button-in-currency-dialog";
import { LOG_LEVEL } from "./config";
import { findAndClickCurrencyButton } from "./find-and-click-currency-button";
import { log } from "./log";
import { selectUsdInCurrencyDialog } from "./select-usd-in-currency-dialog";
import { takeScreenshot } from "./take-screenshot";
import { verifyCurrencyChangeToUsd } from "./verify-currency-change-to-usd";

export async function changeCurrencyToUsd(page: Page): Promise<void> {
  if (!page) throw new Error("Page not initialized");

  log(LOG_LEVEL.INFO, "Changing currency to USD");

  try {
    // Take a screenshot before starting
    await takeScreenshot(page, "before-currency-change");

    // First, check if we're already using USD by looking for currency indicators
    const currentCurrency = await checkCurrentCurrency(page);

    if (currentCurrency === "USD") {
      log(LOG_LEVEL.INFO, "Currency is already set to USD");
      return;
    }

    // Look directly for the currency button on the page
    log(LOG_LEVEL.INFO, "Looking for currency button");
    await takeScreenshot(page, "before-finding-currency-button");

    // Find and click the currency button directly
    const isCurrencyButtonFound = await findAndClickCurrencyButton(page);

    if (isCurrencyButtonFound) {
      log(LOG_LEVEL.INFO, "Clicked on Currency option in menu");
      await takeScreenshot(page, "after-click-currency-option");

      // Handle the currency dialog
      const isUsdSelected = await handleCurrencyDialog(page);

      if (isUsdSelected) {
        // Finalize the currency selection
        const isSuccess = await finalizeCurrencySelection(page);
        if (!isSuccess) {
          log(LOG_LEVEL.WARN, "Currency change verification failed, but continuing");
        }
      } else {
        log(LOG_LEVEL.ERROR, "Could not find or select USD in currency dialog");
        throw new Error("Could not find or select USD in currency dialog");
      }
    } else {
      log(LOG_LEVEL.ERROR, "Could not find Currency option in menu");
      throw new Error("Could not find Currency option in menu");
    }
  } catch (error) {
    log(LOG_LEVEL.ERROR, "Error changing currency to USD:", error);
    await takeScreenshot(page, "error-changing-currency");
    throw error;
  }
}

export async function checkCurrentCurrency(page: Page): Promise<string | null> {
  if (!page) throw new Error("Page not initialized");

  try {
    const result = await page.evaluate((): string => {
      try {
        // Look for any visible currency indicators on the page
        const currencyElements = Array.from(document.querySelectorAll('[aria-label*="currency"], [class*="currency"]'));
        for (const el of currencyElements) {
          const text = el.textContent?.trim();
          if (text && (text.includes("USD") || text.includes("$"))) {
            return "USD";
          }
        }
        return "";
      } catch (e) {
        console.error("Error checking current currency:", e);
        return "";
      }
    });
    return result;
  } catch (error) {
    log(LOG_LEVEL.ERROR, "Error checking currency:", error);
    return "";
  }
}

export async function handleCurrencyDialog(page: Page): Promise<boolean> {
  if (!page) throw new Error("Page not initialized");

  // Wait for currency dialog to appear
  await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 2000)));

  // Take screenshots of the currency dialog
  await takeScreenshot(page, "currency-dialog");
  await takeScreenshot(page, "currency-dialog-before-selection");

  // Log the dialog content for debugging
  const dialogContent = await page.evaluate((): string => {
    try {
      const dialog = document.querySelector('[role="dialog"], .dialog, [aria-modal="true"]');
      return dialog ? (dialog.textContent ?? "") : (document.body.textContent ?? "");
    } catch (e) {
      console.error("Error getting dialog content:", e);
      return "";
    }
  });
  log(LOG_LEVEL.INFO, "Currency dialog content:", dialogContent);

  // Try multiple approaches to select USD
  let isUsdSelected = await selectUsdInCurrencyDialog(page);

  // If approach 1 failed, try approach 2: Use Puppeteer's click method directly
  if (!isUsdSelected) {
    isUsdSelected = await tryAlternativeUsdSelection(page);
  }

  // Take a screenshot after selection attempt
  await takeScreenshot(page, "after-usd-selection-attempt");

  return isUsdSelected;
}

export async function tryAlternativeUsdSelection(page: Page): Promise<boolean> {
  if (!page) throw new Error("Page not initialized");

  log(LOG_LEVEL.INFO, "First approach failed, trying direct Puppeteer click");

  // Try to find elements containing "US Dollar" or "USD" text using evaluate
  try {
    const isUsdElementFound = await page.evaluate((): boolean => {
      try {
        // Find all elements with text
        const allElements = Array.from(document.querySelectorAll("*"));

        // Find elements containing "US Dollar" or "USD" text
        for (const el of allElements) {
          const text = el.textContent?.trim();
          if (text && (text.includes("US Dollar") || text.includes("USD"))) {
            // Check if element is visible and clickable
            const rect = el.getBoundingClientRect();
            const isVisible = rect.width > 0 && rect.height > 0 && window.getComputedStyle(el).display !== "none";

            if (isVisible) {
              // Click the element
              (el as HTMLElement).click();
              return true;
            }
          }
        }

        return false;
      } catch (e) {
        console.error("Error finding USD element:", e);
        return false;
      }
    });

    return isUsdElementFound;
  } catch (error) {
    log(LOG_LEVEL.ERROR, "Error in alternative USD selection:", error);
    return false;
  }
}

export async function finalizeCurrencySelection(page: Page): Promise<boolean> {
  if (!page) throw new Error("Page not initialized");

  log(LOG_LEVEL.INFO, "Selected USD in currency dialog");
  await takeScreenshot(page, "after-select-usd");

  // Wait a moment for the selection to register
  await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 2000)));

  // Try a direct approach to select USD and click OK
  try {
    // First, try to directly select USD using Puppeteer's click method
    log(LOG_LEVEL.INFO, "Trying direct USD selection with Puppeteer");

    // Look for elements containing "US Dollar" or "USD"
    const usdElements = await page.$$(
      "//*[contains(text(), 'US Dollar') or contains(text(), 'USD')]"
    );

    if (usdElements && usdElements.length > 0) {
      log(LOG_LEVEL.INFO, `Found ${usdElements.length} USD elements with XPath`);
      await usdElements[0].click();
      log(LOG_LEVEL.INFO, "Clicked USD element with XPath");

      // Wait a moment for the selection to register
      await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 2000)));
    } else {
      log(LOG_LEVEL.WARN, "Could not find USD elements with XPath");
    }

    // Now try to find and click the OK button
    log(LOG_LEVEL.INFO, "Trying to find and click OK button with Puppeteer");

    // Look for buttons with text like "OK", "Save", "Done", etc.
    const okButtons = await page.$$(
      "//button[contains(text(), 'OK') or contains(text(), 'Save') or contains(text(), 'Done') or contains(text(), 'Apply') or contains(text(), 'Confirm')]"
    );

    if (okButtons && okButtons.length > 0) {
      log(LOG_LEVEL.INFO, `Found ${okButtons.length} OK buttons with XPath`);
      await okButtons[0].click();
      log(LOG_LEVEL.INFO, "Clicked OK button with XPath");
    } else {
      // If we couldn't find a specific OK button, try the last button in the dialog
      log(LOG_LEVEL.WARN, "Could not find specific OK button, trying last button in dialog");

      // Find all buttons in the dialog
      const dialogButtons = await page.$$("//div[@role='dialog']//button");

      if (dialogButtons && dialogButtons.length > 0) {
        log(LOG_LEVEL.INFO, `Found ${dialogButtons.length} buttons in dialog with XPath`);
        await dialogButtons[dialogButtons.length - 1].click();
        log(LOG_LEVEL.INFO, "Clicked last button in dialog with XPath");
      } else {
        // If we still couldn't find a button, try pressing Enter
        log(LOG_LEVEL.WARN, "Could not find any buttons in dialog, trying to press Enter");
        await page.keyboard.press("Enter");
        log(LOG_LEVEL.INFO, "Pressed Enter key to confirm selection");
      }
    }
  } catch (error) {
    log(LOG_LEVEL.ERROR, "Error in direct USD selection and OK button click:", error);

    // Fall back to the original approach
    log(LOG_LEVEL.INFO, "Falling back to original approach");

    // Try to find and click the Save/OK/Done button
    const isSaveButtonClicked = await clickSaveButtonInCurrencyDialog(page);

    if (isSaveButtonClicked) {
      log(LOG_LEVEL.INFO, "Clicked save/confirm button in currency dialog");
    } else {
      // If we couldn't find a save button, try pressing Enter
      log(LOG_LEVEL.WARN, "Could not find save button, trying to press Enter");
      await page.keyboard.press("Enter");
      log(LOG_LEVEL.INFO, "Pressed Enter key to confirm selection");
    }
  }

  // Wait for the page to reload or update after currency change
  // Clicking OK on the modal will automatically reload the page
  log(LOG_LEVEL.INFO, "Waiting for page to reload after currency change");
  try {
    // Wait for navigation to complete after clicking OK
    await page.waitForNavigation({
      waitUntil: "networkidle2",
      timeout: 10000
    });
    log(LOG_LEVEL.INFO, "Page reloaded automatically after currency change");
  } catch (error) {
    log(LOG_LEVEL.WARN, "Navigation timeout after currency change, continuing anyway");
  }

  await takeScreenshot(page, "after-currency-change");

  // Verify the currency was changed to USD
  const isCurrencyVerified = await verifyCurrencyChangeToUsd(page);

  if (isCurrencyVerified) {
    log(LOG_LEVEL.INFO, "Verified currency is now USD");
    return true;
  }

  log(LOG_LEVEL.WARN, "Could not verify currency change to USD");
  return false;
}
