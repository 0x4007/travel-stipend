import * as fs from 'fs';
import * as path from 'path';
import { Browser, Page } from 'puppeteer';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

// Add stealth plugin to avoid detection
puppeteer.use(StealthPlugin());

// Configure logging
const LOG_LEVEL = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};

const CURRENT_LOG_LEVEL = LOG_LEVEL.DEBUG; // Set to DEBUG for maximum logging
const SCREENSHOTS_DIR = path.join(process.cwd(), 'logs', 'screenshots');
const LOGS_DIR = path.join(process.cwd(), 'logs');

// Ensure log directories exist
if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

// Create log file stream
const logFile = fs.createWriteStream(path.join(LOGS_DIR, `google-flights-${new Date().toISOString().replace(/:/g, '-')}.log`));

// Logger function
function log(level: number, message: string, data?: any) {
  if (level >= CURRENT_LOG_LEVEL) {
    const timestamp = new Date().toISOString();
    const levelName = Object.keys(LOG_LEVEL).find(key => LOG_LEVEL[key as keyof typeof LOG_LEVEL] === level) || 'UNKNOWN';
    const logMessage = `[${timestamp}] [${levelName}] ${message}`;

    console.log(logMessage);
    if (data) {
      console.log(data);
    }

    logFile.write(logMessage + '\n');
    if (data) {
      logFile.write(JSON.stringify(data, null, 2) + '\n');
    }
  }
}

// Helper function to take screenshots
async function takeScreenshot(page: Page, name: string) {
  const screenshotPath = path.join(SCREENSHOTS_DIR, `${name}-${new Date().getTime()}.png`);
  log(LOG_LEVEL.DEBUG, `Taking screenshot: ${screenshotPath}`);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  return screenshotPath;
}

// Helper function to log the HTML of an element and its context
async function logElementContext(page: Page, selector: string, contextName: string) {
  try {
    log(LOG_LEVEL.DEBUG, `Getting HTML context for ${contextName} (${selector})`);

    const html = await page.evaluate((sel) => {
      const element = document.querySelector(sel);
      if (!element) return null;

      // Get parent for context
      const parent = element.parentElement?.parentElement;
      return parent ? parent.outerHTML : element.outerHTML;
    }, selector);

    if (html) {
      log(LOG_LEVEL.DEBUG, `HTML context for ${contextName}:`, html);
    } else {
      log(LOG_LEVEL.WARN, `Could not find element for ${contextName} (${selector})`);
    }
  } catch (error) {
    log(LOG_LEVEL.ERROR, `Error getting HTML context for ${contextName}:`, error);
  }
}

// Helper function to wait and log
async function waitForSelector(page: Page, selector: string, description: string, timeout = 30000) {
  log(LOG_LEVEL.DEBUG, `Waiting for ${description} (${selector})`);
  try {
    const element = await page.waitForSelector(selector, { timeout });
    log(LOG_LEVEL.INFO, `Found ${description}`);
    return element;
  } catch (error) {
    log(LOG_LEVEL.ERROR, `Timeout waiting for ${description} (${selector})`, error);
    await takeScreenshot(page, `error-${description.replace(/\s+/g, '-')}`);
    throw error;
  }
}

// Helper function to click with logging
async function clickElement(page: Page, selector: string, description: string) {
  log(LOG_LEVEL.DEBUG, `Attempting to click ${description} (${selector})`);
  try {
    await logElementContext(page, selector, description);
    await page.click(selector);
    log(LOG_LEVEL.INFO, `Clicked ${description}`);
    await takeScreenshot(page, `after-click-${description.replace(/\s+/g, '-')}`);
  } catch (error) {
    log(LOG_LEVEL.ERROR, `Error clicking ${description} (${selector})`, error);
    await takeScreenshot(page, `error-click-${description.replace(/\s+/g, '-')}`);
    throw error;
  }
}

