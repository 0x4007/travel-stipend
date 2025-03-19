import { Page } from "puppeteer";

// Helper function to find and click currency button
export async function findAndClickCurrencyButton(page: Page): Promise<boolean> {
  return page.evaluate((): boolean => {
    try {
      // Look for all buttons on the page
      const allButtons = Array.from(document.querySelectorAll('button, [role="button"]'));
      console.log("Total buttons found:", allButtons.length);

      // Find buttons that contain "Currency" and "KRW" text
      const currencyButtons = allButtons.filter((button) => {
        const text = button.textContent?.trim() ?? "";
        return text.includes("Currency") && text.includes("KRW");
      });

      console.log("Currency buttons found:", currencyButtons.length);

      if (currencyButtons.length > 0) {
        console.log("Found currency button:", currencyButtons[0].outerHTML);
        // Click the first matching button
        (currencyButtons[0] as HTMLElement).click();
        return true;
      }

      // If we couldn't find a button with both "Currency" and "KRW", try a more general approach
      // Look for any element that contains both "Currency" and "KRW"
      const allElements = Array.from(document.querySelectorAll("*"));
      const currencyElements = allElements.filter((el) => {
        const text = el.textContent?.trim() ?? "";
        const isVisible = el.getBoundingClientRect().width > 0 && el.getBoundingClientRect().height > 0 && window.getComputedStyle(el).display !== "none";
        return text.includes("Currency") && text.includes("KRW") && isVisible;
      });

      console.log("Currency elements found:", currencyElements.length);

      if (currencyElements.length > 0) {
        console.log("Found currency element:", currencyElements[0].outerHTML);
        (currencyElements[0] as HTMLElement).click();
        return true;
      }

      // If we still couldn't find it, look for elements with SVG and "Currency" text
      const elementsWithSvg = allElements.filter((el) => {
        const hasSvg = el.querySelector("svg") !== null;
        const text = el.textContent?.trim() ?? "";
        const isVisible = el.getBoundingClientRect().width > 0 && el.getBoundingClientRect().height > 0 && window.getComputedStyle(el).display !== "none";
        return hasSvg && text.includes("Currency") && isVisible;
      });

      console.log("Elements with SVG and Currency text:", elementsWithSvg.length);

      if (elementsWithSvg.length > 0) {
        console.log("Found element with SVG:", elementsWithSvg[0].outerHTML);
        (elementsWithSvg[0] as HTMLElement).click();
        return true;
      }

      return false;
    } catch (e) {
      console.error("Error finding currency button:", e);
      return false;
    }
  });
}
