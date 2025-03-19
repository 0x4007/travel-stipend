import * as puppeteer from 'puppeteer';

/**
 * Try standard Puppeteer click
 */
async function tryStandardClick(element: puppeteer.ElementHandle<Element>): Promise<boolean> {
  console.log('Trying standard Puppeteer click...');
  try {
    await element.click({ delay: 100 });
    console.log('Standard click succeeded');
    return true;
  } catch (e) {
    console.log('Standard click failed:', e instanceof Error ? e.message : String(e));
    return false;
  }
}

/**
 * Try JavaScript click
 */
async function tryJavaScriptClick(page: puppeteer.Page, element: puppeteer.ElementHandle<Element>): Promise<boolean> {
  console.log('Trying JavaScript click...');
  try {
    await page.evaluate(element => {
      (element as HTMLElement).click();
    }, element);
    console.log('JavaScript click succeeded');
    return true;
  } catch (e) {
    console.log('JavaScript click failed:', e instanceof Error ? e.message : String(e));
    return false;
  }
}

/**
 * Try click by coordinates
 */
async function tryCoordinateClick(page: puppeteer.Page, element: puppeteer.ElementHandle<Element>): Promise<boolean> {
  console.log('Trying click by coordinates...');
  try {
    const boundingBox = await element.boundingBox();
    if (!boundingBox) {
      console.log('Could not get bounding box for element');
      return false;
    }

    await page.mouse.click(
      boundingBox.x + boundingBox.width / 2,
      boundingBox.y + boundingBox.height / 2
    );
    console.log('Click by coordinates succeeded');
    return true;
  } catch (e) {
    console.log('Click by coordinates failed:', e instanceof Error ? e.message : String(e));
    return false;
  }
}

/**
 * Helper function to try multiple click approaches
 */
export async function tryMultipleClickApproaches(page: puppeteer.Page, element: puppeteer.ElementHandle<Element>): Promise<boolean> {
  // Try each approach in sequence
  if (await tryStandardClick(element)) {
    return true;
  }

  console.log('Standard click failed, trying alternative methods...');

  if (await tryJavaScriptClick(page, element)) {
    return true;
  }

  return await tryCoordinateClick(page, element);
}
