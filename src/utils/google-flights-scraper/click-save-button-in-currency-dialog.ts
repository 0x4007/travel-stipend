import { Page } from "puppeteer";
import { LOG_LEVEL } from "./config";
import { log } from "./log";

export async function clickSaveButtonInCurrencyDialog(page: Page): Promise<boolean> {
  if (!page) {
    log(LOG_LEVEL.ERROR, "Cannot click save button: page is null");
    return false;
  }

  try {
    log(LOG_LEVEL.DEBUG, "Attempting to find and click save button in currency dialog");

    // Try multiple approaches to find and click the save button
    const isSaveButtonClicked = await page.evaluate((): boolean => {
      try {
        // Find all buttons in the dialog
        const dialog = document.querySelector('[role="dialog"], .dialog, [aria-modal="true"]');
        if (!dialog) return false;

        // Look for buttons with text like "OK", "Save", "Done", etc.
        const buttonTexts = ["OK", "Save", "Done", "Apply", "Confirm"];
        const buttons = Array.from(dialog.querySelectorAll("button"));

        // Try to find a button with matching text
        for (const text of buttonTexts) {
          for (const button of buttons) {
            if (button.textContent?.includes(text)) {
              (button as HTMLElement).click();
              return true;
            }
          }
        }

        // If no button with specific text was found, try the last button in the dialog
        if (buttons.length > 0) {
          (buttons[buttons.length - 1] as HTMLElement).click();
          return true;
        }

        return false;
      } catch (e) {
        console.error("Error clicking save button:", e);
        return false;
      }
    });

    if (isSaveButtonClicked) {
      log(LOG_LEVEL.INFO, "Successfully clicked save button in currency dialog");
    } else {
      log(LOG_LEVEL.WARN, "Could not find or click save button in currency dialog");
    }

    return isSaveButtonClicked;
  } catch (error) {
    log(LOG_LEVEL.ERROR, "Error clicking save button in currency dialog:", error);
    return false;
  }
}
