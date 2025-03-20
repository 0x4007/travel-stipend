import { ElementHandle, Page } from "puppeteer";
import { LOG_LEVEL } from "./config";
import { log } from "./log";


export async function clickSearchButton(page: Page): Promise<void> {
  if (!page) throw new Error("Page not initialized");

  log(LOG_LEVEL.INFO, "STEP 4: Finding and clicking search button");


  // Try multiple selectors for the search button
  const searchButtonSelectors = [
    // Specific Google Flights selectors
    'button[jsname="vLv7Lb"]',
    'button[jsname="c6xFrd"]',
    'button[jscontroller="soHxf"]',
    "button.gws-flights__search-button",
    "button.gws-flights-form__search-button",
    // More specific selectors for Google Flights
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

  // Try to find the search button using selectors
  let searchButton: ElementHandle<Element> | null = null;
  let usedSelector = "";

  for (const selector of searchButtonSelectors) {
    try {
      log(LOG_LEVEL.DEBUG, `Trying search button selector: ${selector}`);
      const button = await page.$(selector);
      if (button) {
        searchButton = button;
        usedSelector = selector;
        log(LOG_LEVEL.INFO, `Found search button with selector: ${selector}`);
        break;
      }
    } catch (error) {
      log(LOG_LEVEL.DEBUG, `Selector ${selector} not found or error: ${error}`);
    }
  }

  // If not found with specific selectors, try to find by text content
  if (!searchButton) {
    log(LOG_LEVEL.WARN, "Could not find search button with specific selectors, trying to find by text content");

    try {
      // Find all buttons or elements with role="button"
      const buttons = await page.$$('button, [role="button"]');

      for (const button of buttons) {
        try {
          const textContent = await button.evaluate(el => el.textContent?.toLowerCase() ?? "");
          const ariaLabel = await button.evaluate(el => el.getAttribute("aria-label")?.toLowerCase() ?? "");

          if (textContent.includes("search") || ariaLabel.includes("search")) {
            searchButton = button;
            log(LOG_LEVEL.INFO, `Found search button by text content: ${textContent}`);
            break;
          }
        } catch (error) {
          // Continue to next button if there's an error with this one
          log(LOG_LEVEL.DEBUG, `Error getting button text: ${error}`);
        }
      }
    } catch (error) {
      log(LOG_LEVEL.ERROR, `Error finding button by text content: ${error}`);
    }
  }

  // If still not found, try to find by position (often search button is at bottom right)
  if (!searchButton) {
    log(LOG_LEVEL.WARN, "Could not find search button by text content, trying to find by position");

    try {
      // Get all clickable elements
      const clickableElements = await page.$$('button, [role="button"], a[href], [tabindex="0"]');

      if (clickableElements.length > 0) {
        // Get the positions of all elements
        const elementsWithPositions = await Promise.all(
          clickableElements.map(async (element) => {
            try {
              const boundingBox = await element.boundingBox();
              return { element, boundingBox };
            } catch (error) {
              return { element, boundingBox: null };
            }
          })
        );

        // Filter out elements without a bounding box and sort by position (bottom-right first)
        const visibleElements = elementsWithPositions
          .filter(({ boundingBox }) => boundingBox !== null)
          .sort((a, b) => {
            const aBox = a.boundingBox!;
            const bBox = b.boundingBox!;

            // Sort by y-coordinate (bottom first) and then by x-coordinate (right first)
            if (Math.abs(aBox.y - bBox.y) > 50) {
              return bBox.y - aBox.y; // Bottom first
            }
            return bBox.x - aBox.x; // Right first
          });

        if (visibleElements.length > 0) {
          // Use the bottom-right element as the search button
          searchButton = visibleElements[0].element;
          log(LOG_LEVEL.INFO, "Using bottom-right element as search button");
        }
      }
    } catch (error) {
      log(LOG_LEVEL.ERROR, `Error finding button by position: ${error}`);
    }
  }

  // If a search button was found, try to click it
  if (searchButton) {
    log(LOG_LEVEL.INFO, "Found search button, attempting to click it");

    // Take a screenshot before clicking


    // Get button text and attributes for better logging
    const buttonText = await searchButton.evaluate(el => el.textContent?.trim() ?? "");
    const buttonClass = await searchButton.evaluate(el => el.className ?? "");
    const buttonType = await searchButton.evaluate(el => el.tagName ?? "");
    log(LOG_LEVEL.INFO, `Button details - Text: "${buttonText}", Class: "${buttonClass}", Type: ${buttonType}`);

    try {
      // Try standard click first
      await searchButton.click({ delay: 100 });
      log(LOG_LEVEL.INFO, "Clicked search button with standard click");

      // Take a screenshot after clicking

    } catch (error) {
      log(LOG_LEVEL.WARN, `Standard click failed: ${error}`);

      try {
        // If standard click fails, try JavaScript click
        log(LOG_LEVEL.INFO, "Trying JavaScript click as fallback");
        await page.evaluate((element) => {
          if (element instanceof HTMLElement) {
            // Try multiple click approaches
            element.click();

            // Also dispatch events for good measure
            const clickEvent = new MouseEvent("click", {
              view: window,
              bubbles: true,
              cancelable: true,
            });
            element.dispatchEvent(clickEvent);

            // Try to find and click any parent button
            let parent = element.parentElement;
            while (parent) {
              if (parent instanceof HTMLElement &&
                  (parent.tagName === 'BUTTON' ||
                   parent.getAttribute('role') === 'button')) {
                parent.click();
                break;
              }
              parent = parent.parentElement;
            }

            // Try to find and click any child button
            const childButton = element.querySelector('button, [role="button"]');
            if (childButton instanceof HTMLElement) {
              childButton.click();
            }

            // Try to submit any parent form
            parent = element.parentElement;
            while (parent) {
              if (parent instanceof HTMLFormElement) {
                parent.submit();
                break;
              }
              parent = parent.parentElement;
            }
          }
        }, searchButton);

        log(LOG_LEVEL.INFO, "Clicked search button with JavaScript");

        // Take a screenshot after JavaScript click

      } catch (jsError) {
        log(LOG_LEVEL.ERROR, `JavaScript click failed: ${jsError}`);

        // If clicking fails, try pressing Enter as a last resort
        log(LOG_LEVEL.WARN, "Click failed, trying to press Enter as fallback");
        await page.keyboard.press("Enter");
        log(LOG_LEVEL.INFO, "Pressed Enter key");
      }
    }
  } else {
    // If no search button was found, try JavaScript click approach
    log(LOG_LEVEL.WARN, "Could not find search button with any approach, trying JavaScript click on any search-related element");

    const isJsClickSuccessful = await tryJavaScriptClick(page);

    if (!isJsClickSuccessful) {
      // Last resort: press Enter key
      log(LOG_LEVEL.WARN, "JavaScript click failed, trying to press Enter as last resort");
      await page.keyboard.press("Enter");
      log(LOG_LEVEL.INFO, "Pressed Enter key");
    }
  }

  // Wait for results to load
  log(LOG_LEVEL.INFO, "Waiting for search results to load");

  try {
    // First, wait a moment to ensure the click has been processed
    await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 2000)));

    // Take a screenshot after initial wait


    // Check if we need to click a submit button again
    const submitButtons = await page.$$('button[type="submit"], input[type="submit"]');
    if (submitButtons.length > 0) {
      log(LOG_LEVEL.INFO, `Found ${submitButtons.length} potential submit buttons, trying to click the first one`);
      try {
        await submitButtons[0].click();
        log(LOG_LEVEL.INFO, "Clicked additional submit button");

      } catch (error) {
        log(LOG_LEVEL.WARN, `Error clicking additional submit button: ${error}`);
      }
    }

    // Wait for navigation or network idle
    log(LOG_LEVEL.INFO, "Waiting for page changes indicating search results");
    await Promise.race([
      page.waitForNavigation({ waitUntil: "networkidle2", timeout: 30000 }),
      page.waitForSelector('[role="main"]', { timeout: 30000 }),
      page.waitForSelector('.gws-flights-results__results-container', { timeout: 30000 }),
      page.waitForSelector('[data-test-id="price-column"]', { timeout: 30000 }),
      page.waitForFunction(() => {
        // Check for URL changes that might indicate search results
        return window.location.href.includes('search') ||
               window.location.href.includes('flights/search') ||
               window.location.href.includes('results');
      }, { timeout: 30000 }),
      // Add a timeout promise to avoid waiting too long
      new Promise(resolve => setTimeout(resolve, 30000))
    ]);

    log(LOG_LEVEL.INFO, "Search results loaded or timeout occurred");

    // Check if the URL has changed to include search parameters
    const url = await page.url();
    log(LOG_LEVEL.INFO, `Current URL: ${url}`);
  } catch (error) {
    log(LOG_LEVEL.WARN, `Error waiting for search results: ${error}`);
    log(LOG_LEVEL.INFO, "Continuing despite error waiting for results");
  }

  // Take a screenshot of the search results


  // Wait a moment for any animations to complete
  await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 3000)));

}


