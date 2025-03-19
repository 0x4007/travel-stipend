import * as puppeteer from "puppeteer";

/**
 * Enter destination
 */
export async function enterDestination(page: puppeteer.Page, destination: string): Promise<void> {
  // Find and click on the destination input field
  console.log(`Looking for destination input field...`);
  const destinationInput = await page.waitForSelector('input[placeholder="Where to?"], input[aria-label="Where to? "]', {
    visible: true,
    timeout: 10000,
  });

  if (!destinationInput) {
    throw new Error("Could not find destination input field");
  }

  console.log("Found destination input field, clicking on it...");
  await destinationInput.click();

  // Type destination in the destination field
  console.log(`Typing "${destination}" in destination field...`);
  await page.keyboard.type(destination, { delay: 100 });

  // Wait for dropdown to appear
  console.log("Waiting for dropdown to appear...");
  await page.waitForSelector('ul[role="listbox"]', { timeout: 5000 });

  // Select the first item in the dropdown
  console.log("Selecting first dropdown item...");
  const firstItem = await page.waitForSelector('li[role="option"]:first-child', { timeout: 5000 });

  if (firstItem) {
    await firstItem.click();
    console.log("Selected first dropdown item");
  } else {
    console.log("Could not find first dropdown item, trying to press Enter instead");
    await page.keyboard.press("Enter");
  }

  // Wait for the date field to be ready
  await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 1000)));
}
