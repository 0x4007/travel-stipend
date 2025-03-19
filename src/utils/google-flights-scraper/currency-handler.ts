import { Page } from "puppeteer";
import { clickSaveButtonInCurrencyDialog } from "./click-save-button-in-currency-dialog";
import { findAndClickCurrencyButton } from "./find-and-click-currency-button";
import { selectUsdInCurrencyDialog } from "./select-usd-in-currency-dialog";
import { verifyCurrencyChangeToUsd } from "./verify-currency-change-to-usd";

export async function changeCurrencyToUsd(page: Page): Promise<void> {
  if (!page) throw new Error("Page not initialized");

  // Take a screenshot before starting

  // First, check if we're already using USD by looking for currency indicators
  const currentCurrency = await checkCurrentCurrency(page);

  if (currentCurrency === "USD") {
    return;
  }

  // Look directly for the currency button on the page

  // Find and click the currency button directly
  const isCurrencyButtonFound = await findAndClickCurrencyButton(page);

  if (isCurrencyButtonFound) {
    // Handle the currency dialog
    const isUsdSelected = await handleCurrencyDialog(page);

    if (isUsdSelected) {
      // Finalize the currency selection
      const isSuccess = await finalizeCurrencySelection(page);
    } else {
      throw new Error("Could not find or select USD in currency dialog");
    }
  } else {
    throw new Error("Could not find Currency option in menu");
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
    return "";
  }
}

export async function handleCurrencyDialog(page: Page): Promise<boolean> {
  if (!page) throw new Error("Page not initialized");

  // Wait for currency dialog to appear
  await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 2000)));

  // Take screenshots of the currency dialog

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

  // Try multiple approaches to select USD
  let isUsdSelected = await selectUsdInCurrencyDialog(page);

  // If approach 1 failed, try approach 2: Use Puppeteer's click method directly
  if (!isUsdSelected) {
    isUsdSelected = await tryAlternativeUsdSelection(page);
  }

  // Take a screenshot after selection attempt

  return isUsdSelected;
}

export async function tryAlternativeUsdSelection(page: Page): Promise<boolean> {
  if (!page) throw new Error("Page not initialized");

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
    return false;
  }
}

export async function finalizeCurrencySelection(page: Page): Promise<boolean> {
  if (!page) throw new Error("Page not initialized");

  // Wait a moment for the selection to register
  await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 2000)));

  // Try to select USD if not already selected
  try {
    // Look for elements containing "US Dollar" or "USD"
    const usdElements = await page.$$("//*[contains(text(), 'US Dollar') or contains(text(), 'USD')]");

    if (usdElements && usdElements.length > 0) {
      await usdElements[0].click();
      // Wait a moment for the selection to register
      await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 2000)));
    }
  } catch (error) {
    // Continue even if USD selection fails
  }

  // Now focus on finding and clicking the OK button by its text content
  try {
    // Use page.evaluate to find and click the button with text "OK"
    const okButtonClicked = await page.evaluate(() => {
      // Find all buttons on the page
      const buttons = Array.from(document.querySelectorAll('button'));

      // Find the button that contains "OK" text
      for (const button of buttons) {
        if (button.textContent && button.textContent.trim() === "OK") {
          console.log("Found OK button by exact text match");
          button.click();
          return true;
        }
      }

      // If no exact match, look for buttons containing "OK"
      for (const button of buttons) {
        if (button.textContent && button.textContent.includes("OK")) {
          console.log("Found OK button by partial text match");
          button.click();
          return true;
        }
      }

      // If still not found, look for any button in a dialog
      const dialog = document.querySelector('[role="dialog"]');
      if (dialog) {
        const dialogButtons = dialog.querySelectorAll('button');
        if (dialogButtons.length > 0) {
          console.log("Clicking first button in dialog");
          dialogButtons[0].click();
          return true;
        }
      }

      return false;
    });

    if (!okButtonClicked) {
      // If page.evaluate approach failed, try direct Puppeteer selectors
      const okButton = await page.$('button:has-text("OK")');
      if (okButton) {
        await okButton.click();
      } else {
        // Try clicking the save button as a last resort
        await clickSaveButtonInCurrencyDialog(page);
      }
    }
  } catch (error) {
    // Try clicking the save button as a last resort
    await clickSaveButtonInCurrencyDialog(page);
  }

  // Wait for the page to reload or update after currency change
  try {
    // Wait for navigation to complete after clicking OK
    await page.waitForNavigation({
      waitUntil: "networkidle2",
      timeout: 10000,
    });
  } catch (error) {
    // Continue even if navigation times out
  }

  // Verify the currency was changed to USD
  const isCurrencyVerified = await verifyCurrencyChangeToUsd(page);
  return isCurrencyVerified;
}
