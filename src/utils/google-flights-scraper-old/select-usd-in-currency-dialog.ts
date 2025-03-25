import { Page } from "puppeteer";
import { LOG_LEVEL } from "./config";
import { log } from "./log";

// Helper functions to reduce cognitive complexity
async function canSelectUsingPuppeteerSelectors(page: Page): Promise<boolean> {
  log(LOG_LEVEL.INFO, "Approach 1: Using Puppeteer's built-in selectors");

  // Look for elements containing USD text with various selectors
  const usdSelectors = [
    // Radio buttons or list items with USD text
    'input[type="radio"][aria-label*="USD"], input[type="radio"][aria-label*="US Dollar"]',
    'li:has(span:contains("USD")), li:has(span:contains("US Dollar"))',
    // Divs or spans with USD text that might be clickable
    'div[role="option"]:has(text:contains("USD")), div[role="option"]:has(text:contains("US Dollar"))',
    '[role="radio"]:has(text:contains("USD")), [role="radio"]:has(text:contains("US Dollar"))',
  ];

  // Try each selector
  for (const selector of usdSelectors) {
    try {
      const hasElements = await page.$$(selector);
      if (hasElements.length > 0) {
        log(LOG_LEVEL.INFO, `Found ${hasElements.length} USD elements with selector: ${selector}`);
        await hasElements[0].click();
        log(LOG_LEVEL.INFO, "Clicked USD element with Puppeteer selector");

        return true;
      }
    } catch (err) {
      // Continue to next selector
      log(LOG_LEVEL.DEBUG, `Selector ${selector} failed: ${err}`);
    }
  }

  return false;
}

async function canSelectUsingXpath(page: Page): Promise<boolean> {
  log(LOG_LEVEL.INFO, "Approach 3: Using XPath selectors");

  // XPath expressions to find USD elements
  const xpathExpressions = [
    "//div[@role='dialog']//span[contains(text(), 'USD') or contains(text(), 'US Dollar')]",
    "//div[@role='dialog']//*[contains(text(), 'USD') or contains(text(), 'US Dollar')]",
    "//div[@role='dialog']//li[contains(., 'USD') or contains(., 'US Dollar')]",
    "//div[@role='dialog']//*[contains(text(), '$') and contains(text(), 'US')]",
  ];

  for (const xpath of xpathExpressions) {
    try {
      // Use page.evaluate with document.evaluate for XPath instead of page.$x
      const hasFoundElement = await page.evaluate((xpathToEvaluate) => {
        const result = document.evaluate(xpathToEvaluate, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);

        if (result.snapshotLength > 0) {
          // Click the first matching element
          const element = result.snapshotItem(0) as HTMLElement;
          if (element) {
            element.click();
            return true;
          }
        }
        return false;
      }, xpath);

      if (hasFoundElement) {
        log(LOG_LEVEL.INFO, `Found and clicked USD element with XPath: ${xpath}`);

        return true;
      }
    } catch (err) {
      log(LOG_LEVEL.DEBUG, `XPath ${xpath} failed: ${err}`);
    }
  }

  log(LOG_LEVEL.WARN, "Could not find USD elements with XPath");
  return false;
}

export async function selectUsdInCurrencyDialog(page: Page): Promise<boolean> {
  if (!page) {
    log(LOG_LEVEL.ERROR, "Cannot select USD: page is null");
    return false;
  }

  try {
    log(LOG_LEVEL.DEBUG, "Attempting to select USD in currency dialog");

    // Take a screenshot before selection attempt

    // Wait a moment for the dialog to fully render
    await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 1000)));

    // First approach: Try direct selectors
    try {
      const hasSelectedWithSelector = await canSelectUsingPuppeteerSelectors(page);
      if (hasSelectedWithSelector) return true;
    } catch (err) {
      log(LOG_LEVEL.WARN, "Puppeteer selector approach failed:", err);
    }

    // Second approach: Use page.evaluate for DOM manipulation
    log(LOG_LEVEL.INFO, "Approach 2: Using page.evaluate for DOM manipulation");
    const isUsdSelected = await canSelectUsingDomManipulation(page);

    // Take a screenshot after the selection attempt

    if (isUsdSelected) {
      log(LOG_LEVEL.INFO, "Successfully selected USD in currency dialog");

      return true;
    }

    // Third approach: Try XPath as a last resort
    const hasSelectedWithXpath = await canSelectUsingXpath(page);
    return hasSelectedWithXpath;
  } catch (error) {
    log(LOG_LEVEL.ERROR, "Error selecting USD in currency dialog:", error);

    return false;
  }
}

