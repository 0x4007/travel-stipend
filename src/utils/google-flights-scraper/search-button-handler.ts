import { ElementHandle, Page } from "puppeteer";
import { LOG_LEVEL } from "./config";
import { log } from "./log";

const SEARCH_BUTTON_SELECTORS = [
  // Specific Google Flights selectors
  'button[jsname="vLv7Lb"]',
  'button[jsname="c6xFrd"]',
  'button[jscontroller="soHxf"]',
  "button.gws-flights__search-button",
  "button.gws-flights-form__search-button",
  'div[role="button"][jsname="vLv7Lb"]',
  'div[role="button"][jsname="c6xFrd"]',
  'div[role="button"][jscontroller="soHxf"]',
  'div[jsname="vLv7Lb"]',
  'div[jsname="c6xFrd"]',
  // Generic search button selectors
  'button[aria-label*="Search"]',
  'button[aria-label*="search"]',
  'button:has-text("Search")',
  "button.search-button",
  // Material design button selectors
  "button.VfPpkd-LgbsSe",
  // Role-based selectors
  '[role="button"][aria-label*="Search"]',
  '[role="button"][aria-label*="search"]',
  '[role="button"]:has-text("Search")',
  // Any element with search-related attributes
  '[jsaction*="search"]',
  '[data-flt-ve="search_button"]',
];

interface ButtonInfo {
  element: ElementHandle<Element>;
  boundingBox: { x: number; y: number } | null;
}

async function findButtonBySelectors(page: Page): Promise<ElementHandle<Element> | null> {
  for (const selector of SEARCH_BUTTON_SELECTORS) {
    try {
      log(LOG_LEVEL.DEBUG, `Trying search button selector: ${selector}`);
      const button = await page.$(selector);
      if (button) {
        log(LOG_LEVEL.INFO, `Found search button with selector: ${selector}`);
        return button;
      }
    } catch (error) {
      if (error instanceof Error) {
        log(LOG_LEVEL.DEBUG, `Selector ${selector} not found or error: ${error.message}`);
      }
    }
  }
  return null;
}

async function findButtonByText(page: Page): Promise<ElementHandle<Element> | null> {
  try {
    const buttons = await page.$$('button, [role="button"]');

    for (const button of buttons) {
      try {
        const textContent = await button.evaluate(el => el.textContent?.toLowerCase() ?? "");
        const ariaLabel = await button.evaluate(el => el.getAttribute("aria-label")?.toLowerCase() ?? "");

        if (textContent.includes("search") || ariaLabel.includes("search")) {
          log(LOG_LEVEL.INFO, `Found search button by text content: ${textContent}`);
          return button;
        }
      } catch (error) {
        if (error instanceof Error) {
          log(LOG_LEVEL.DEBUG, `Error getting button text: ${error.message}`);
        }
      }
    }
  } catch (error) {
    if (error instanceof Error) {
      log(LOG_LEVEL.ERROR, "Error finding button by text content:", error.message);
    }
  }
  return null;
}

async function findButtonByPosition(page: Page): Promise<ElementHandle<Element> | null> {
  try {
    const elements = await page.$$('button, [role="button"], a[href], [tabindex="0"]');

    if (elements.length === 0) return null;

    const elementInfos = await Promise.all(
      elements.map(async (element): Promise<ButtonInfo> => {
        const boundingBox = await element.boundingBox();
        return {
          element,
          boundingBox: boundingBox ? { x: boundingBox.x, y: boundingBox.y } : null
        };
      })
    );

    const visibleElements = elementInfos
      .filter((info): info is ButtonInfo & { boundingBox: NonNullable<ButtonInfo["boundingBox"]> } =>
        info.boundingBox !== null
      )
      .sort((a, b) => {
        const aBox = a.boundingBox;
        const bBox = b.boundingBox;
        return Math.abs(aBox.y - bBox.y) > 50
          ? bBox.y - aBox.y // Bottom first
          : bBox.x - aBox.x; // Right first
      });

    if (visibleElements.length > 0) {
      log(LOG_LEVEL.INFO, "Using bottom-right element as search button");
      return visibleElements[0].element;
    }
  } catch (error) {
    if (error instanceof Error) {
      log(LOG_LEVEL.ERROR, `Error finding button by position: ${error.message}`);
    }
  }
  return null;
}

async function tryStandardClick(button: ElementHandle<Element>): Promise<boolean> {
  try {
    await button.click({ delay: 100 });
    log(LOG_LEVEL.INFO, "Clicked search button with standard click");
    return true;
  } catch (error) {
    if (error instanceof Error) {
      log(LOG_LEVEL.WARN, `Standard click failed: ${error.message}`);
    }
    return false;
  }
}

