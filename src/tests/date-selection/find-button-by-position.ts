import * as puppeteer from "puppeteer";

// Helper function to find button by position
export async function findButtonByPosition(page: puppeteer.Page): Promise<puppeteer.ElementHandle<Element> | null> {
  try {
    const buttonByPosition = await page.evaluate(() => {
      // Get viewport dimensions
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      // Get all buttons
      const buttons = Array.from(document.querySelectorAll('button, [role="button"]'));

      // Sort by distance from bottom right
      const sortedButtons = buttons
        .filter((btn) => {
          const rect = btn.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0; // Only visible buttons
        })
        .map((btn) => {
          const rect = btn.getBoundingClientRect();
          // Calculate distance from bottom right
          const distanceFromBottomRight = Math.sqrt(
            Math.pow(viewportWidth - (rect.left + rect.width / 2), 2) + Math.pow(viewportHeight - (rect.top + rect.height / 2), 2)
          );
          return {
            element: btn,
            distance: distanceFromBottomRight,
            index: Array.from(document.querySelectorAll('button, [role="button"]')).indexOf(btn),
          };
        })
        .sort((a, b) => a.distance - b.distance);

      // Return the closest button to bottom right
      if (sortedButtons.length > 0) {
        return {
          found: true,
          index: sortedButtons[0].index,
          distance: sortedButtons[0].distance,
        };
      }
      return { found: false };
    });

    if (buttonByPosition.found) {
      console.log(`Found potential button by position at index ${buttonByPosition.index} (distance: ${buttonByPosition.distance})`);
      const buttons = await page.$$('button, [role="button"]');
      return buttons[buttonByPosition.index];
    }
  } catch (positionError) {
    console.log("Error finding button by position:", positionError instanceof Error ? positionError.message : String(positionError));
  }

  return null;
}
