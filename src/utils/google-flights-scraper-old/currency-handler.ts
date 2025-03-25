import { Page } from "puppeteer";
import { clickSaveButtonInCurrencyDialog } from "./click-save-button-in-currency-dialog";
import { findAndClickCurrencyButton } from "./find-and-click-currency-button";
import { selectUsdInCurrencyDialog } from "./select-usd-in-currency-dialog";
import { verifyCurrencyChangeToUsd } from "./verify-currency-change-to-usd";

export async function changeCurrencyToUsd(page: Page): Promise<void> {
  if (!page) throw new Error("Page not initialized");

  // First, check if we're already using USD by looking for currency indicators
  const currentCurrency = await checkCurrentCurrency(page);

  if (currentCurrency === "USD") {
    return;
  }

  // Find and click the currency button directly
  const isCurrencyButtonFound = await findAndClickCurrencyButton(page);

  if (isCurrencyButtonFound) {
    // Handle the currency dialog
    const isUsdSelected = await handleCurrencyDialog(page);

    if (isUsdSelected) {
      // Finalize the currency selection
      await finalizeCurrencySelection(page);
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
    return result || null;
  } catch {
    // If evaluation fails, return null
    console.error("Failed to check current currency");
    return null;
  }
}

export async function handleCurrencyDialog(page: Page): Promise<boolean> {
  if (!page) throw new Error("Page not initialized");

  // Wait for currency dialog to appear
  await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 2000)));

  // Try multiple approaches to select USD
  let isUsdSelected = await selectUsdInCurrencyDialog(page);

  // If primary approach failed, try alternative selection method
  if (!isUsdSelected) {
    isUsdSelected = await tryAlternativeUsdSelection(page);
  }

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
  } catch {
    // If evaluation fails, return false
    console.error("Failed to find USD element");
    return false;
  }
}

export async function finalizeCurrencySelection(page: Page): Promise<boolean> {
  if (!page) throw new Error("Page not initialized");

  // Wait a moment for the selection to register
  await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 2000)));

  // Check if we need an additional attempt to select USD
  try {
    // Use page.evaluate to find and click USD elements
    const isUsdClicked = await page.evaluate(() => {
      // Find elements containing "US Dollar" or "USD" text
      const allElements = Array.from(document.querySelectorAll("*"));
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
    });

    if (isUsdClicked) {
      await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 2000)));
    }
  } catch (error) {
    // Only log if there's an actual error
    console.error("Failed to click USD element in additional attempt:", error);
  }

  // Try to find and click the OK button
  try {
    const isOkButtonClicked = await page.evaluate(() => {
      // Find button with exact "OK" text
      const buttons = Array.from(document.querySelectorAll("button"));

      for (const button of buttons) {
        if (button.textContent?.trim() === "OK") {
          button.click();
          return true;
        }
      }

      // Try partial match
      for (const button of buttons) {
        if (button.textContent?.includes("OK")) {
          button.click();
          return true;
        }
      }

      // Try any button in dialog as last resort
      const dialog = document.querySelector('[role="dialog"]');
      if (dialog) {
        const dialogButtons = dialog.querySelectorAll("button");
        if (dialogButtons.length > 0) {
          dialogButtons[0].click();
          return true;
        }
      }

      return false;
    });

    if (!isOkButtonClicked) {
      // Try Puppeteer selectors if evaluate approach failed
      const okButton = await page.$('button:has-text("OK")');
      if (okButton) {
        await okButton.click();
      } else {
        await clickSaveButtonInCurrencyDialog(page);
      }
    }
  } catch {
    // If button click fails, try the save button as fallback
    console.error("Failed to click OK button, trying save button as fallback");
    await clickSaveButtonInCurrencyDialog(page);
  }

  // Wait for navigation after currency change, but with a shorter timeout
  try {
    await page.waitForNavigation({
      waitUntil: "domcontentloaded", // Use domcontentloaded instead of networkidle2 for faster response
      timeout: 5000, // Reduced from 10000 to 5000 ms
    });
  } catch {
    // Continue even if navigation times out
    console.error("Navigation timeout after currency change, continuing anyway");
  }

  return await verifyCurrencyChangeToUsd(page);
}
