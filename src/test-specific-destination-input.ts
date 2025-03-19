import * as puppeteer from 'puppeteer';

async function main() {
  console.log('Starting Google Flights specific destination input test...');

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

    // Find the specific destination input field using the exact class and attributes from your HTML snippet
    console.log('Looking for specific destination input field...');
    const destinationInputSelector = 'input.II2One.j0Ppje.zmMKJ.LbIaRd[jsname="yrriRe"][placeholder="Where to?"][aria-label="Where to? "]';

    // Try to find the element with the specific selector
    let foundSelector = destinationInputSelector;
    let isElementFound = await page.evaluate((selector) => !!document.querySelector(selector), destinationInputSelector);

    // If not found, try a more general selector
    if (!isElementFound) {
      console.log('Specific selector not found, trying more general selectors...');
      const alternativeSelectors = [
        'input[placeholder="Where to?"]',
        'input[aria-label="Where to? "]',
        'input[jsname="yrriRe"]',
        'input.II2One',
        'input[role="combobox"][aria-autocomplete="inline"]'
      ];

      for (const selector of alternativeSelectors) {
        console.log(`Trying selector: ${selector}`);
        isElementFound = await page.evaluate((selector) => !!document.querySelector(selector), selector);
        if (isElementFound) {
          console.log(`Found destination input with selector: ${selector}`);
          foundSelector = selector;
          break;
        }
      }
    }

    if (!isElementFound) {
      throw new Error('Could not find destination input field');
    }

    console.log('Found destination input field, clicking on it...');
    await page.click(foundSelector);

    // Type "Tokyo" in the destination field
    console.log('Typing "Tokyo" in destination field...');
    await page.keyboard.type('Tokyo', { delay: 100 });

    // Wait for 500ms to allow dropdown to appear
    console.log('Waiting 500ms for dropdown to appear...');
    await new Promise(resolve => setTimeout(resolve, 500));

    // Wait for the dropdown list to appear
    console.log('Waiting for dropdown list...');
    await page.waitForSelector('ul[role="listbox"]', { timeout: 5000 });

    // Select the first item in the dropdown - improved approach
    console.log('Selecting first dropdown item...');

    // Add a longer delay to ensure dropdown is fully loaded
    console.log('Waiting additional time for dropdown to fully load...');
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Log all available dropdown items for debugging
    console.log('Checking available dropdown items...');
    const dropdownItems = await page.$$('li[role="option"]');
    console.log(`Found ${dropdownItems.length} dropdown items`);

    // Try multiple selector approaches
    try {
      // Approach 1: Try to find items with text containing Tokyo
      console.log('Approach 1: Looking for items containing Tokyo text...');
      const tokyoItems = await page.$$eval('li[role="option"]', items => {
        return items
          .filter(item => item.textContent?.includes('Tokyo'))
          .map(item => ({
            text: item.textContent?.trim(),
            visible: !!(item.offsetWidth || item.offsetHeight || item.getClientRects().length)
          }));
      });

      console.log(`Found ${tokyoItems.length} items containing Tokyo:`, tokyoItems);

      // Approach 2: Try a more specific selector
      console.log('Approach 2: Using more specific selector...');
      const specificItem = await page.waitForSelector('li[role="option"] div[role="presentation"]', {
        timeout: 3000
      }).catch(() => null);

      if (specificItem) {
        console.log('Found item with specific selector, clicking it...');
        await specificItem.click();
        console.log('Clicked item with specific selector');
      } else {
        // Approach 3: Use JavaScript click on the first option
        console.log('Approach 3: Using JavaScript click on first option...');
        // Use a different approach to click the first dropdown item
        console.log('Approach 3: Using direct Puppeteer click on first option...');

        // Try to click directly using Puppeteer's click method
        const firstOption = await page.$('li[role="option"]:first-child');
        if (firstOption) {
          try {
            console.log('Found first option, clicking it...');
            await firstOption.click();
            console.log('Clicked first option successfully');
          } catch (clickError) {
            console.error('Error clicking first option:', clickError);

            // Try clicking with JavaScript
            console.log('Trying JavaScript click as fallback...');
            const clickResult = await page.evaluate(() => {
              const options = Array.from(document.querySelectorAll('li[role="option"]'));
              if (options.length > 0) {
                try {
                  // Dispatch a mouse event instead of using click()
                  const event = new MouseEvent('click', {
                    view: window,
                    bubbles: true,
                    cancelable: true
                  });
                  options[0].dispatchEvent(event);
                  return { success: true, count: options.length, method: 'dispatchEvent' };
                } catch (e) {
                  return { success: false, count: options.length, error: String(e) };
                }
              }
              return { success: false, count: options.length };
            });

            console.log('JavaScript click result:', clickResult);

            if (!clickResult.success) {
              console.log('JavaScript click failed, trying to press Enter instead');
              await page.keyboard.press('Enter');
            }
          }
        } else {
          console.log('Could not find first option, trying to press Enter instead');
          await page.keyboard.press('Enter');
        }
      }
    } catch (error) {
      console.error('Error during dropdown selection:', error);
      console.log('Falling back to Enter key press');
      await page.keyboard.press('Enter');
    }

    // Take a screenshot after selection
    console.log('Taking screenshot after dropdown selection...');
    const screenshotPath = `./logs/screenshots/after-dropdown-selection-${Date.now()}.png`;
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`Screenshot saved to: ${screenshotPath}`);

    // Verify selection was successful by checking for visual indicators on the page
    console.log('Verifying selection was successful...');

    // Check if any input field on the page contains Tokyo
    const selectionSuccessful = await page.evaluate(() => {
      // Check all input fields
      const allInputs = Array.from(document.querySelectorAll('input'));
      for (const input of allInputs) {
        if (input.value && input.value.includes('Tokyo')) {
          return { success: true, value: input.value };
        }
      }

      // Check if there's any visible text on the page containing Tokyo
      const bodyText = document.body.textContent || '';
      if (bodyText.includes('Tokyo')) {
        return { success: true, method: 'bodyText' };
      }

      // Check for any elements that might indicate selection
      const destinationElements = Array.from(document.querySelectorAll('[aria-label*="destination"], [placeholder*="to"], .destination-field, .selected-destination'));
      for (const elem of destinationElements) {
        const text = elem.textContent || '';
        if (text.includes('Tokyo')) {
          return { success: true, method: 'destinationElement', text };
        }
      }

      return { success: false };
    });

    console.log('Selection verification result:', selectionSuccessful);

    if (selectionSuccessful.success) {
      console.log('✅ Selection successful: Found "Tokyo" on the page');
    } else {
      console.log('❌ Selection may have failed: Could not find "Tokyo" on the page');

      // If selection failed, try one more approach with a more general selector
      console.log('Trying fallback approach: Using more general selector + Arrow down + Enter');

      try {
        // Find any input field that might be for destination
        const generalInputSelector = 'input[placeholder*="to"], input[aria-label*="to"], input[role="combobox"]';
        await page.waitForSelector(generalInputSelector, { timeout: 3000 });
        await page.click(generalInputSelector);

        // Clear the field first
        await page.keyboard.down('Control');
        await page.keyboard.press('a');
        await page.keyboard.up('Control');
        await page.keyboard.press('Backspace');

        // Type Tokyo again
        await page.keyboard.type('Tokyo', { delay: 100 });
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Try arrow down and enter
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('Enter');

        // Take another screenshot after fallback approach
        const fallbackScreenshotPath = `./logs/screenshots/after-fallback-selection-${Date.now()}.png`;
        await page.screenshot({ path: fallbackScreenshotPath, fullPage: true });
        console.log(`Fallback screenshot saved to: ${fallbackScreenshotPath}`);
      } catch (fallbackError) {
        console.error('Error during fallback approach:', fallbackError);
        console.log('Fallback approach failed, continuing with debugging');
      }
    }

    // Pause for manual debugging
    console.log('\n-----------------------------------------');
    console.log('Script paused for manual debugging.');
    console.log('The browser will remain open until you press Ctrl+C in the terminal.');
    console.log('-----------------------------------------\n');

    // Keep the script running to allow manual debugging
    // This effectively pauses the script while keeping the browser open
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
