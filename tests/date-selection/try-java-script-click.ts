import * as puppeteer from "puppeteer";

export function tryJavaScriptClick(page: puppeteer.Page, searchTexts: string[]): Promise<boolean> {
  return page
    .evaluate((searchTexts) => {
      // Try to find by various selectors
      let searchButton: HTMLElement | null = null;

      // Try specific Google Flights selectors first
      const specificSelectors = [
        'button[jsname="vLv7Lb"]',
        'button[jsname="c6xFrd"]',
        "button.gws-flights__search-button",
        "button.gws-flights-form__search-button",
      ];

      for (const selector of specificSelectors) {
        const btn = document.querySelector(selector) as HTMLElement | null;
        if (btn) {
          searchButton = btn;
          break;
        }
      }

      // If not found, try more generic approaches
      if (!searchButton) {
        // Try to find by text content
        const buttons = Array.from(document.querySelectorAll('button, [role="button"]'));
        const foundButton = buttons.find((el) => {
          // Check text content
          const text = el.textContent?.toLowerCase() ?? "";
          if (searchTexts.some((searchText) => text.includes(searchText.toLowerCase()))) return true;

          // Check aria-label
          const ariaLabel = el.getAttribute("aria-label")?.toLowerCase() ?? "";
          if (searchTexts.some((searchText) => ariaLabel.includes(searchText.toLowerCase()))) return true;

          // Check class names
          const className = el.className?.toLowerCase() ?? "";
          if (className.includes("search") || className.includes("submit")) return true;

          // Check other attributes
          const jsaction = el.getAttribute("jsaction")?.toLowerCase() ?? "";
          return jsaction.includes("search");
        });

        if (foundButton) {
          searchButton = foundButton as HTMLElement;
        }
      }

      // If found, try to click it
      if (searchButton) {
        try {
          // Try multiple click methods
          searchButton.click(); // Standard click

          // Also try dispatching events
          const clickEvent = new MouseEvent("click", {
            view: window,
            bubbles: true,
            cancelable: true,
          });
          searchButton.dispatchEvent(clickEvent);

          return {
            success: true,
            method: "JavaScript click",
            buttonText: searchButton.textContent?.trim() ?? "",
            buttonClass: searchButton.className ?? "",
          };
        } catch (e) {
          return { success: false, error: String(e) };
        }
      }

      return { success: false, reason: "No search button found" };
    }, searchTexts)
    .then((result) => {
      console.log("JavaScript click result:", result);
      return result.success;
    });
}
