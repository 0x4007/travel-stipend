import { Page } from "puppeteer";
import { LOG_LEVEL } from "./config";
import { log } from "./log";

export async function clickSaveButtonInCurrencyDialog(page: Page): Promise<boolean> {
  if (!page) throw new Error("Page not initialized");

  log(LOG_LEVEL.INFO, "Attempting to click Save button in currency dialog");

  try {
    // Try multiple selectors for the Save button
    const saveButtonSelectors = [
      'button[jsname="LgbsSe"]',
      'button[aria-label="Save"]',
      'button:has-text("Save")',
      'button:has-text("Done")',
      'button:has-text("Apply")',
      'button.gws-flights__dialog-button',
      'button.VfPpkd-LgbsSe',
      '[role="button"]:has-text("Save")',
      '[role="button"]:has-text("Done")',
      '[role="button"]:has-text("Apply")',
    ];

    for (const selector of saveButtonSelectors) {
      try {
        log(LOG_LEVEL.DEBUG, `Trying Save button selector: ${selector}`);
        const saveButton = await page.$(selector);
        if (saveButton) {
          log(LOG_LEVEL.INFO, `Found Save button with selector: ${selector}`);
          await saveButton.click();
          log(LOG_LEVEL.INFO, "Clicked Save button");
          return true;
        }
      } catch (error) {
        log(LOG_LEVEL.DEBUG, `Selector ${selector} not found or error: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    // If no button found with selectors, try JavaScript approach
    const isSaveButtonClicked = await page.evaluate(() => {
      // Find buttons with Save, Done, or Apply text
      const buttons = Array.from(document.querySelectorAll("button"));
      for (const button of buttons) {
        const text = button.textContent?.trim().toLowerCase() || "";
        if (text.includes("save") || text.includes("done") || text.includes("apply") || text.includes("ok")) {
          button.click();
          return true;
        }
      }

      // Try any button in dialog as last resort
      const dialog = document.querySelector('[role="dialog"]');
      if (dialog) {
        const dialogButtons = dialog.querySelectorAll("button");
        if (dialogButtons.length > 0) {
          // Try the last button in the dialog (often the confirm button)
          dialogButtons[dialogButtons.length - 1].click();
          return true;
        }
      }

      return false;
    });

    if (isSaveButtonClicked) {
      log(LOG_LEVEL.INFO, "Clicked Save button with JavaScript");
      return true;
    }

    log(LOG_LEVEL.WARN, "Could not find Save button in currency dialog");
    return false;
  } catch (error) {
    log(LOG_LEVEL.ERROR, "Error clicking Save button:", error instanceof Error ? error.message : String(error));
    return false;
  }
}
