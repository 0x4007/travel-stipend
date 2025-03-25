import { ElementHandle, Page } from "puppeteer";
import { LOG_LEVEL } from "./config";
import { log } from "./log";

interface DateInfo {
  day: number;
  month: string;
  year: number;
}

interface MonthYear {
  month: string;
  year: number;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseDateString(dateString: string): DateInfo {
  const dateObj = new Date(dateString);
  return {
    day: dateObj.getDate(),
    month: dateObj.toLocaleString("en-US", { month: "long" }),
    year: dateObj.getFullYear(),
  };
}

const DATE_SELECTORS = [
  '[aria-label*="Departure"]',
  '[placeholder*="Departure"]',
  '[role="button"][aria-label*="Date"]',
  'div[jsname="d3NNxc"]',
  'div[jsname="haAclf"]',
  'div[jscontroller="Pgogge"]',
  'div[role="button"][jsname="gYlYcf"]',
];

const DONE_BUTTON_SELECTORS = [
  'button[jsname="McfNlf"]',
  'button[aria-label*="Done"]',
  'button:has-text("Done")',
  "button.done-button",
  ".gws-flights__calendar-done-button",
  'button[aria-label*="Search for"]',
  "button.VfPpkd-LgbsSe.VfPpkd-LgbsSe-OWXEXe-k8QpJ.VfPpkd-LgbsSe-OWXEXe-dgl2Hf.nCP5yc.AjY5Oe.DuMIQc.LQeN7",
];

async function findElementBySelectors(page: Page, selectors: string[], description: string): Promise<ElementHandle<Element> | null> {
  for (const selector of selectors) {
    try {
      log(LOG_LEVEL.DEBUG, `Trying ${description} selector: ${selector}`);
      const element = await page.$(selector);
      if (element) {
        log(LOG_LEVEL.INFO, `Found ${description} with selector: ${selector}`);
        return element;
      }
    } catch (error) {
      if (error instanceof Error) {
        log(LOG_LEVEL.DEBUG, `Selector ${selector} not found or error: ${error.message}`);
      }
    }
  }
  return null;
}

async function findDateInputFallback(page: Page): Promise<ElementHandle<Element> | null> {
  log(LOG_LEVEL.WARN, "Using fallback method to find date input");
  const elements = await page.$$('[role="button"], [jsname], [jscontroller]');

  if (elements.length >= 3) {
    log(LOG_LEVEL.INFO, "Using third clickable element as date field");
    return elements[2];
  }
  if (elements.length > 0) {
    log(LOG_LEVEL.INFO, "Using first clickable element as date field");
    return elements[0];
  }
  return null;
}

async function findMonthSection(section: ElementHandle<Element>, month: string): Promise<boolean> {
  try {
    const monthName = await section.$eval("div:first-child", (el) => el.textContent?.trim() ?? "");
    log(LOG_LEVEL.DEBUG, `Found month section: ${monthName}`);
    return monthName.includes(month);
  } catch (error) {
    if (error instanceof Error) {
      log(LOG_LEVEL.DEBUG, `Error processing month section: ${error.message}`);
    }
    return false;
  }
}

async function clickDayButton(button: ElementHandle<Element>, day: number): Promise<boolean> {
  try {
    const dayText = await button.$eval("div:first-child", (el) => el.textContent?.trim() ?? "");
    if (dayText === String(day)) {
      log(LOG_LEVEL.INFO, `Found day ${day}, clicking it...`);
      await button.click();
      return true;
    }
  } catch (error) {
    if (error instanceof Error) {
      log(LOG_LEVEL.DEBUG, `Error getting day text: ${error.message}`);
    }
  }
  return false;
}

async function findAndClickDayButton(section: ElementHandle<Element>, day: number): Promise<boolean> {
  const dayButtons = await section.$$('div[role="button"]');
  log(LOG_LEVEL.DEBUG, `Found ${dayButtons.length} day buttons`);

  for (const button of dayButtons) {
    if (await clickDayButton(button, day)) {
      return true;
    }
  }
  return false;
}

async function getCurrentMonthYear(page: Page): Promise<MonthYear | null> {
  try {
    const monthYearText = await page.$eval('div[role="heading"]', (el) => el.textContent?.trim() ?? "");
    const monthYearMatch = /([A-Za-z]{3,9})\s+(\d{4})/.exec(monthYearText);
    if (!monthYearMatch) {
      log(LOG_LEVEL.WARN, `Could not parse month/year from: ${monthYearText}`);
      return null;
    }
    return {
      month: monthYearMatch[1],
      year: parseInt(monthYearMatch[2], 10),
    };
  } catch (error) {
    if (error instanceof Error) {
      log(LOG_LEVEL.ERROR, `Error getting current month/year: ${error.message}`);
    }
    return null;
  }
}

async function clickMonthNavigationButton(button: ElementHandle<Element>): Promise<void> {
  log(LOG_LEVEL.DEBUG, "Clicking month navigation button");
  await button.click();
  await delay(500);
}

function isTargetMonthReached(current: MonthYear, targetMonth: string, targetYear: number): boolean {
  return current.month.includes(targetMonth) && current.year === targetYear;
}

async function navigateMonths(page: Page, button: ElementHandle<Element>, targetMonth: string, targetYear: number, maxAttempts = 24): Promise<void> {
  for (let attempts = 0; attempts < maxAttempts; attempts++) {
    const current = await getCurrentMonthYear(page);
    if (!current) break;

    if (isTargetMonthReached(current, targetMonth, targetYear)) {
      log(LOG_LEVEL.INFO, `Reached target month: ${targetMonth} ${targetYear}`);
      break;
    }

    await clickMonthNavigationButton(button);
  }
}

async function getMonthNavigationButtons(page: Page): Promise<{ prevButton: ElementHandle<Element>; nextButton: ElementHandle<Element> } | null> {
  const prevButton = await page.$('div[aria-label="Previous month"]');
  const nextButton = await page.$('div[aria-label="Next month"]');

  if (!prevButton || !nextButton) {
    log(LOG_LEVEL.WARN, "Could not find month navigation buttons");
    return null;
  }

  return { prevButton, nextButton };
}

async function navigateToMonth(page: Page, targetMonth: string, targetYear: number): Promise<void> {
  log(LOG_LEVEL.INFO, `Navigating to ${targetMonth} ${targetYear} in calendar`);

  try {
    const current = await getCurrentMonthYear(page);
    if (!current) return;

    const buttons = await getMonthNavigationButtons(page);
    if (!buttons) return;

    const currentDate = new Date(`${current.month} 1, ${current.year}`);
    const targetDate = new Date(`${targetMonth} 1, ${targetYear}`);

    if (targetDate > currentDate) {
      await navigateMonths(page, buttons.nextButton, targetMonth, targetYear);
    } else if (targetDate < currentDate) {
      await navigateMonths(page, buttons.prevButton, targetMonth, targetYear);
    } else {
      log(LOG_LEVEL.INFO, `Already at target month: ${targetMonth} ${targetYear}`);
    }
  } catch (error) {
    if (error instanceof Error) {
      log(LOG_LEVEL.ERROR, `Error in navigateToMonth: ${error.message}`);
    }
  }
}

async function selectDateInCalendar(page: Page, day: number, month: string): Promise<boolean> {
  log(LOG_LEVEL.INFO, `Looking for ${month} ${day} in calendar...`);

  try {
    const monthSections = await page.$$('div[role="rowgroup"]');
    log(LOG_LEVEL.DEBUG, `Found ${monthSections.length} month sections`);

    for (const section of monthSections) {
      if (await findMonthSection(section, month)) {
        if (await findAndClickDayButton(section, day)) {
          return true;
        }
      }
    }

    log(LOG_LEVEL.WARN, `Could not find ${month} ${day} in calendar`);
    return false;
  } catch (error) {
    if (error instanceof Error) {
      log(LOG_LEVEL.ERROR, `Error in selectDateInCalendar: ${error.message}`);
    }
    return false;
  }
}

async function handleDateSelection(page: Page, dateInfo: DateInfo): Promise<boolean> {
  const isDateSelected = await selectDateInCalendar(page, dateInfo.day, dateInfo.month);

  if (!isDateSelected) {
    log(LOG_LEVEL.WARN, "Failed to select date with primary method, trying alternative approach");
    await navigateToMonth(page, dateInfo.month, dateInfo.year);
    return await selectDateInCalendar(page, dateInfo.day, dateInfo.month);
  }

  return true;
}

async function clickDoneButton(page: Page): Promise<void> {
  log(LOG_LEVEL.INFO, "Looking for Done button...");

  const doneButton = await findElementBySelectors(page, DONE_BUTTON_SELECTORS, "Done button");

  if (doneButton) {
    try {
      await page.evaluate((el: Element) => {
        if (el instanceof HTMLElement) {
          el.click();
        }
      }, doneButton);
      log(LOG_LEVEL.INFO, "Clicked Done button with JavaScript");
    } catch (error) {
      if (error instanceof Error) {
        log(LOG_LEVEL.ERROR, `Error clicking Done button: ${error.message}`);
      }
    }
  }

  // Alternative approach: Press Enter key
  log(LOG_LEVEL.INFO, "Pressing Enter key as alternative to clicking Done");
  await page.keyboard.press("Enter");
  await delay(2000);
}

async function openCalendar(page: Page): Promise<void> {
  let dateInput = await findElementBySelectors(page, DATE_SELECTORS, "date input");
  if (!dateInput) {
    dateInput = await findDateInputFallback(page);
  }

  if (!dateInput) {
    throw new Error("Could not find date input field");
  }

  await dateInput.click();
  await delay(2000);
}

export async function selectDates(page: Page, departureDate: string, returnDate?: string): Promise<void> {
  if (!page) throw new Error("Page not initialized");

  log(LOG_LEVEL.INFO, "STEP 3: Selecting dates in calendar");

  const departureDateInfo = parseDateString(departureDate);
  log(LOG_LEVEL.INFO, `Selecting departure date: ${departureDateInfo.month} ${departureDateInfo.day}, ${departureDateInfo.year}`);

  let returnDateInfo: DateInfo | undefined;
  if (returnDate) {
    returnDateInfo = parseDateString(returnDate);
    log(LOG_LEVEL.INFO, `Selecting return date: ${returnDateInfo.month} ${returnDateInfo.day}, ${returnDateInfo.year}`);
  }

  await openCalendar(page);

  // Select departure date
  await handleDateSelection(page, departureDateInfo);

  // Select return date if provided
  if (returnDateInfo) {
    await delay(1000);
    await handleDateSelection(page, returnDateInfo);
  }

  await clickDoneButton(page);
}
