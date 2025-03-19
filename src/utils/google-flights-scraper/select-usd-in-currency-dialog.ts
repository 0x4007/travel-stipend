import { Page } from "puppeteer";

/**
 * Helper function to select USD in currency dialog
 * @param page - Puppeteer page object
 * @returns Promise resolving to true if USD was selected, false otherwise
 */
export async function selectUsdInCurrencyDialog(page: Page): Promise<boolean> {
  try {
    const isSuccess = await page.evaluate((): boolean => {
      try {
        // First try to find USD in the suggested currencies section
        const allElements = Array.from(document.querySelectorAll("div, span, label, input"));

        // Find elements containing "US Dollar" or "USD"
        const usdElements = allElements.filter((el) => {
          const text = el.textContent?.trim() ?? "";
          return text.includes("US Dollar") || text.includes("USD");
        });

        if (usdElements.length > 0) {
          // Click the first matching element
          (usdElements[0] as HTMLElement).click();
          return true;
        }

        // If we couldn't find USD by text, try to find radio buttons
        const radioButtons = document.querySelectorAll('input[type="radio"]');
        for (const radio of radioButtons) {
          const label = radio.parentElement;
          const labelText = label?.textContent ?? "";
          if (labelText.includes("US Dollar") || labelText.includes("USD")) {
            (radio as HTMLElement).click();
            return true;
          }
        }

        return false;
      } catch (e) {
        console.error("Error selecting USD:", e);
        return false;
      }
    });

    return isSuccess === true;
  } catch (e) {
    console.error("Error in selectUsdInCurrencyDialog:", e);
    return false;
  }
}
