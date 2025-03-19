import { Page } from "puppeteer";
import { takeScreenshot } from "./take-screenshot";

export async function findAndClickCurrencyButton(page: Page): Promise<boolean> {
  if (!page) {
    return false;
  }

  // Take a screenshot before looking for the currency button
  await takeScreenshot(page, "before-find-currency-button");

  // Try multiple approaches to find and click the currency button
  // Approach 1: Look for menu items or buttons with currency-related text
  const isCurrencyButtonFound = await page.evaluate((): boolean => {
    try {
      // Look for elements containing currency-related text
      const currencyTexts = ["Currency", "USD", "EUR", "GBP", "$", "€", "£"];
      const allElements = Array.from(document.querySelectorAll("button, a, [role='button'], [role='menuitem']"));

      // Try to find an element with matching text
      for (const text of currencyTexts) {
        for (const element of allElements) {
          if (element.textContent?.includes(text)) {
            // Check if element is visible
            const rect = element.getBoundingClientRect();
            const isVisible = rect.width > 0 && rect.height > 0 && window.getComputedStyle(element).display !== "none";

            if (isVisible) {
              (element as HTMLElement).click();
              return true;
            }
          }
        }
      }

      return false;
    } catch (e) {
      console.error("Error finding currency button:", e);
      return false;
    }
  });

  if (isCurrencyButtonFound) {
    await takeScreenshot(page, "after-click-currency-button");
  } else {
    // Approach 2: Try to find the settings menu first, then look for currency option

    const isSettingsMenuFound = await page.evaluate((): boolean => {
      try {
        // Look for settings menu or gear icon
        const settingsTexts = ["Settings", "Menu", "Options"];
        const allElements = Array.from(document.querySelectorAll("button, a, [role='button'], [role='menuitem']"));

        // Try to find an element with matching text
        for (const text of settingsTexts) {
          for (const element of allElements) {
            if (element.textContent?.includes(text)) {
              // Check if element is visible
              const rect = element.getBoundingClientRect();
              const isVisible = rect.width > 0 && rect.height > 0 && window.getComputedStyle(element).display !== "none";

              if (isVisible) {
                (element as HTMLElement).click();
                return true;
              }
            }
          }
        }

        return false;
      } catch (e) {
        console.error("Error finding settings menu:", e);
        return false;
      }
    });

    if (isSettingsMenuFound) {
      await takeScreenshot(page, "after-click-settings-menu");

      // Wait for the menu to appear
      await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 1000)));

      // Now look for currency option in the menu
      const isCurrencyOptionFound = await page.evaluate((): boolean => {
        try {
          // Look for currency option in the menu
          const currencyTexts = ["Currency", "USD", "EUR", "GBP", "$", "€", "£"];
          const menuItems = Array.from(document.querySelectorAll("[role='menu'] [role='menuitem'], .menu-item, .dropdown-item"));

          // Try to find a menu item with matching text
          for (const text of currencyTexts) {
            for (const item of menuItems) {
              if (item.textContent?.includes(text)) {
                (item as HTMLElement).click();
                return true;
              }
            }
          }

          return false;
        } catch (e) {
          console.error("Error finding currency option in menu:", e);
          return false;
        }
      });

      if (isCurrencyOptionFound) {
        await takeScreenshot(page, "after-click-currency-option");
        return true;
      }
    }
  }

  return isCurrencyButtonFound;
}
