import * as puppeteer from "puppeteer";
import { findButtonBySelectors } from "../find-button-by-selectors";
import { tryMultipleClickApproaches } from "../try-multiple-click-approaches";

export async function clickDoneButton(page: puppeteer.Page): Promise<void> {
  // Find and click the "Done" button in the date picker
  console.log("Looking for Done button...");
  const doneButtonSelectors = [
    'button[jsname="McfNlf"]',
    'button[aria-label*="Done"]',
    'button:has-text("Done")',
    "button.done-button",
    ".gws-flights__calendar-done-button",
    // More specific selectors based on the visible elements
    'button[aria-label="Done. Search for round trip flights departing on March 26 2025 and returning on April 2 2025"]',
    "button.VfPpkd-LgbsSe.VfPpkd-LgbsSe-OWXEXe-k8QpJ.VfPpkd-LgbsSe-OWXEXe-dgl2Hf.nCP5yc.AjY5Oe.DuMIQc.LQeN7",
  ];

  // Try to find the Done button
  const { button: doneButton, selector: doneButtonSelector } = await findButtonBySelectors(page, doneButtonSelectors);

  if (doneButton) {
    console.log(`Found Done button with selector: ${doneButtonSelector}, attempting to click it...`);

    try {
      // Take a screenshot before clicking
      await page.screenshot({ path: `./logs/screenshots/before-done-button-click-${Date.now()}.png` });

      // Try multiple approaches to click the button
      await tryMultipleClickApproaches(page, doneButton);

      // Take a screenshot after clicking
      await page.screenshot({ path: `./logs/screenshots/after-done-button-click-${Date.now()}.png` });

      // Wait a moment after clicking Done button
      await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 1000)));
    } catch (clickError) {
      console.log("All click attempts failed:", clickError instanceof Error ? clickError.message : String(clickError));
      console.log("Continuing without clicking Done button...");
    }
  } else {
    console.log("Could not find Done button, continuing anyway...");

    // Alternative approach: Press Enter key
    console.log("Trying to press Enter key as alternative to clicking Done...");
    await page.keyboard.press("Enter");
    await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 1000)));
  }
}
