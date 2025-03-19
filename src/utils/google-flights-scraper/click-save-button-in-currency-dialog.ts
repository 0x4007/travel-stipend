import { Page } from "puppeteer";

/**
 * Helper function to click save button in currency dialog
 * @param page - Puppeteer page object
 * @returns Promise resolving to true if button was clicked, false otherwise
 */
export async function clickSaveButtonInCurrencyDialog(page: Page): Promise<boolean> {
  try {
    const isButtonClicked = await page.evaluate((): boolean => {
      try {
        // Look for buttons with text like "Save", "OK", "Done", etc.
        const buttons = Array.from(document.querySelectorAll("button"));

        // Find a button that looks like a save/confirm button
        const saveButton = buttons.find((button) => {
          const text = button.textContent?.trim().toLowerCase() ?? "";
          return text === "ok" || text === "save" || text === "done" || text === "apply" || text === "confirm";
        });

        if (saveButton) {
          (saveButton as HTMLElement).click();
          return true;
        }

        return false;
      } catch (e) {
        console.error("Error clicking save button:", e);
        return false;
      }
    });

    return isButtonClicked === true;
  } catch (e) {
    console.error("Error in clickSaveButtonInCurrencyDialog:", e);
    return false;
  }
}