async function canSelectUsingDomManipulation(page: Page): Promise<boolean> {
  return await page.evaluate((): boolean => {
    try {
      // Find the currency dialog
      const dialog = document.querySelector('[role="dialog"], .dialog, [aria-modal="true"]');
      if (!dialog) {
        console.log("No dialog found");
        return false;
      }

      // Helper function to check if an element is visible
      function isVisible(element: Element): boolean {
        const rect = element.getBoundingClientRect();
        return (
          rect.width > 0 && rect.height > 0 && window.getComputedStyle(element).display !== "none" && window.getComputedStyle(element).visibility !== "hidden"
        );
      }

      // Helper function to click an element and its related elements
      function canClickElement(element: Element): boolean {
        try {
          // Click the element itself
          (element as HTMLElement).click();
          console.log("Clicked element:", element.textContent);

          // Also try to click any radio button or checkbox near this element
          const radioOrCheckbox = element.querySelector('input[type="radio"], input[type="checkbox"]');
          if (radioOrCheckbox) {
            (radioOrCheckbox as HTMLElement).click();
            console.log("Clicked radio/checkbox inside element");
          }

          // Try to click parent if it's a list item or option
          const parent = element.parentElement;
          if (parent && (parent.tagName === "LI" || parent.getAttribute("role") === "option" || parent.getAttribute("role") === "radio")) {
            (parent as HTMLElement).click();
            console.log("Clicked parent element:", parent.tagName);
          }

          return true;
        } catch (e) {
          console.error("Error clicking element:", e);
          return false;
        }
      }

      // Try to find and click USD elements
      return canFindAndClickUsdElement(dialog, isVisible, canClickElement);
    } catch (e) {
      console.error("Error in DOM manipulation:", e);
      return false;
    }
  });
}

// Split the function into smaller parts to reduce cognitive complexity
function canFindAndClickUsdElement(dialog: Element, isVisible: (element: Element) => boolean, canClickElement: (element: Element) => boolean): boolean {
  return (
    canFindAndClickByExactText(dialog, isVisible, canClickElement) ||
    canFindAndClickByDollarSymbol(dialog, isVisible, canClickElement) ||
    canFindAndClickByRadioButton(dialog, isVisible, canClickElement)
  );
}

// Helper function to check if text contains USD references
function hasUsdText(text: string | null | undefined): boolean {
  if (!text) return false;

  const trimmedText = text.trim();
  return trimmedText.includes("US Dollar") || trimmedText.includes("USD") || (trimmedText.includes("$") && trimmedText.includes("US"));
}

// Find elements with exact USD text match
function canFindAndClickByExactText(dialog: Element, isVisible: (element: Element) => boolean, canClickElement: (element: Element) => boolean): boolean {
  const allElements = Array.from(dialog.querySelectorAll("*"));

  // Find visible elements with USD text
  const usdElements = allElements.filter((element) => {
    const elementText = element.textContent;
    return hasUsdText(elementText) && isVisible(element);
  });

  // Try to click each matching element
  for (const element of usdElements) {
    console.log("Found USD match:", element.textContent);
    if (canClickElement(element)) return true;
  }

  return false;
}

// Find elements with $ symbol (but not other currency symbols)
function canFindAndClickByDollarSymbol(dialog: Element, isVisible: (element: Element) => boolean, canClickElement: (element: Element) => boolean): boolean {
  const allElements = Array.from(dialog.querySelectorAll("*"));

  for (const element of allElements) {
    const elementText = element.textContent?.trim();
    if (elementText && elementText.includes("$") && !elementText.includes("€") && !elementText.includes("£") && !elementText.includes("¥")) {
      if (isVisible(element)) {
        console.log("Found $ symbol match:", elementText);
        if (canClickElement(element)) return true;
      }
    }
  }

  return false;
}

// Find radio buttons or checkboxes
function canFindAndClickByRadioButton(dialog: Element, isVisible: (element: Element) => boolean, canClickElement: (element: Element) => boolean): boolean {
  const radioButtons = dialog.querySelectorAll('[role="radio"], [type="radio"], [role="option"]');

  for (const radio of radioButtons) {
    const radioText = radio.textContent?.trim();
    if (
      radioText &&
      (radioText.includes("USD") || radioText.includes("US Dollar") || (radioText.includes("$") && !radioText.includes("€") && !radioText.includes("£")))
    ) {
      if (isVisible(radio)) {
        console.log("Found radio button match:", radioText);
        if (canClickElement(radio)) return true;
      }
    }
  }

  console.log("Could not find USD option in dialog");
  return false;
}