async function tryJavaScriptClick(page: Page, button: ElementHandle<Element>): Promise<boolean> {
  try {
    await page.evaluate((element: Element) => {
      if (!(element instanceof HTMLElement)) return;

      const clickElement = (el: HTMLElement) => {
        el.click();
        el.dispatchEvent(new MouseEvent("click", {
          view: window,
          bubbles: true,
          cancelable: true,
        }));
      };

      // Try clicking the element itself
      clickElement(element);

      // Try parent button elements
      for (let parent = element.parentElement; parent; parent = parent.parentElement) {
        if (parent instanceof HTMLElement &&
            (parent.tagName === 'BUTTON' || parent.getAttribute('role') === 'button')) {
          clickElement(parent);
          break;
        }
      }

      // Try child button elements
      const childButton = element.querySelector('button, [role="button"]');
      if (childButton instanceof HTMLElement) {
        clickElement(childButton);
      }

      // Try submitting parent forms
      for (let parent = element.parentElement; parent; parent = parent.parentElement) {
        if (parent instanceof HTMLFormElement) {
          parent.submit();
          break;
        }
      }
    }, button);
    log(LOG_LEVEL.INFO, "Clicked search button with JavaScript");
    return true;
  } catch (error) {
    if (error instanceof Error) {
      log(LOG_LEVEL.ERROR, `JavaScript click failed: ${error.message}`);
    }
    return false;
  }
}

async function waitForSearchResults(page: Page): Promise<void> {
  try {
    await Promise.race([
      page.waitForNavigation({ waitUntil: "networkidle2", timeout: 30000 }),
      page.waitForSelector('[role="main"]', { timeout: 30000 }),
      page.waitForSelector('.gws-flights-results__results-container', { timeout: 30000 }),
      page.waitForSelector('[data-test-id="price-column"]', { timeout: 30000 }),
      page.waitForFunction(
        () => {
          const regex = /search|flights\/search|results/;
          return regex.test(window.location.href);
        },
        { timeout: 30000 }
      ),
      new Promise(resolve => setTimeout(resolve, 30000))
    ]);

    log(LOG_LEVEL.INFO, "Search results loaded or timeout occurred");
    const url = await page.url();
    log(LOG_LEVEL.INFO, `Current URL: ${url}`);
  } catch (error) {
    if (error instanceof Error) {
      log(LOG_LEVEL.WARN, `Error waiting for search results: ${error.message}`);
      log(LOG_LEVEL.INFO, "Continuing despite error waiting for results");
    }
  }
}

async function handleClickFailure(page: Page): Promise<void> {
  log(LOG_LEVEL.WARN, "Click failed, trying to press Enter as fallback");
  await page.keyboard.press("Enter");
  log(LOG_LEVEL.INFO, "Pressed Enter key");
}

async function checkForSubmitButtons(page: Page): Promise<void> {
  const submitButtons = await page.$$('button[type="submit"], input[type="submit"]');
  if (submitButtons.length > 0) {
    log(LOG_LEVEL.INFO, `Found ${submitButtons.length} potential submit buttons, trying to click the first one`);
    try {
      await submitButtons[0].click();
      log(LOG_LEVEL.INFO, "Clicked additional submit button");
    } catch (error) {
      if (error instanceof Error) {
        log(LOG_LEVEL.WARN, `Error clicking additional submit button: ${error.message}`);
      }
    }
  }
}

export async function clickSearchButton(page: Page): Promise<void> {
  if (!page) throw new Error("Page not initialized");

  log(LOG_LEVEL.INFO, "STEP 4: Finding and clicking search button");

  // Try different methods to find the search button
  const searchButton = await findButtonBySelectors(page) ||
                      await findButtonByText(page) ||
                      await findButtonByPosition(page);

  if (searchButton) {
    // Log button details
    const buttonInfo = await searchButton.evaluate(el => ({
      text: el.textContent?.trim() ?? "",
      className: el.className ?? "",
      type: el.tagName ?? ""
    }));
    log(LOG_LEVEL.INFO, `Button details - Text: "${buttonInfo.text}", Class: "${buttonInfo.className}", Type: ${buttonInfo.type}`);

    // Try clicking methods
    const didStandardClick = await tryStandardClick(searchButton);
    if (!didStandardClick) {
      const didJsClick = await tryJavaScriptClick(page, searchButton);
      if (!didJsClick) {
        await handleClickFailure(page);
      }
    }
  } else {
    log(LOG_LEVEL.WARN, "Could not find search button, trying fallback approaches");
    await handleClickFailure(page);
  }

  // Wait for initial click processing
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Check for additional submit buttons
  await checkForSubmitButtons(page);

  // Wait for results
  await waitForSearchResults(page).catch(error => {
    if (error instanceof Error) {
      log(LOG_LEVEL.ERROR, `Error in waitForSearchResults: ${error.message}`);
    }
  });

  // Final wait for animations
  // Explicitly mark this Promise as intentionally not awaited
  void new Promise(resolve => setTimeout(resolve, 3000));
}