// Helper function to type text with logging
async function typeText(page: Page, selector: string, text: string, description: string) {
  log(LOG_LEVEL.DEBUG, `Attempting to type "${text}" in ${description} (${selector})`);
  try {
    await logElementContext(page, selector, description);
    await page.type(selector, text, { delay: 100 }); // Add delay to mimic human typing
    log(LOG_LEVEL.INFO, `Typed "${text}" in ${description}`);
  } catch (error) {
    log(LOG_LEVEL.ERROR, `Error typing in ${description} (${selector})`, error);
    await takeScreenshot(page, `error-type-${description.replace(/\s+/g, '-')}`);
    throw error;
  }
}

// Helper function to log all form inputs on the page
async function logAllInputs(page: Page) {
  log(LOG_LEVEL.DEBUG, 'Logging all input elements on the page');

  const inputs = await page.evaluate(() => {
    const inputElements = Array.from(document.querySelectorAll('input, textarea, select, button'));
    return inputElements.map(el => {
      const rect = el.getBoundingClientRect();
      return {
        tag: el.tagName,
        type: (el as HTMLInputElement).type || 'N/A',
        id: el.id || 'N/A',
        name: (el as HTMLInputElement).name || 'N/A',
        placeholder: (el as HTMLInputElement).placeholder || 'N/A',
        value: (el as HTMLInputElement).value || 'N/A',
        className: el.className || 'N/A',
        isVisible: rect.width > 0 && rect.height > 0,
        position: {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
        },
        attributes: Array.from(el.attributes).map(attr => ({ name: attr.name, value: attr.value })),
      };
    });
  });

  log(LOG_LEVEL.DEBUG, 'All input elements:', inputs);
}

// Helper function to log all clickable elements
async function logAllClickableElements(page: Page) {
  log(LOG_LEVEL.DEBUG, 'Logging all clickable elements on the page');

  const clickables = await page.evaluate(() => {
    const elements = Array.from(document.querySelectorAll('a, button, [role="button"], [tabindex]:not([tabindex="-1"])'));
    return elements.map(el => {
      const rect = el.getBoundingClientRect();
      return {
        tag: el.tagName,
        text: el.textContent?.trim() || 'N/A',
        id: el.id || 'N/A',
        className: el.className || 'N/A',
        role: el.getAttribute('role') || 'N/A',
        isVisible: rect.width > 0 && rect.height > 0,
        position: {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
        },
        attributes: Array.from(el.attributes).map(attr => ({ name: attr.name, value: attr.value })),
      };
    });
  });

  log(LOG_LEVEL.DEBUG, 'All clickable elements:', clickables);
}

// Main scraper class
export class GoogleFlightsScraper {
  private browser: Browser | null = null;
  private page: Page | null = null;

  constructor() {
    log(LOG_LEVEL.INFO, 'Initializing Google Flights Scraper');
  }

  async initialize() {
    log(LOG_LEVEL.INFO, 'Launching browser');
    this.browser = await puppeteer.launch({
      headless: false, // Set to true for production
      defaultViewport: { width: 1366, height: 768 },
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--window-size=1366,768',
      ],
    });

    log(LOG_LEVEL.INFO, 'Creating new page');
    this.page = await this.browser.newPage();

