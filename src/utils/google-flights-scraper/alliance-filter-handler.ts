import { ElementHandle, Page } from "puppeteer";
import { LOG_LEVEL } from "./config";
import { log } from "./log";

type ElementHandleOrNull = ElementHandle<Element> | null;

// Known selectors for the Airlines filter button
const AIRLINES_FILTER_SELECTORS = [
  'div[jscontroller="aDULAf"][data-chiptype="1"][data-filtertype="6"] button',
  'button[aria-label="Airlines, Not selected"]',
  'button span.m1GHmf:contains("Airlines")',
  'button:contains("Airlines")',
  '[role="button"]:contains("Airlines")',
  ".wpMGDb.Vz4hIc.cwYgqc button",
  ".VfPpkd-LgbsSe.VfPpkd-LgbsSe-OWXEXe-INsAgc",
];

const ALLIANCE_NAMES = ["Oneworld", "SkyTeam", "Star Alliance"];

interface FilterResult {
  success: boolean;
  checkboxesChecked: number;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const MAX_RETRIES = 5;  // Increased from 3
const INITIAL_RETRY_DELAY = 1500;  // Decreased from 2000 to be more responsive
const MAX_RETRY_DELAY = 8000;

export async function applyAllianceFilters(page: Page): Promise<boolean> {
  if (!page) throw new Error("Page not initialized");

  log(LOG_LEVEL.INFO, "Attempting to apply alliance filters");

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        const delay = Math.min(
          INITIAL_RETRY_DELAY * Math.pow(1.5, attempt - 1),
          MAX_RETRY_DELAY
        );
        log(LOG_LEVEL.INFO, `Retry attempt ${attempt + 1}, waiting ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));

        // If we failed verification before, try refreshing the page
        if (attempt > 1) {
          await page.reload();
          await delay(2000); // Wait for page load
        }
      }

      const initialUrl = page.url();
      const result = await runFilterProcess(page);

      if (result.success) {
        // Check if URL changed after filter application
        const currentUrl = page.url();
        if (currentUrl !== initialUrl) {
          log(LOG_LEVEL.INFO, "URL changed after filter application, waiting for stabilization");
          await delay(2000);
        }

        // Verify filters were actually applied
        const verified = await verifyFiltersApplied(page);
        if (verified) {
          log(LOG_LEVEL.INFO, "Alliance filters successfully applied and verified");
          return true;
        }
        log(LOG_LEVEL.WARN, "Filter application could not be verified, retrying...");
        lastError = new Error("Filter verification failed");
        continue;
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      log(LOG_LEVEL.ERROR, `Error applying alliance filters (attempt ${attempt + 1}):`, lastError.message);

      if (attempt === MAX_RETRIES - 1) {
        log(LOG_LEVEL.WARN, `Max retries reached, last error: ${lastError.message}`);
        return false;
      }
    }
  }
  return false;
}

async function runFilterProcess(page: Page): Promise<FilterResult> {
  // Step 1: Click the Airlines filter button
  const isAirlinesButtonFound = await clickAirlinesFilterButton(page);

  if (!isAirlinesButtonFound) {
    log(LOG_LEVEL.WARN, "Airlines filter button not found, skipping alliance filtering");
    return { success: false, checkboxesChecked: 0 };
  }

  // Wait for filter panel to appear
  await delay(2000);

  // Step 2: Wait for alliance options
  const hasAllianceOptions = await waitForAllianceOptions(page);

  if (!hasAllianceOptions) {
    log(LOG_LEVEL.WARN, "No alliance options found, skipping alliance filtering");
    return { success: false, checkboxesChecked: 0 };
  }

  // Step 3: Check all alliance checkboxes
  const checkboxesChecked = await checkAllAllianceCheckboxes(page);

  // Step 4: Wait for results if needed
  if (checkboxesChecked > 0) {
    await waitForResultsUpdate(page);
    log(LOG_LEVEL.INFO, "Successfully applied alliance filters");
  } else {
    log(LOG_LEVEL.INFO, "No checkboxes were checked (they might already be checked)");
  }

  return { success: true, checkboxesChecked };
}

async function findButtonByContains(page: Page, selector: string): Promise<ElementHandleOrNull> {
  const containsMatch = RegExp(/:contains\("([^"]+)"\)/).exec(selector);
  if (!containsMatch) return null;

  const buttonText = containsMatch[1];

  // Wait for any button containing the text
  try {
    await page.waitForFunction(
      (text) => {
        const buttons = Array.from(document.querySelectorAll<HTMLElement>('button, [role="button"]'));
        return buttons.some(element => element.textContent?.includes(text));
      },
      { timeout: 5000 },
      buttonText
    );
  } catch (error) {
    log(LOG_LEVEL.DEBUG, `No button found containing text "${buttonText}" after waiting`);
    return null;
  }

  const button = await page.evaluateHandle((text: string): Element | null => {
    const buttons = Array.from(document.querySelectorAll<HTMLElement>('button, [role="button"]'));
    return buttons.find((element) => element.textContent?.includes(text)) ?? null;
  }, buttonText);

  const isNull = await page.evaluate((element: Element | null) => element === null, button);
  if (!isNull) {
    log(LOG_LEVEL.INFO, `Found Airlines filter button with text: ${buttonText}`);
    return button as ElementHandle<Element>;
  }
  return null;
}

async function findButtonByDirectSelector(page: Page, selector: string): Promise<ElementHandleOrNull> {
  const button = await page.$(selector);
  if (button) {
    log(LOG_LEVEL.INFO, `Found Airlines filter button with selector: ${selector}`);
    return button;
  }
  return null;
}

async function findButtonBySelector(page: Page): Promise<ElementHandleOrNull> {
  for (const selector of AIRLINES_FILTER_SELECTORS) {
    try {
      const button = selector.includes(":contains") ? await findButtonByContains(page, selector) : await findButtonByDirectSelector(page, selector);

      if (button) return button;
    } catch (error) {
      if (error instanceof Error) {
        log(LOG_LEVEL.DEBUG, `Selector ${selector} not found or error: ${error.message}`);
      }
    }
  }
  return null;
}

async function findButtonByText(page: Page): Promise<ElementHandleOrNull> {
  try {
    const buttons = await page.$$('button, [role="button"]');
    for (const button of buttons) {
      const textContent = await button.evaluate((element: Element) => element.textContent?.toLowerCase() ?? "");
      const ariaLabel = await button.evaluate((element: Element) => element.getAttribute("aria-label")?.toLowerCase() ?? "");

      if (textContent.includes("airline") || ariaLabel.includes("airline")) {
        log(LOG_LEVEL.INFO, `Found Airlines filter button by text content: ${textContent}`);
        return button;
      }
    }
  } catch (error) {
    if (error instanceof Error) {
      log(LOG_LEVEL.ERROR, `Error finding button by text content: ${error.message}`);
    }
  }
  return null;
}

async function clickButton(button: ElementHandle<Element>, page: Page): Promise<boolean> {
  try {
    await button.click({ delay: 100 });
    log(LOG_LEVEL.INFO, "Clicked Airlines filter button with standard click");
    await delay(1000);
    return true;
  } catch (error) {
    if (error instanceof Error) {
      log(LOG_LEVEL.WARN, `Standard click failed: ${error.message}`);
    }
    return await fallbackJavaScriptClick(button, page);
  }
}

async function fallbackJavaScriptClick(button: ElementHandle<Element>, page: Page): Promise<boolean> {
  try {
    await page.evaluate((element: Element) => {
      if (element instanceof HTMLElement) {
        element.click();
        element.dispatchEvent(
          new MouseEvent("click", {
            view: window,
            bubbles: true,
            cancelable: true,
          })
        );
      }
    }, button);
    log(LOG_LEVEL.INFO, "Clicked Airlines filter button with JavaScript");
    await delay(1000);
    return true;
  } catch (error) {
    if (error instanceof Error) {
      log(LOG_LEVEL.ERROR, `JavaScript click failed: ${error.message}`);
    }
    return false;
  }
}

async function clickAirlinesFilterButton(page: Page): Promise<boolean> {
  log(LOG_LEVEL.INFO, "Clicking Airlines filter button");

  const button = (await findButtonBySelector(page)) || (await findButtonByText(page));

  if (!button) {
    log(LOG_LEVEL.WARN, "Could not find Airlines filter button");
    return false;
  }

  return await clickButton(button, page);
}

interface AllianceElements {
  hasHeader: boolean;
  hasAllianceNames: boolean;
  hasCheckboxes: boolean;
}

async function findAllianceElements(page: Page): Promise<boolean> {
  const elements = await page.evaluate((): AllianceElements => {
    const elements = Array.from(document.querySelectorAll("div, span, h3, h4, label"));
    const allianceNames = ["Oneworld", "SkyTeam", "Star Alliance"];

    return {
      hasHeader: elements.some((el) => el.textContent?.includes("Alliances") && el.textContent?.trim() === "Alliances"),
      hasAllianceNames: allianceNames.some((name) => elements.some((el) => el.textContent?.includes(name))),
      hasCheckboxes: document.querySelectorAll('input[type="checkbox"]').length > 0,
    };
  });

  return elements.hasHeader || elements.hasAllianceNames || elements.hasCheckboxes;
}

async function checkForCheckboxes(page: Page): Promise<boolean> {
  const checkboxes = await page.$$('input[type="checkbox"]');
  if (checkboxes.length > 0) {
    log(LOG_LEVEL.INFO, `Found ${checkboxes.length} checkboxes, assuming alliance options are visible`);
    return true;
  }
  return false;
}

async function waitForAllianceOptions(page: Page): Promise<boolean> {
  log(LOG_LEVEL.INFO, "Waiting for alliance options to appear");

  try {
    if (await findAllianceElements(page)) {
      log(LOG_LEVEL.INFO, "Found alliance options using JavaScript");
      return true;
    }

    log(LOG_LEVEL.WARN, "Could not find alliance options with JavaScript, waiting additional time");
    await delay(3000);

    return await checkForCheckboxes(page);
  } catch (error) {
    if (error instanceof Error) {
      log(LOG_LEVEL.ERROR, "Error waiting for alliance options:", error.message);
    }
    return false;
  }
}

async function checkAllianceSpecificCheckboxes(page: Page): Promise<number> {
  return await page.evaluate((allianceNames: string[]) => {
    // Define the findCheckboxForLabel function inside the evaluate context
    function findCheckboxForLabel(label: HTMLLabelElement): HTMLInputElement | null {
      const forId = label.getAttribute("for");
      if (forId) {
        const checkbox = document.getElementById(forId) as HTMLInputElement | null;
        if (checkbox?.type === "checkbox") return checkbox;
      }
      return label.querySelector('input[type="checkbox"]');
    }

    const labels = Array.from(document.querySelectorAll<HTMLLabelElement>("label"));
    let count = 0;

    labels.forEach((label) => {
      if (allianceNames.some((alliance) => label.textContent?.includes(alliance))) {
        const checkbox = findCheckboxForLabel(label);
        if (checkbox && !checkbox.checked) {
          checkbox.click();
          count++;
        }
      }
    });

    return count;
  }, ALLIANCE_NAMES);
}

async function checkRemainingCheckboxes(page: Page): Promise<number> {
  return await page.evaluate(() => {
    let count = 0;
    document.querySelectorAll<HTMLInputElement>('input[type="checkbox"]').forEach((checkbox) => {
      if (!checkbox.checked) {
        checkbox.click();
        count++;
      }
    });
    return count;
  });
}

async function checkAllAllianceCheckboxes(page: Page): Promise<number> {
  log(LOG_LEVEL.INFO, "Checking all alliance checkboxes");

  try {
    // Wait for alliance section to be fully loaded
    await page.waitForFunction(
      () => {
        const elements = Array.from(document.querySelectorAll("div, span, h3, h4, label"));
        return elements.some(el => el.textContent?.includes("Alliances"));
      },
      { timeout: 5000 }
    );

    // First try alliance-specific checkboxes
    let checkboxCount = await checkAllianceSpecificCheckboxes(page);

    // If no alliance checkboxes found, check all checkboxes
    if (checkboxCount === 0) {
      checkboxCount = await checkRemainingCheckboxes(page);
    }

    if (checkboxCount > 0) {
      log(LOG_LEVEL.INFO, `Checked ${checkboxCount} checkboxes with JavaScript approach`);
      // Increased delay to ensure changes are registered
      await delay(2000);
    } else {
      log(LOG_LEVEL.INFO, "No checkboxes were checked (they might already be checked)");
    }

    return checkboxCount;
  } catch (error) {
    if (error instanceof Error) {
      log(LOG_LEVEL.ERROR, "Error checking alliance checkboxes:", error.message);
    }
    return 0;
  }
}

async function waitForResultsUpdate(page: Page): Promise<void> {
  log(LOG_LEVEL.INFO, "Waiting for results to update after applying filters");

  try {
    // Wait for any loading indicators to appear and disappear
    const loadingSelector = '[role="progressbar"], .gws-flights-results__progress-bar';

    // Wait up to 2 seconds for loading indicator to appear
    try {
      await page.waitForSelector(loadingSelector, { timeout: 2000 });
      log(LOG_LEVEL.INFO, "Detected loading indicator");
    } catch {
      log(LOG_LEVEL.INFO, "No loading indicator detected");
    }

    // Wait for loading indicator to disappear if it appeared
    try {
      await page.waitForSelector(loadingSelector, { hidden: true, timeout: 10000 });
      log(LOG_LEVEL.INFO, "Loading completed");
    } catch {
      log(LOG_LEVEL.WARN, "Loading indicator did not disappear");
    }

    // Additional delay to ensure results are fully rendered
    await delay(2000);

    log(LOG_LEVEL.INFO, "Results should be updated now");
  } catch (error) {
    if (error instanceof Error) {
      log(LOG_LEVEL.ERROR, "Error waiting for results update:", error.message);
      log(LOG_LEVEL.WARN, "Continuing search despite error waiting for results update");
    }
  }
}

async function verifyFiltersApplied(page: Page): Promise<boolean> {
  try {
    // First check: URL contains alliance parameters
    const url = page.url();
    const hasAllianceParams = url.includes("ONEWORLD") || url.includes("SKYTEAM") || url.includes("STAR_ALLIANCE");

    if (hasAllianceParams) {
      log(LOG_LEVEL.INFO, "Verified alliance filters in URL");
      return true;
    }

    // Second check: Deep UI element inspection
    const uiState = await page.evaluate(() => {
      const results: { [key: string]: boolean } = {
        hasCheckedBoxes: false,
        hasActiveFilters: false,
        hasAllianceText: false,
        hasDataAttributes: false,
        hasAllianceLabels: false
      };

      // Check for checked checkboxes (expanded selector)
      const checkboxes = Array.from(document.querySelectorAll<HTMLInputElement>(
        'input[type="checkbox"], [role="checkbox"], [aria-checked="true"]'
      ));
      results.hasCheckedBoxes = checkboxes.some(checkbox =>
        checkbox.checked ||
        checkbox.getAttribute('aria-checked') === 'true'
      );

      // Check for active filter indicators (expanded)
      const activeFilters = document.querySelectorAll(
        '[aria-selected="true"], .active-filter, .selected-filter, ' +
        '[data-selected="true"], [data-active="true"], ' +
        '[aria-pressed="true"], .VfPpkd-LgbsSe-OWXEXe-INsAgc'
      );
      results.hasActiveFilters = activeFilters.length > 0;

      // Check for alliance names in active elements
      const allianceKeywords = ['Oneworld', 'SkyTeam', 'Star Alliance', 'ONEWORLD', 'SKYTEAM', 'STAR ALLIANCE'];
      const allText = document.body.textContent || '';
      results.hasAllianceText = allianceKeywords.some(keyword => allText.includes(keyword));

      // Check for alliance-related data attributes
      results.hasDataAttributes = Array.from(document.querySelectorAll('[data-filtertype="6"]')).length > 0;

      // Check for alliance labels
      results.hasAllianceLabels = Array.from(document.querySelectorAll('label, span, div')).some(el =>
        allianceKeywords.some(keyword => el.textContent?.includes(keyword))
      );

      return results;
    });

    log(LOG_LEVEL.INFO, "UI State:", JSON.stringify(uiState));

    // If we see positive indicators in the UI, consider it verified
    if (uiState.hasCheckedBoxes || uiState.hasActiveFilters || uiState.hasDataAttributes || uiState.hasAllianceLabels) {
      log(LOG_LEVEL.INFO, "Verified alliance filters through UI state");
      return true;
    }

    // Try reopening the filter panel and checking again
    if (uiState.hasAllianceText) {
      log(LOG_LEVEL.INFO, "Found alliance text, attempting to refresh filters");
      await clickAirlinesFilterButton(page);
      await delay(2000);
      await clickAirlinesFilterButton(page); // Close it again
      await delay(1000);

      // Re-check URL
      const updatedUrl = page.url();
      if (updatedUrl.includes("ONEWORLD") || updatedUrl.includes("SKYTEAM") || updatedUrl.includes("STAR_ALLIANCE")) {
        log(LOG_LEVEL.INFO, "Successfully verified filters after refresh");
        return true;
      }
    }

    // If still not verified, try force-applying filters again
    if (!await applyAllianceFilters(page)) {
      log(LOG_LEVEL.WARN, "Could not verify or reapply filters");
      return false;
    }

    // Final verification after reapplying
    const finalUrl = page.url();
    return finalUrl.includes("ONEWORLD") || finalUrl.includes("SKYTEAM") || finalUrl.includes("STAR_ALLIANCE");
  } catch (error) {
    if (error instanceof Error) {
      log(LOG_LEVEL.ERROR, "Error verifying filters:", error.message);
    }
    return false;
  }
}
