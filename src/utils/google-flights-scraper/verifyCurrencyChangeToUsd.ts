import { Page } from "puppeteer";

/**
 * Helper function to verify currency change to USD
 * @param page - Puppeteer page object
 * @returns Promise resolving to true if currency appears to be USD, false otherwise
 */
export async function verifyCurrencyChangeToUsd(page: Page): Promise<boolean> {
  try {
    const isVerified = await page.evaluate((): boolean => {
      try {
        // Check for USD or $ symbols in price elements
        const priceElements = Array.from(document.querySelectorAll('*'));

        // Filter elements that might contain prices
        const potentialPriceElements = priceElements.filter(el => {
          const text = el.textContent?.trim() ?? '';
          return (text.includes('$') || text.includes('USD')) && /\d/.test(text); // Contains digits
        });

        return potentialPriceElements.length > 0;
      } catch (e) {
        console.error("Error verifying currency:", e);
        return false;
      }
    });

    return isVerified === true;
  } catch (e) {
    console.error("Error in verifyCurrencyChangeToUsd:", e);
    return false;
  }
}
