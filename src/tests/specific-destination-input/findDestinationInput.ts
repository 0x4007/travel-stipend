import * as puppeteer from 'puppeteer';

// Helper function to find destination input field
export async function findDestinationInput(page: puppeteer.Page): Promise<puppeteer.ElementHandle<Element> | null> {
  console.log('Looking for specific destination input field...');
  const destinationInputSelector = 'input.II2One.j0Ppje.zmMKJ.LbIaRd[jsname="yrriRe"][placeholder="Where to?"][aria-label="Where to? "]';

  // Try to find the element with the specific selector
  let foundSelector = destinationInputSelector;
  let isElementFound = await page.evaluate((selector) => !!document.querySelector(selector), destinationInputSelector);

  // If not found, try a more general selector
  if (!isElementFound) {
    console.log('Specific selector not found, trying more general selectors...');
    const alternativeSelectors = [
      'input[placeholder="Where to?"]',
      'input[aria-label="Where to? "]',
      'input[jsname="yrriRe"]',
      'input.II2One',
      'input[role="combobox"][aria-autocomplete="inline"]'
    ];

    for (const selector of alternativeSelectors) {
      console.log(`Trying selector: ${selector}`);
      isElementFound = await page.evaluate((selector) => !!document.querySelector(selector), selector);
      if (isElementFound) {
        console.log(`Found destination input with selector: ${selector}`);
        foundSelector = selector;
        break;
      }
    }
  }

  if (!isElementFound) {
    return null;
  }

  return page.$(foundSelector);
}
