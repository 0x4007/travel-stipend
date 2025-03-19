import * as puppeteer from "puppeteer";

// Helper function to find search button by text content
export async function findButtonByTextContent(page: puppeteer.Page): Promise<puppeteer.ElementHandle<Element> | null> {
  try {
    const buttonWithSearchText = await page.$$eval('button, [role="button"]', (buttons) => {
      const searchButton = buttons.find((button) => {
        const text = button.textContent?.toLowerCase() ?? "";
        // Use type assertion to access HTMLElement properties
        const htmlButton = button as HTMLElement;
        const isVisible = !!(htmlButton.offsetWidth || htmlButton.offsetHeight || button.getClientRects().length);
        return text.includes("search") && isVisible;
      });

      if (searchButton) {
        return {
          found: true,
          index: Array.from(document.querySelectorAll('button, [role="button"]')).indexOf(searchButton),
        };
      }
      return { found: false };
    });

    if (buttonWithSearchText.found && typeof buttonWithSearchText.index === "number") {
      console.log(`Found button by text content at index ${buttonWithSearchText.index}`);
      const buttons = await page.$$('button, [role="button"]');
      return buttons[buttonWithSearchText.index];
    }
  } catch (textSearchError) {
    console.log("Error finding button by text content:", textSearchError instanceof Error ? textSearchError.message : String(textSearchError));
  }

  return null;
}