async function tryJavaScriptClick(page: Page): Promise<boolean> {
  log(LOG_LEVEL.INFO, "Trying JavaScript click approach");

  const searchTexts = ["search", "Search", "SEARCH", "find", "Find", "FIND", "go", "Go", "GO"];

  try {
    const result = await page.evaluate((searchTexts) => {
      // Try to find by various selectors
      let searchButton: HTMLElement | null = null;

      // Try specific Google Flights selectors first
      const specificSelectors = [
        'button[jsname="vLv7Lb"]',
        'button[jsname="c6xFrd"]',
        "button.gws-flights__search-button",
        "button.gws-flights-form__search-button",
        'div[role="button"][jsname="vLv7Lb"]',
        'div[role="button"][jsname="c6xFrd"]',
        'div[jsname="vLv7Lb"]',
        'div[jsname="c6xFrd"]',
        'button[type="submit"]',
        'input[type="submit"]',
      ];

      for (const selector of specificSelectors) {
        const btn = document.querySelector(selector) as HTMLElement | null;
        if (btn) {
          searchButton = btn;
          break;
        }
      }

      // If not found, try more generic approaches
      if (!searchButton) {
        // Try to find by text content
        const buttons = Array.from(document.querySelectorAll('button, [role="button"]'));
        const foundButton = buttons.find((el) => {
          // Check text content
          const text = el.textContent?.toLowerCase() ?? "";
          if (searchTexts.some((searchText) => text.includes(searchText.toLowerCase()))) return true;

          // Check aria-label
          const ariaLabel = el.getAttribute("aria-label")?.toLowerCase() ?? "";
          if (searchTexts.some((searchText) => ariaLabel.includes(searchText.toLowerCase()))) return true;

          // Check class names
          const className = el.className?.toLowerCase() ?? "";
          if (className.includes("search") || className.includes("submit")) return true;

          // Check other attributes
          const jsaction = el.getAttribute("jsaction")?.toLowerCase() ?? "";
          return jsaction.includes("search");
        });

        if (foundButton) {
          searchButton = foundButton as HTMLElement;
        }
      }

      // If found, try to click it
      if (searchButton) {
        try {
          // Try multiple click methods
          searchButton.click(); // Standard click

          // Also try dispatching events
          const clickEvent = new MouseEvent("click", {
            view: window,
            bubbles: true,
            cancelable: true,
          });
          searchButton.dispatchEvent(clickEvent);

          return {
            success: true,
            method: "JavaScript click",
            buttonText: searchButton.textContent?.trim() ?? "",
            buttonClass: searchButton.className ?? "",
          };
        } catch (e) {
          return { success: false, error: String(e) };
        }
      }

      return { success: false, reason: "No search button found" };
    }, searchTexts);

    log(LOG_LEVEL.INFO, `JavaScript click result: ${JSON.stringify(result)}`);
    return result.success;
  } catch (error) {
    log(LOG_LEVEL.ERROR, `Error in tryJavaScriptClick: ${error}`);
    return false;
  }
}