    // Set user agent
    await this.page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    );

    // Set extra HTTP headers
    await this.page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
    });

    // Enable request interception for logging
    await this.page.setRequestInterception(true);
    this.page.on('request', request => {
      log(LOG_LEVEL.DEBUG, `Request: ${request.method()} ${request.url()}`);
      request.continue();
    });

    // Log responses
    this.page.on('response', response => {
      log(LOG_LEVEL.DEBUG, `Response: ${response.status()} ${response.url()}`);
    });

    // Log console messages from the page
    this.page.on('console', msg => {
      log(LOG_LEVEL.DEBUG, `Console [${msg.type()}]: ${msg.text()}`);
    });

    // Log errors
    this.page.on('error', error => {
      log(LOG_LEVEL.ERROR, 'Page error:', error);
    });

    // Log page errors
    this.page.on('pageerror', error => {
      log(LOG_LEVEL.ERROR, 'Page JavaScript error:', error);
    });

    log(LOG_LEVEL.INFO, 'Browser and page initialized');
  }

  async navigateToGoogleFlights() {
    if (!this.page) throw new Error('Page not initialized');

    log(LOG_LEVEL.INFO, 'Navigating to Google Flights');
    await this.page.goto('https://www.google.com/travel/flights', {
      waitUntil: 'networkidle2',
      timeout: 60000,
    });

    log(LOG_LEVEL.INFO, 'Google Flights loaded');
    await takeScreenshot(this.page, 'google-flights-loaded');

    // Log page title and URL
    const title = await this.page.title();
    const url = this.page.url();
    log(LOG_LEVEL.INFO, `Page loaded: ${title} (${url})`);

    // Log all inputs and clickable elements for debugging
    await logAllInputs(this.page);
    await logAllClickableElements(this.page);
  }

  async searchFlights(from: string, to: string, departureDate: string, returnDate?: string) {
    if (!this.page) throw new Error('Page not initialized');

    log(LOG_LEVEL.INFO, `Searching flights from ${from} to ${to}`);
    log(LOG_LEVEL.INFO, `Departure date: ${departureDate}${returnDate ? `, Return date: ${returnDate}` : ''}`);

    // Take initial screenshot
    await takeScreenshot(this.page, 'before-search');

    try {
      // Wait for the page to be fully loaded
      log(LOG_LEVEL.DEBUG, 'Waiting for page to be fully loaded');
      await this.page.waitForSelector('body', { timeout: 10000 });

      // Log the current state of the page
      log(LOG_LEVEL.DEBUG, 'Current page state before starting search');
      await logAllInputs(this.page);
      await logAllClickableElements(this.page);

      // Try multiple possible selectors for the departure field
      const possibleDepartureSelectors = [
        '[data-placeholder="Where from?"]',
        '[placeholder="Where from?"]',
        '[aria-label="Where from?"]',
        'input[aria-label*="Origin"]',
        '[role="combobox"][aria-label*="Origin"]',
        // Add more potential selectors
      ];

      // Try to find the departure input field
      let departureInput = null;
      for (const selector of possibleDepartureSelectors) {
        log(LOG_LEVEL.DEBUG, `Trying departure selector: ${selector}`);
        try {
          departureInput = await this.page.$(selector);
          if (departureInput) {
            log(LOG_LEVEL.INFO, `Found departure input with selector: ${selector}`);
            break;
          }
        } catch (error) {
          log(LOG_LEVEL.DEBUG, `Selector ${selector} not found`);
        }
      }

      if (!departureInput) {
        log(LOG_LEVEL.ERROR, 'Could not find departure input field');
        await takeScreenshot(this.page, 'error-departure-input-not-found');

        // Try to find any input field and log its details
        const allInputs = await this.page.$$('input');
        log(LOG_LEVEL.DEBUG, `Found ${allInputs.length} input elements`);

        for (let i = 0; i < allInputs.length; i++) {
          const inputDetails = await this.page.evaluate((el) => {
            return {
              id: el.id,
              name: el.name,
              placeholder: el.placeholder,
              type: el.type,
              value: el.value,
              attributes: Array.from(el.attributes).map(attr => ({ name: attr.name, value: attr.value })),
            };
          }, allInputs[i]);

          log(LOG_LEVEL.DEBUG, `Input #${i} details:`, inputDetails);
        }

        throw new Error('Could not find departure input field');
      }

      // Click on the departure field and type the origin
      await departureInput.click();
      log(LOG_LEVEL.INFO, 'Clicked on departure input');
      await takeScreenshot(this.page, 'after-click-departure');

      // Clear the input field if needed
      await this.page.keyboard.down('Control');
      await this.page.keyboard.press('a');
      await this.page.keyboard.up('Control');
      await this.page.keyboard.press('Backspace');

      // Type the origin
      await this.page.keyboard.type(from, { delay: 100 });
      log(LOG_LEVEL.INFO, `Typed origin: ${from}`);
      await takeScreenshot(this.page, 'after-type-origin');

      // Wait for suggestions and select the first one
      await this.page.waitForSelector('[role="listbox"], [role="option"], .suggestions-list', { timeout: 5000 })
        .catch(() => log(LOG_LEVEL.WARN, 'No suggestions dropdown found after typing origin'));

      // Take a screenshot of the suggestions
      await takeScreenshot(this.page, 'origin-suggestions');

      // Press Enter to select the first suggestion
      await this.page.keyboard.press('Enter');
      log(LOG_LEVEL.INFO, 'Pressed Enter to select origin');
      await takeScreenshot(this.page, 'after-select-origin');

      // Wait a moment for the destination field to be ready
      await this.page.evaluate(() => new Promise(resolve => setTimeout(resolve, 1000)));

      // Try multiple possible selectors for the destination field
      const possibleDestinationSelectors = [
        '[data-placeholder="Where to?"]',
        '[placeholder="Where to?"]',
        '[aria-label="Where to?"]',
        'input[aria-label*="Destination"]',
        '[role="combobox"][aria-label*="Destination"]',
        // Add more potential selectors
      ];

      // Try to find the destination input field
      let destinationInput = null;
      for (const selector of possibleDestinationSelectors) {
        log(LOG_LEVEL.DEBUG, `Trying destination selector: ${selector}`);
        try {
          destinationInput = await this.page.$(selector);
          if (destinationInput) {
            log(LOG_LEVEL.INFO, `Found destination input with selector: ${selector}`);
            break;
          }
        } catch (error) {
          log(LOG_LEVEL.DEBUG, `Selector ${selector} not found`);
        }
      }

      if (!destinationInput) {
        log(LOG_LEVEL.ERROR, 'Could not find destination input field');
        await takeScreenshot(this.page, 'error-destination-input-not-found');

        // Log all input fields again
        await logAllInputs(this.page);

        throw new Error('Could not find destination input field');
      }

      // Click on the destination field and type the destination
      await destinationInput.click();
      log(LOG_LEVEL.INFO, 'Clicked on destination input');
      await takeScreenshot(this.page, 'after-click-destination');

      // Clear the input field if needed
      await this.page.keyboard.down('Control');
      await this.page.keyboard.press('a');
      await this.page.keyboard.up('Control');
      await this.page.keyboard.press('Backspace');

      // Type the destination
      await this.page.keyboard.type(to, { delay: 100 });
      log(LOG_LEVEL.INFO, `Typed destination: ${to}`);
      await takeScreenshot(this.page, 'after-type-destination');

      // Wait for suggestions and select the first one
      await this.page.waitForSelector('[role="listbox"], [role="option"], .suggestions-list', { timeout: 5000 })
        .catch(() => log(LOG_LEVEL.WARN, 'No suggestions dropdown found after typing destination'));

      // Take a screenshot of the suggestions
      await takeScreenshot(this.page, 'destination-suggestions');

      // Press Enter to select the first suggestion
      await this.page.keyboard.press('Enter');
      log(LOG_LEVEL.INFO, 'Pressed Enter to select destination');
      await takeScreenshot(this.page, 'after-select-destination');

      // Wait a moment for the date field to be ready
      await this.page.evaluate(() => new Promise(resolve => setTimeout(resolve, 1000)));

      // Try to find and click on the departure date field
      const possibleDateSelectors = [
        '[aria-label*="Departure"]',
        '[placeholder*="Departure"]',
        '[data-placeholder*="Departure"]',
        'input[aria-label*="Date"]',
        '[role="button"][aria-label*="Date"]',
        // Add more potential selectors
      ];

      // Try to find the date input field
      let dateInput = null;
      for (const selector of possibleDateSelectors) {
        log(LOG_LEVEL.DEBUG, `Trying date selector: ${selector}`);
        try {
          dateInput = await this.page.$(selector);
          if (dateInput) {
            log(LOG_LEVEL.INFO, `Found date input with selector: ${selector}`);
            break;
          }
        } catch (error) {
          log(LOG_LEVEL.DEBUG, `Selector ${selector} not found`);
        }
      }

      if (!dateInput) {
        log(LOG_LEVEL.ERROR, 'Could not find date input field');
        await takeScreenshot(this.page, 'error-date-input-not-found');

        // Log all clickable elements
        await logAllClickableElements(this.page);

        throw new Error('Could not find date input field');
      }

      // Click on the date field
      await dateInput.click();
      log(LOG_LEVEL.INFO, 'Clicked on date input');
      await takeScreenshot(this.page, 'after-click-date');

      // Wait for the date picker to appear
      await this.page.waitForSelector('[role="grid"], [role="dialog"], .calendar', { timeout: 5000 })
        .catch(() => log(LOG_LEVEL.WARN, 'No date picker found after clicking date field'));

      // Take a screenshot of the date picker
      await takeScreenshot(this.page, 'date-picker');

      // Parse the departure date
      const [departureYear, departureMonth, departureDay] = departureDate.split('-').map(Number);

      // Try to select the departure date
      log(LOG_LEVEL.INFO, `Attempting to select departure date: ${departureDate}`);

      // Log all date cells in the calendar
      const dateCells = await this.page.$$('[role="gridcell"], [data-day], .calendar-day');
      log(LOG_LEVEL.DEBUG, `Found ${dateCells.length} date cells`);

      // Try to find and click the specific date
      let dateFound = false;
      for (const cell of dateCells) {
        const dateText = await this.page.evaluate(el => {
          return {
            text: el.textContent?.trim(),
            ariaLabel: el.getAttribute('aria-label'),
            dataDay: el.getAttribute('data-day'),
            attributes: Array.from(el.attributes).map(attr => ({ name: attr.name, value: attr.value })),
          };
        }, cell);

        log(LOG_LEVEL.DEBUG, 'Date cell info:', dateText);

        // Check if this cell matches our target date
        if (
          (dateText.text === String(departureDay)) ||
          (dateText.ariaLabel && dateText.ariaLabel.includes(departureDate)) ||
          (dateText.dataDay === departureDate)
        ) {
          log(LOG_LEVEL.INFO, `Found matching date cell for ${departureDate}`);
          await cell.click();
          log(LOG_LEVEL.INFO, `Clicked on departure date: ${departureDate}`);
          dateFound = true;
          break;
        }
      }

      if (!dateFound) {
        log(LOG_LEVEL.WARN, `Could not find exact date cell for ${departureDate}, trying to type date`);

        // Try to type the date directly
        await this.page.keyboard.type(departureDate, { delay: 100 });
        log(LOG_LEVEL.INFO, `Typed departure date: ${departureDate}`);
      }

      await takeScreenshot(this.page, 'after-select-departure-date');

      // If return date is provided, select it
      if (returnDate) {
        // Parse the return date
        const [returnYear, returnMonth, returnDay] = returnDate.split('-').map(Number);

        // Wait a moment
        await this.page.evaluate(() => new Promise(resolve => setTimeout(resolve, 1000)));

        // Try to select the return date
        log(LOG_LEVEL.INFO, `Attempting to select return date: ${returnDate}`);

        // Get updated date cells after selecting departure date
        const returnDateCells = await this.page.$$('[role="gridcell"], [data-day], .calendar-day');

        // Try to find and click the specific return date
        let returnDateFound = false;
        for (const cell of returnDateCells) {
          const dateText = await this.page.evaluate(el => {
            return {
              text: el.textContent?.trim(),
              ariaLabel: el.getAttribute('aria-label'),
              dataDay: el.getAttribute('data-day'),
              attributes: Array.from(el.attributes).map(attr => ({ name: attr.name, value: attr.value })),
            };
          }, cell);

          // Check if this cell matches our target return date
          if (
            (dateText.text === String(returnDay)) ||
            (dateText.ariaLabel && dateText.ariaLabel.includes(returnDate)) ||
            (dateText.dataDay === returnDate)
          ) {
            log(LOG_LEVEL.INFO, `Found matching date cell for return date ${returnDate}`);
            await cell.click();
            log(LOG_LEVEL.INFO, `Clicked on return date: ${returnDate}`);
            returnDateFound = true;
            break;
          }
        }

        if (!returnDateFound) {
          log(LOG_LEVEL.WARN, `Could not find exact date cell for return date ${returnDate}, trying to type date`);

          // Try to type the return date directly
          await this.page.keyboard.type(returnDate, { delay: 100 });
          log(LOG_LEVEL.INFO, `Typed return date: ${returnDate}`);
        }

        await takeScreenshot(this.page, 'after-select-return-date');
      }

      // Try to find and click the search button
      const possibleSearchButtonSelectors = [
        'button[aria-label*="Search"]',
        'button[aria-label*="search"]',
        'button.search-button',
        '[role="button"]:has-text("Search")',
        'button:has-text("Search")',
        // Add more potential selectors
      ];

      // Try to find the search button
      let searchButton = null;
      for (const selector of possibleSearchButtonSelectors) {
        log(LOG_LEVEL.DEBUG, `Trying search button selector: ${selector}`);
        try {
          searchButton = await this.page.$(selector);
          if (searchButton) {
            log(LOG_LEVEL.INFO, `Found search button with selector: ${selector}`);
            break;
          }
        } catch (error) {
          log(LOG_LEVEL.DEBUG, `Selector ${selector} not found`);
        }
      }

      if (!searchButton) {
        log(LOG_LEVEL.ERROR, 'Could not find search button');
        await takeScreenshot(this.page, 'error-search-button-not-found');

        // Log all buttons
        const allButtons = await this.page.$$('button');
        log(LOG_LEVEL.DEBUG, `Found ${allButtons.length} button elements`);

        for (let i = 0; i < allButtons.length; i++) {
          const buttonDetails = await this.page.evaluate((el) => {
            return {
              text: el.textContent?.trim(),
              id: el.id,
              className: el.className,
              attributes: Array.from(el.attributes).map(attr => ({ name: attr.name, value: attr.value })),
            };
          }, allButtons[i]);

          log(LOG_LEVEL.DEBUG, `Button #${i} details:`, buttonDetails);
        }

        // Try to find any element that might be the search button
        const possibleButtons = await this.page.$$('[role="button"]');
        log(LOG_LEVEL.DEBUG, `Found ${possibleButtons.length} elements with role="button"`);

        for (let i = 0; i < possibleButtons.length; i++) {
          const buttonDetails = await this.page.evaluate((el) => {
            return {
              text: el.textContent?.trim(),
              id: el.id,
              className: el.className,
              attributes: Array.from(el.attributes).map(attr => ({ name: attr.name, value: attr.value })),
            };
          }, possibleButtons[i]);

          log(LOG_LEVEL.DEBUG, `Role="button" #${i} details:`, buttonDetails);
        }

        throw new Error('Could not find search button');
      }

      // Click the search button
      await searchButton.click();
      log(LOG_LEVEL.INFO, 'Clicked search button');
      await takeScreenshot(this.page, 'after-click-search');

      // Wait for results to load
      log(LOG_LEVEL.INFO, 'Waiting for search results to load');
      await this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 })
        .catch(() => log(LOG_LEVEL.WARN, 'Navigation timeout waiting for results, continuing anyway'));

      // Take a screenshot of the results
      await takeScreenshot(this.page, 'search-results');

      // Log the current URL
      log(LOG_LEVEL.INFO, `Results page URL: ${this.page.url()}`);

      // Wait for flight results to appear
      const possibleResultsSelectors = [
        '[role="list"]',
        '.flight-results',
        '[aria-label*="results"]',
        // Add more potential selectors
      ];

      // Try to find the results container
      let resultsContainer = null;
      for (const selector of possibleResultsSelectors) {
        log(LOG_LEVEL.DEBUG, `Trying results container selector: ${selector}`);
        try {
          resultsContainer = await this.page.$(selector);
          if (resultsContainer) {
            log(LOG_LEVEL.INFO, `Found results container with selector: ${selector}`);
            break;
          }
        } catch (error) {
          log(LOG_LEVEL.DEBUG, `Selector ${selector} not found`);
        }
      }

      if (!resultsContainer) {
        log(LOG_LEVEL.WARN, 'Could not find specific results container, continuing anyway');
      }

      // Extract flight data
      log(LOG_LEVEL.INFO, 'Extracting flight data');

      // Log the entire page HTML for debugging
      const pageHtml = await this.page.content();
      fs.writeFileSync(path.join(LOGS_DIR, 'results-page.html'), pageHtml);
      log(LOG_LEVEL.DEBUG, 'Saved results page HTML to results-page.html');

      // Try to extract flight information
      const flightData = await this.extractFlightData();
      log(LOG_LEVEL.INFO, 'Extracted flight data:', flightData);

      return flightData;
    } catch (error) {
      log(LOG_LEVEL.ERROR, 'Error during flight search:', error);
      await takeScreenshot(this.page, 'error-during-search');
      throw error;
    }
  }

  async extractFlightData() {
    if (!this.page) throw new Error('Page not initialized');

    log(LOG_LEVEL.INFO, 'Extracting flight data from results page');

    try {
      // Log all possible flight elements
      log(LOG_LEVEL.DEBUG, 'Looking for flight elements');

      // Try various selectors that might contain flight information
      const possibleFlightContainerSelectors = [
        '[role="listitem"]',
        '.flight-result-item',
        '[aria-label*="flight"]',
        // Add more potential selectors
      ];

      // Try to find flight containers
      let flightContainers = [];
      for (const selector of possibleFlightContainerSelectors) {
        log(LOG_LEVEL.DEBUG, `Trying flight container selector: ${selector}`);
        try {
          const containers = await this.page.$$(selector);
          if (containers.length > 0) {
            log(LOG_LEVEL.INFO, `Found ${containers.length} flight containers with selector: ${selector}`);
            flightContainers = containers;
            break;
          }
        } catch (error) {
          log(LOG_LEVEL.DEBUG, `Selector ${selector} not found`);
        }
      }

      if (flightContainers.length === 0) {
        log(LOG_LEVEL.WARN, 'Could not find specific flight containers, trying to extract data from page');
      }

      // Extract flight information from the page
      const flights = await this.page.evaluate(() => {
        // Try to find price elements
        const priceElements = Array.from(document.querySelectorAll('[aria-label*="$"], [aria-label*="USD"], .price, [data-price]'));

        // Try to find airline elements
        const airlineElements = Array.from(document.querySelectorAll('.airline-name, [aria-label*="airline"], [data-airline]'));

        // Try to find duration elements
        const durationElements = Array.from(document.querySelectorAll('.duration, [aria-label*="duration"], [aria-label*="hour"], [data-duration]'));

        // Try to find departure/arrival elements
        const timeElements = Array.from(document.querySelectorAll('.time, [aria-label*="departs"], [aria-label*="arrives"], [data-time]'));

        // Extract text from elements
        const prices = priceElements.map(el => el.textContent?.trim()).filter(Boolean);
        const airlines = airlineElements.map(el => el.textContent?.trim()).filter(Boolean);
        const durations = durationElements.map(el => el.textContent?.trim()).filter(Boolean);
        const times = timeElements.map(el => el.textContent?.trim()).filter(Boolean);

        return {
          prices,
          airlines,
          durations,
          times,
          rawElements: {
            priceCount: priceElements.length,
            airlineCount: airlineElements.length,
            durationCount: durationElements.length,
            timeCount: timeElements.length
          }
        };
      });

      log(LOG_LEVEL.INFO, 'Extracted flight information:', flights);

      return flights;
    } catch (error) {
      log(LOG_LEVEL.ERROR, 'Error extracting flight data:', error);
      return null;
    }
  }

  async close() {
    log(LOG_LEVEL.INFO, 'Closing browser');
    if (this.browser) {
      await this.browser.close();
    }
    log(LOG_LEVEL.INFO, 'Browser closed');
  }
}
