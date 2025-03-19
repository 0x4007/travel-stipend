import * as puppeteer from "puppeteer";
import { findButtonByPosition } from "../find-button-by-position";
import { findButtonBySelectors } from "../find-button-by-selectors";
import { findButtonByTextContent } from "../find-button-by-text-content";
import { clickFoundSearchButton } from "./click-found-search-button";
import { logClickableElements } from "./log-clickable-elements";
import { tryJavaScriptClickApproach } from "./try-java-script-click-approach";

/**
 * Find and click the search button
 */
export async function findAndClickSearchButton(page: puppeteer.Page): Promise<void> {
  console.log("Looking for search button...");

  // Log all clickable elements
  const allElements = await logClickableElements(page);

  // Filter visible elements that might be the search button
  const potentialSearchButtons = allElements.filter(
    (el) =>
      el.isVisible &&
      (el.text?.toLowerCase().includes("search") ||
        el.ariaLabel?.toLowerCase().includes("search") ||
        el.classes?.toLowerCase().includes("search") ||
        el.jsaction?.toLowerCase().includes("search") ||
        // Common button classes in Google Flights
        (el.classes &&
          (el.classes.includes("gws-flights__search-button") ||
            el.classes.includes("gws-flights-form__search-button") ||
            el.classes.includes("VfPpkd-LgbsSe"))))
  );

  console.log(`Found ${potentialSearchButtons.length} potential search buttons:`, potentialSearchButtons);

  // Try multiple selectors for the search button - expanded list
  const searchButtonSelectors = [
    // Specific Google Flights selectors
    'button[jsname="vLv7Lb"]',
    'button[jsname="c6xFrd"]',
    'button[jscontroller="soHxf"]',
    "button.gws-flights__search-button",
    "button.gws-flights-form__search-button",
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
    // Fallback to any button-like element containing "search"
    'a:has-text("Search")',
    '[tabindex="0"]:has-text("Search")',
  ];

  // Try to find the search button using selectors
  const { button: searchButton } = await findButtonBySelectors(page, searchButtonSelectors);

  // If still not found, try to find by text content or position
  let finalSearchButton = searchButton;
  if (!finalSearchButton) {
    console.log("Could not find search button with specific selectors, trying alternative approaches...");

    // Approach 1: Try to find by text content
    console.log("Approach 1: Finding by text content...");
    finalSearchButton = await findButtonByTextContent(page);

    // Approach 2: Try to find by position (often search button is at bottom right)
    if (!finalSearchButton) {
      console.log("Approach 2: Finding by position (bottom right)...");
      finalSearchButton = await findButtonByPosition(page);
    }
  }

  // If still not found, try to use JavaScript to find and click the button
  if (!finalSearchButton) {
    await tryJavaScriptClickApproach(page);
  } else {
    await clickFoundSearchButton(page, finalSearchButton);
  }
}
