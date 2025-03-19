import * as puppeteer from 'puppeteer';

async function main() {
  console.log('Starting Google Flights date selection test...');

  // Launch browser in headful mode
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: { width: 1366, height: 768 },
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--window-size=1366,768',
    ],
  });

  try {
    // Create a new page
    const page = await browser.newPage();

    // Set user agent
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    );

    // Navigate to Google Flights
    console.log('Navigating to Google Flights...');
    await page.goto('https://www.google.com/travel/flights', {
      waitUntil: 'networkidle2',
      timeout: 60000,
    });
    console.log('Google Flights loaded');

    // Wait for the page to be fully loaded
    await page.waitForSelector('body', { timeout: 10000 });

    // Find and click on the destination input field
    console.log('Looking for destination input field...');
    const destinationInput = await page.waitForSelector('input[placeholder="Where to?"], input[aria-label="Where to? "]', {
      visible: true,
      timeout: 10000
    });

    if (!destinationInput) {
      throw new Error('Could not find destination input field');
    }

    console.log('Found destination input field, clicking on it...');
    await destinationInput.click();

    // Type "Tokyo" in the destination field
    console.log('Typing "Tokyo" in destination field...');
    await page.keyboard.type('Tokyo', { delay: 100 });

    // Wait for dropdown to appear
    console.log('Waiting for dropdown to appear...');
    await page.waitForSelector('ul[role="listbox"]', { timeout: 5000 });

    // Select the first item in the dropdown
    console.log('Selecting first dropdown item...');
    const firstItem = await page.waitForSelector('li[role="option"]:first-child', { timeout: 5000 });

    if (firstItem) {
      await firstItem.click();
      console.log('Selected first dropdown item');
    } else {
      console.log('Could not find first dropdown item, trying to press Enter instead');
      await page.keyboard.press('Enter');
    }

    // Wait for the date field to be ready
    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 1000)));

    // Calculate dates
    const today = new Date();

    // Departure date: one week from today
    const departureDate = new Date(today);
    departureDate.setDate(today.getDate() + 7);
    const departureDayOfMonth = departureDate.getDate();
    const departureMonth = departureDate.toLocaleString('en-US', { month: 'long' });

    // Return date: two weeks from today
    const returnDate = new Date(today);
    returnDate.setDate(today.getDate() + 14);
    const returnDayOfMonth = returnDate.getDate();
    const returnMonth = returnDate.toLocaleString('en-US', { month: 'long' });

    console.log(`Selecting departure date: ${departureMonth} ${departureDayOfMonth}, ${departureDate.getFullYear()}`);
    console.log(`Selecting return date: ${returnMonth} ${returnDayOfMonth}, ${returnDate.getFullYear()}`);

    // Find and click on the date field to open the calendar
    console.log('Looking for date input field...');
    const dateInput = await page.waitForSelector('[aria-label*="Departure"], [placeholder*="Departure"], [role="button"][aria-label*="Date"]', {
      visible: true,
      timeout: 10000
    });

    if (!dateInput) {
      throw new Error('Could not find date input field');
    }

    console.log('Found date input field, clicking on it...');
    await dateInput.click();

    // Wait for the calendar to appear
    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 1000)));

    // Function to find and click a specific date in the calendar
    async function selectDateInCalendar(day: number, month: string) {
      console.log(`Looking for ${month} ${day} in calendar...`);

      // First, find the month section
      const monthSections = await page.$$('div[role="rowgroup"]');

      for (const section of monthSections) {
        const monthName = await section.$eval('div:first-child', el => el?.textContent);

        if (monthName && monthName.includes(month)) {
          console.log(`Found ${month} section`);

          // Find the day button within this month section
          const dayButtons = await section.$$('div[role="button"]');

          for (const button of dayButtons) {
            const dayText = await button.$eval('div:first-child', el => el?.textContent);

            if (dayText === String(day)) {
              console.log(`Found day ${day}, clicking it...`);
              await button.click();
              return true;
            }
          }
        }
      }

      console.log(`Could not find ${month} ${day} in calendar`);
      return false;
    }

    // Select departure date
    const isDepartureDateSelected = await selectDateInCalendar(departureDayOfMonth, departureMonth);

    if (!isDepartureDateSelected) {
      console.log('Failed to select departure date, trying alternative approach');
      // Try an alternative approach if needed
    }

    // Wait a moment before selecting return date
    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 1000)));

    // Select return date
    const isReturnDateSelected = await selectDateInCalendar(returnDayOfMonth, returnMonth);

    if (!isReturnDateSelected) {
      console.log('Failed to select return date, trying alternative approach');
      // Try an alternative approach if needed
    }

    // Wait a moment after date selection
    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 1000)));

    // Find and click the "Done" button in the date picker
    console.log('Looking for Done button...');
    const doneButtonSelectors = [
      'button[jsname="McfNlf"]',
      'button[aria-label*="Done"]',
      'button:has-text("Done")',
      'button.done-button',
      '.gws-flights__calendar-done-button',
      // More specific selectors based on the visible elements
      'button[aria-label="Done. Search for round trip flights departing on March 26 2025 and returning on April 2 2025"]',
      'button.VfPpkd-LgbsSe.VfPpkd-LgbsSe-OWXEXe-k8QpJ.VfPpkd-LgbsSe-OWXEXe-dgl2Hf.nCP5yc.AjY5Oe.DuMIQc.LQeN7'
    ];

    // Try to find the Done button
    let doneButton = null;
    let doneButtonSelector = '';
    for (const selector of doneButtonSelectors) {
      console.log(`Trying Done button selector: ${selector}`);
      try {
        const elements = await page.$$(selector);
        console.log(`Found ${elements.length} elements with selector: ${selector}`);

        if (elements.length > 0) {
          // Check if any of the elements are visible
          for (const element of elements) {
            const isVisible = await page.evaluate(el => {
              const rect = el.getBoundingClientRect();
              const style = window.getComputedStyle(el);
              return rect.width > 0 &&
                     rect.height > 0 &&
                     style.visibility !== 'hidden' &&
                     style.display !== 'none' &&
                     style.opacity !== '0';
            }, element);

            if (isVisible) {
              doneButton = element;
              doneButtonSelector = selector;
              console.log(`Found visible Done button with selector: ${selector}`);
              break;
            }
          }

          if (doneButton) break;
        }
      } catch (error) {
        console.log(`Error with selector ${selector}:`, error.message);
      }
    }

    if (doneButton) {
      console.log(`Found Done button with selector: ${doneButtonSelector}, attempting to click it...`);

      try {
        // Take a screenshot before clicking
        await page.screenshot({ path: `./logs/screenshots/before-done-button-click-${Date.now()}.png` });

        // Try multiple approaches to click the button

        // Approach 1: Standard Puppeteer click
        try {
          console.log('Trying standard Puppeteer click...');
          await doneButton.click({ delay: 100 }).catch(e => {
            console.log('Standard click failed:', e.message);
            throw e; // Re-throw to try other methods
          });
          console.log('Standard click succeeded');
        } catch (clickError) {
          console.log('Standard click failed, trying alternative methods...');

          // Approach 2: JavaScript click
          try {
            console.log('Trying JavaScript click...');
            await page.evaluate(element => {
              element.click();
            }, doneButton);
            console.log('JavaScript click succeeded');
          } catch (jsClickError) {
            console.log('JavaScript click failed:', jsClickError.message);

            // Approach 3: Click by coordinates
            try {
              console.log('Trying click by coordinates...');
              const boundingBox = await doneButton.boundingBox();
              if (boundingBox) {
                await page.mouse.click(
                  boundingBox.x + boundingBox.width / 2,
                  boundingBox.y + boundingBox.height / 2
                );
                console.log('Click by coordinates succeeded');
              } else {
                console.log('Could not get bounding box for element');
              }
            } catch (coordClickError) {
              console.log('Click by coordinates failed:', coordClickError.message);
            }
          }
        }

        // Take a screenshot after clicking
        await page.screenshot({ path: `./logs/screenshots/after-done-button-click-${Date.now()}.png` });

        // Wait a moment after clicking Done button
        await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 1000)));

      } catch (error) {
        console.log('All click attempts failed:', error.message);
        console.log('Continuing without clicking Done button...');
      }
    } else {
      console.log('Could not find Done button, continuing anyway...');

      // Alternative approach: Press Enter key
      console.log('Trying to press Enter key as alternative to clicking Done...');
      await page.keyboard.press('Enter');
      await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 1000)));
    }

    // Find and click the search button - enhanced approach
    console.log('Looking for search button...');

    // Log all buttons and clickable elements on the page to help with debugging
    console.log('Logging all buttons and clickable elements on the page...');
    const allElements = await page.$$eval('button, [role="button"], a, [tabindex="0"]', elements => {
      return elements.map(element => ({
        tag: element.tagName,
        text: element.textContent?.trim() || '',
        ariaLabel: element.getAttribute('aria-label') || '',
        classes: element.className,
        id: element.id || '',
        role: element.getAttribute('role') || '',
        jsname: element.getAttribute('jsname') || '',
        jscontroller: element.getAttribute('jscontroller') || '',
        jsaction: element.getAttribute('jsaction') || '',
        isVisible: !!(element.offsetWidth || element.offsetHeight || element.getClientRects().length),
        rect: element.getBoundingClientRect ? {
          top: element.getBoundingClientRect().top,
          left: element.getBoundingClientRect().left,
          width: element.getBoundingClientRect().width,
          height: element.getBoundingClientRect().height
        } : {}
      }));
    });
    console.log(`Found ${allElements.length} potential clickable elements:`, allElements);

    // Filter visible elements that might be the search button
    const potentialSearchButtons = allElements.filter(el =>
      el.isVisible && (
        (el.text && el.text.toLowerCase().includes('search')) ||
        (el.ariaLabel && el.ariaLabel.toLowerCase().includes('search')) ||
        (el.classes && el.classes.toLowerCase().includes('search')) ||
        (el.jsaction && el.jsaction.toLowerCase().includes('search')) ||
        // Common button classes in Google Flights
        (el.classes && (
          el.classes.includes('gws-flights__search-button') ||
          el.classes.includes('gws-flights-form__search-button') ||
          el.classes.includes('VfPpkd-LgbsSe')
        ))
      )
    );

    console.log(`Found ${potentialSearchButtons.length} potential search buttons:`, potentialSearchButtons);

    // Try multiple selectors for the search button - expanded list
    const searchButtonSelectors = [
      // Specific Google Flights selectors
      'button[jsname="vLv7Lb"]',
      'button[jsname="c6xFrd"]',
      'button[jscontroller="soHxf"]',
      'button.gws-flights__search-button',
      'button.gws-flights-form__search-button',
      // Generic search button selectors
      'button[aria-label*="Search"]',
      'button[aria-label*="search"]',
      'button:has-text("Search")',
      'button.search-button',
      // Material design button selectors
      'button.VfPpkd-LgbsSe',
      // Role-based selectors
      '[role="button"][aria-label*="Search"]',
      '[role="button"][aria-label*="search"]',
      '[role="button"]:has-text("Search")',
      // Any element with search-related attributes
      '[jsaction*="search"]',
      '[data-flt-ve="search_button"]',
      // Fallback to any button-like element containing "search"
      'a:has-text("Search")',
      '[tabindex="0"]:has-text("Search")'
    ];

    let searchButton = null;
    for (const selector of searchButtonSelectors) {
      console.log(`Trying search button selector: ${selector}`);
      try {
        const elements = await page.$$(selector);
        console.log(`Found ${elements.length} elements with selector: ${selector}`);

        if (elements.length > 0) {
          // Prefer visible elements
          for (const element of elements) {
            const isVisible = await page.evaluate(el => {
              const rect = el.getBoundingClientRect();
              return rect.width > 0 && rect.height > 0 &&
                     window.getComputedStyle(el).visibility !== 'hidden' &&
                     window.getComputedStyle(el).display !== 'none';
            }, element);

            if (isVisible) {
              searchButton = element;
              console.log(`Found visible search button with selector: ${selector}`);
              break;
            }
          }

          if (searchButton) break;

          // If no visible element found, use the first one
          searchButton = elements[0];
          console.log(`Using first element with selector: ${selector} (may not be visible)`);
          break;
        }
      } catch (error) {
        console.log(`Error with selector ${selector}:`, error.message);
      }
    }

    // If still not found, try to find by text content or position
    if (!searchButton) {
      console.log('Could not find search button with specific selectors, trying alternative approaches...');

      // Approach 1: Try to find by text content
      console.log('Approach 1: Finding by text content...');
      try {
        const buttonWithSearchText = await page.$$eval('button, [role="button"]', buttons => {
          const searchButton = buttons.find(button => {
            const text = button.textContent?.toLowerCase() || '';
            const isVisible = !!(button.offsetWidth || button.offsetHeight || button.getClientRects().length);
            return text.includes('search') && isVisible;
          });

          if (searchButton) {
            return {
              found: true,
              index: Array.from(document.querySelectorAll('button, [role="button"]')).indexOf(searchButton)
            };
          }
          return { found: false };
        });

        if (buttonWithSearchText.found) {
          console.log(`Found search button by text content at index ${buttonWithSearchText.index}`);
          const buttons = await page.$$('button, [role="button"]');
          searchButton = buttons[buttonWithSearchText.index];
        }
      } catch (error) {
        console.log('Error finding button by text content:', error.message);
      }

      // Approach 2: Try to find by position (often search button is at bottom right)
      if (!searchButton) {
        console.log('Approach 2: Finding by position (bottom right)...');
        try {
          const buttonByPosition = await page.evaluate(() => {
            // Get viewport dimensions
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;

            // Get all buttons
            const buttons = Array.from(document.querySelectorAll('button, [role="button"]'));

            // Sort by distance from bottom right
            const sortedButtons = buttons
              .filter(btn => {
                const rect = btn.getBoundingClientRect();
                return rect.width > 0 && rect.height > 0; // Only visible buttons
              })
              .map(btn => {
                const rect = btn.getBoundingClientRect();
                // Calculate distance from bottom right
                const distanceFromBottomRight = Math.sqrt(
                  Math.pow(viewportWidth - (rect.left + rect.width/2), 2) +
                  Math.pow(viewportHeight - (rect.top + rect.height/2), 2)
                );
                return {
                  element: btn,
                  distance: distanceFromBottomRight,
                  index: Array.from(document.querySelectorAll('button, [role="button"]')).indexOf(btn)
                };
              })
              .sort((a, b) => a.distance - b.distance);

            // Return the closest button to bottom right
            if (sortedButtons.length > 0) {
              return {
                found: true,
                index: sortedButtons[0].index,
                distance: sortedButtons[0].distance
              };
            }
            return { found: false };
          });

          if (buttonByPosition.found) {
            console.log(`Found potential search button by position at index ${buttonByPosition.index} (distance: ${buttonByPosition.distance})`);
            const buttons = await page.$$('button, [role="button"]');
            searchButton = buttons[buttonByPosition.index];
          }
        } catch (error) {
          console.log('Error finding button by position:', error.message);
        }
      }
    }

    // If still not found, try to use JavaScript to find and click the button
    if (!searchButton) {
      console.log('Could not find search button with previous approaches, trying JavaScript click...');

      const jsClickResult = await page.evaluate(() => {
        // Try to find search button by various attributes
        const searchTexts = ['search', 'Search', 'SEARCH', 'find', 'Find', 'FIND', 'go', 'Go', 'GO'];

        // Function to check if an element might be a search button
        const isLikelySearchButton = (el) => {
          if (!el) return false;

          // Check text content
          const text = el.textContent?.toLowerCase() || '';
          if (searchTexts.some(searchText => text.includes(searchText.toLowerCase()))) return true;

          // Check aria-label
          const ariaLabel = el.getAttribute('aria-label')?.toLowerCase() || '';
          if (searchTexts.some(searchText => ariaLabel.includes(searchText.toLowerCase()))) return true;

          // Check class names
          const className = el.className?.toLowerCase() || '';
          if (className.includes('search') || className.includes('submit')) return true;

          // Check other attributes
          const jsaction = el.getAttribute('jsaction')?.toLowerCase() || '';
          if (jsaction.includes('search')) return true;

          return false;
        };

        // Try to find by various selectors
        let searchButton = null;

        // Try specific Google Flights selectors first
        const specificSelectors = [
          'button[jsname="vLv7Lb"]',
          'button[jsname="c6xFrd"]',
          'button.gws-flights__search-button',
          'button.gws-flights-form__search-button'
        ];

        for (const selector of specificSelectors) {
          const btn = document.querySelector(selector);
          if (btn) {
            searchButton = btn;
            break;
          }
        }

        // If not found, try more generic approaches
        if (!searchButton) {
          // Try to find by text content
          const buttons = Array.from(document.querySelectorAll('button, [role="button"]'));
          searchButton = buttons.find(isLikelySearchButton);
        }

        // If found, try to click it
        if (searchButton) {
          try {
            // Try multiple click methods
            searchButton.click(); // Standard click

            // Also try dispatching events
            const clickEvent = new MouseEvent('click', {
              view: window,
              bubbles: true,
              cancelable: true
            });
            searchButton.dispatchEvent(clickEvent);

            return {
              success: true,
              method: 'JavaScript click',
              buttonText: searchButton.textContent?.trim() || '',
              buttonClass: searchButton.className || ''
            };
          } catch (e) {
            return { success: false, error: String(e) };
          }
        }

        return { success: false, reason: 'No search button found' };
      });

      console.log('JavaScript click result:', jsClickResult);

      if (jsClickResult.success) {
        console.log(`Successfully clicked search button via JavaScript: ${jsClickResult.buttonText}`);

        // Wait for possible navigation
        try {
          await page.waitForNavigation({ timeout: 10000 }).catch(() => {
            console.log('No navigation occurred after JavaScript click');
          });
        } catch (error) {
          console.log('Error waiting for navigation after JavaScript click:', error.message);
        }
      } else {
        // Last resort: press Enter key
        console.log('JavaScript click failed, trying to press Enter as last resort...');
        await page.keyboard.press('Enter');
        console.log('Pressed Enter key');

        // Wait for possible navigation
        try {
          await page.waitForNavigation({ timeout: 5000 }).catch(() => {
            console.log('No navigation occurred after pressing Enter');
          });
        } catch (error) {
          console.log('Error waiting for navigation after pressing Enter:', error.message);
        }
      }
    } else {
      // We found a search button with one of our selectors
      console.log('Found search button, clicking it...');

      try {
        // Take screenshot before clicking
        await page.screenshot({ path: `./logs/screenshots/before-search-button-click-${Date.now()}.png` });

        // Try standard click first
        await searchButton.click().catch(async (error) => {
          console.log('Standard click failed:', error.message);

          // If standard click fails, try JavaScript click
          console.log('Trying JavaScript click as fallback...');
          await page.evaluate(element => {
            element.click();

            // Also dispatch events for good measure
            const clickEvent = new MouseEvent('click', {
              view: window,
              bubbles: true,
              cancelable: true
            });
            element.dispatchEvent(clickEvent);
          }, searchButton);
        });

        console.log('Clicked search button');

        // Wait for results to load
        console.log('Waiting for search results to load...');
        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 })
          .catch(() => console.log('Navigation timeout waiting for results, continuing anyway'));

        console.log('Search results loaded or timeout occurred');
      } catch (error) {
        console.log('Error clicking search button:', error.message);

        // If clicking fails, try pressing Enter as a last resort
        console.log('Click failed, trying to press Enter as fallback...');
        await page.keyboard.press('Enter');
        console.log('Pressed Enter key');

        // Wait for possible navigation
        try {
          await page.waitForNavigation({ timeout: 10000 }).catch(() => {
            console.log('No navigation occurred after pressing Enter');
          });
        } catch (error) {
          console.log('Error waiting for navigation after pressing Enter:', error.message);
        }
      }
    }

    // Take a screenshot of the results
    const screenshotPath = `./logs/screenshots/flight-search-results-${Date.now()}.png`;
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`Screenshot saved to: ${screenshotPath}`);

    // Pause for manual debugging
    console.log('\n-----------------------------------------');
    console.log('Script paused for manual debugging.');
    console.log('The browser will remain open until you press Ctrl+C in the terminal.');
    console.log('-----------------------------------------\n');

    // Keep the script running to allow manual debugging
    await new Promise(() => {
      // This promise never resolves, keeping the script running
      // until manually terminated
    });

  } catch (error) {
    console.error('Error during test:', error);
  }
  // We don't close the browser here to allow for manual debugging
}

// Run the main function
main().catch(console.error);
