import * as puppeteer from 'puppeteer';

// Helper function to check if an element is visible
async function isElementVisible(page: puppeteer.Page, element: puppeteer.ElementHandle<Element>): Promise<boolean> {
  return page.evaluate(el => {
    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    return rect.width > 0 &&
      rect.height > 0 &&
      style.visibility !== 'hidden' &&
      style.display !== 'none' &&
      style.opacity !== '0';
  }, element);
}

// Helper function to find a button by various selectors
export async function findButtonBySelectors(page: puppeteer.Page, selectors: string[]): Promise<{ button: puppeteer.ElementHandle<Element> | null; selector: string; }> {
  let button = null;
  let buttonSelector = '';

  for (const selector of selectors) {
    console.log(`Trying selector: ${selector}`);
    try {
      const elements = await page.$$(selector);
      console.log(`Found ${elements.length} elements with selector: ${selector}`);

      if (elements.length === 0) continue;

      // Check if any of the elements are visible
      for (const element of elements) {
        const isVisible = await isElementVisible(page, element);

        if (isVisible) {
          button = element;
          buttonSelector = selector;
          console.log(`Found visible button with selector: ${selector}`);
          break;
        }
      }

      if (button) break;
    } catch (selectorError) {
      console.log(`Error with selector ${selector}:`, selectorError instanceof Error ? selectorError.message : String(selectorError));
    }
  }

  return { button, selector: buttonSelector };
}
