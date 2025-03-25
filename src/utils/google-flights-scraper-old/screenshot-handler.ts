import * as fs from "fs";
import * as path from "path";
import { Page } from "puppeteer";
import { LOG_LEVEL } from "./config";
import { log } from "./log";

interface ScreenshotOptions {
  fullPage?: boolean;
  captureHtml?: boolean;
  logDOM?: boolean;
  highlightElements?: string[];
  dumpConsole?: boolean;
  quality?: number;
  sequence?: number;
}

interface ScreenshotResult {
  imagePath: string;
  htmlPath?: string;
  metadataPath?: string;
  logPath?: string;
}

/**
 * Takes an enhanced screenshot with additional debugging information
 * @param page Puppeteer page object
 * @param description Description of the screenshot context
 * @param options Screenshot options
 * @returns Object containing paths to the saved files
 */
export async function takeDebugScreenshot(
  page: Page,
  description: string,
  options: ScreenshotOptions = {}
): Promise<ScreenshotResult> {
  const result: ScreenshotResult = {
    imagePath: "screenshot-failed",
  };

  try {
    // Check if we should take this screenshot based on environment conditions
    const isGitHubActions = Boolean(process.env.GITHUB_ACTIONS);
    const isDebugMode = process.env.DEBUG_GOOGLE_FLIGHTS === "true";

    // Force enable screenshots in GitHub Actions to debug the screenshot capture issue
    const isErrorScreenshot = description.toLowerCase().includes("error") ||
                             description.toLowerCase().includes("fail") ||
                             options.dumpConsole === true;

    // Modified condition: Always capture screenshots in GitHub Actions
    // This ensures that we'll always get screenshots for debugging
    const shouldSkip = false; // Force screenshots to be captured

    if (shouldSkip) {
      log(LOG_LEVEL.DEBUG, `Skipping screenshot for: ${description} (in GitHub Actions with reduced logging)`);
      return result;
    }

    log(LOG_LEVEL.INFO, `Taking screenshot for: ${description}`);

    const sequenceNumber = options.sequence ?? Math.floor(Date.now() / 1000) % 10000;

    // Create timestamp-based directory structure
    const timestamp = new Date().toISOString().replace(/:/g, "-");
    const dirPath = path.join("debug-screenshots", timestamp.split("T")[0]);

    // Create run ID for this debug session based on minute/hour
    const runId = timestamp.split("T")[1].substring(0, 5).replace(":", "");
    const finalDirPath = path.join(dirPath, `run-${runId}`);

    // Ensure directories exist
    if (!fs.existsSync("debug-screenshots")) {
      fs.mkdirSync("debug-screenshots");
    }

    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }

    if (!fs.existsSync(finalDirPath)) {
      fs.mkdirSync(finalDirPath, { recursive: true });
    }

    // Sanitize description for filename
    const sanitizedDescription = description
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-")
      .replace(/-+/g, "-")
      .replace(/(^-)|(-$)/g, "");

    // Create base filename with sequence number for correct ordering
    const baseFilename = `${sequenceNumber.toString().padStart(4, '0')}-${sanitizedDescription}`;

    // Take screenshot
    const imgFilename = `${baseFilename}.png`;
    const imgFilePath = path.join(finalDirPath, imgFilename);

    // Highlight elements if requested
    if (options.highlightElements && options.highlightElements.length > 0) {
      await highlightElements(page, options.highlightElements);
    }

    // Adjust screenshot quality based on environment
    const screenshotQuality = process.env.SCREENSHOT_QUALITY?.toLowerCase();
    let quality = 70; // Default medium quality

    if (screenshotQuality === "high") {
      quality = 90;
    } else if (screenshotQuality === "low") {
      quality = 50;
    }

    // Use provided quality or select based on environment
    const finalQuality = options.quality ?? quality;

    await page.screenshot({
      path: imgFilePath,
      fullPage: options.fullPage ?? false,
      quality: finalQuality
    });
    result.imagePath = imgFilePath;

    // In GitHub Actions, only capture HTML for error screenshots to reduce artifacts
    const shouldCaptureHtml = options.captureHtml &&
      (!isGitHubActions || isDebugMode || isErrorScreenshot);

    if (shouldCaptureHtml) {
      const htmlFilename = `${baseFilename}.html`;
      const htmlFilePath = path.join(finalDirPath, htmlFilename);
      const html = await page.content();
      fs.writeFileSync(htmlFilePath, html);
      result.htmlPath = htmlFilePath;
    }

    // Create metadata file with debugging information
    // In GitHub Actions with reduced logging, only create metadata for errors
    if (!isGitHubActions || isDebugMode || isErrorScreenshot) {
      const metadataFilename = `${baseFilename}.json`;
      const metadataFilePath = path.join(finalDirPath, metadataFilename);

      const metadata = {
        timestamp,
        url: page.url(),
        description,
        viewport: page.viewport(),
        userAgent: await page.evaluate(() => navigator.userAgent),
        cookies: await page.cookies() as unknown as string,
        title: await page.title(),
        // Only capture performance metrics for debug mode or errors
        performance: (isDebugMode || isErrorScreenshot) ? await page.evaluate(() => {
          if (window.performance) {
            return {
              // Use safer methods to capture performance data
              timeOrigin: window.performance.timeOrigin,
              now: window.performance.now(),
              // Capturing entries from different types
              resources: window.performance.getEntriesByType('resource').slice(0, 10),
              navigation: window.performance.getEntriesByType('navigation').slice(0, 5),
              paint: window.performance.getEntriesByType('paint')
            };
          }
          return null;
        }) : null
      };

      fs.writeFileSync(metadataFilePath, JSON.stringify(metadata, null, 2));
      result.metadataPath = metadataFilePath;
    }

    // Dump console logs if requested
    if (options.dumpConsole) {
      const logFilename = `${baseFilename}-console.log`;
      const logFilePath = path.join(finalDirPath, logFilename);

      const consoleLogs = await page.evaluate(() => {
        // This is a simplification - in a real implementation we would set up
        // console capture earlier in the process
        return {
          message: "Console logs would be captured here in a real implementation",
          time: new Date().toISOString()
        };
      });

      fs.writeFileSync(logFilePath, JSON.stringify(consoleLogs, null, 2));
      // Fix the type error - ensure logPath is always a string
      result.logPath = logFilePath;
    }

    // Log at different levels based on screenshot type
    if (isErrorScreenshot) {
      log(LOG_LEVEL.WARN, `Error screenshot saved to ${imgFilePath}`);
    } else {
      log(LOG_LEVEL.INFO, `Debug screenshot saved to ${imgFilePath}`);
    }

    // Only create index in debug mode to reduce file operations
    if (isDebugMode) {
      // Create or update index file for easier navigation
      updateScreenshotIndex(finalDirPath, {
        timestamp,
        description,
        imgPath: imgFilename,
        htmlPath: result.htmlPath ? path.basename(result.htmlPath) : undefined,
        metadataPath: result.metadataPath || '', // Fix the type error
        logPath: result.logPath ? path.basename(result.logPath) : undefined,
      });
    }

    return result;
  } catch (error) {
    log(LOG_LEVEL.ERROR, "Error taking debug screenshot:", error instanceof Error ? error.message : String(error));
    return result;
  }
}

/**
 * Original screenshot function (kept for backward compatibility)
 */
export async function takeScreenshot(
  page: Page,
  destination: string,
  type: string
): Promise<string> {
  try {
    // Create timestamp-based directory structure
    const timestamp = new Date().toISOString().replace(/:/g, "-");
    const dirPath = path.join("test-screenshots", timestamp.split("T")[0]);

    // Ensure directory exists
    if (!fs.existsSync("test-screenshots")) {
      fs.mkdirSync("test-screenshots");
    }

    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }

    // Sanitize destination for filename
    const sanitizedDestination = destination
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-")
      .replace(/-+/g, "-")
      .replace(/(^-)|(-$)/g, "");

    // Create filename
    const filename = `${sanitizedDestination}-${type}.png`;
    const filePath = path.join(dirPath, filename);

    // Take screenshot
    await page.screenshot({ path: filePath, fullPage: false });

    log(LOG_LEVEL.INFO, `Screenshot saved to ${filePath}`);
    return filePath;
  } catch (error) {
    log(LOG_LEVEL.ERROR, "Error taking screenshot:", error instanceof Error ? error.message : String(error));
    return "screenshot-failed";
  }
}

/**
 * Helper function to highlight elements on the page before taking a screenshot
 */
async function highlightElements(page: Page, selectors: string[]): Promise<void> {
  try {
    await page.evaluate((selectorsToHighlight) => {
      // Remove any existing highlights
      const existingHighlights = document.querySelectorAll('.puppeteer-debug-highlight');
      existingHighlights.forEach(el => el.remove());

      // Highlight each element
      selectorsToHighlight.forEach((selector, index) => {
        const elements = document.querySelectorAll(selector);

        elements.forEach(el => {
          const rect = el.getBoundingClientRect();
          const highlight = document.createElement('div');

          highlight.classList.add('puppeteer-debug-highlight');
          highlight.style.position = 'absolute';
          highlight.style.border = '2px solid red';
          highlight.style.backgroundColor = 'rgba(255, 0, 0, 0.2)';
          highlight.style.zIndex = '10000';
          highlight.style.top = rect.top + 'px';
          highlight.style.left = rect.left + 'px';
          highlight.style.width = rect.width + 'px';
          highlight.style.height = rect.height + 'px';
          highlight.style.pointerEvents = 'none';
          highlight.setAttribute('data-selector', selector);
          highlight.textContent = `#${index + 1}: ${selector}`;

          document.body.appendChild(highlight);
        });
      });
    }, selectors);
  } catch (error) {
    log(LOG_LEVEL.WARN, "Could not highlight elements:", error instanceof Error ? error.message : String(error));
  }
}

/**
 * Update the index file for easier navigation of screenshots
 */
function updateScreenshotIndex(dirPath: string, entry: {
  timestamp: string;
  description: string;
  imgPath: string;
  htmlPath?: string;
  metadataPath: string;
  logPath?: string;
}): void {
  const indexPath = path.join(dirPath, 'index.html');

  let indexContent = '';
  if (fs.existsSync(indexPath)) {
    indexContent = fs.readFileSync(indexPath, 'utf-8');
  } else {
    // Create new index file with header
    indexContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Debug Screenshots</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          table { border-collapse: collapse; width: 100%; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f2f2f2; }
          tr:nth-child(even) { background-color: #f9f9f9; }
          img.thumbnail { max-width: 200px; max-height: 200px; cursor: pointer; }
          .modal { display: none; position: fixed; z-index: 1; left: 0; top: 0; width: 100%; height: 100%;
                  overflow: auto; background-color: rgba(0,0,0,0.9); }
          .modal-content { margin: auto; display: block; max-width: 90%; max-height: 90%; }
          .close { position: absolute; top: 15px; right: 35px; color: #f1f1f1; font-size: 40px;
                  font-weight: bold; cursor: pointer; }
        </style>
      </head>
      <body>
        <h1>Debug Screenshots</h1>
        <table>
          <tr>
            <th>Time</th>
            <th>Description</th>
            <th>Screenshot</th>
            <th>HTML</th>
            <th>Metadata</th>
            <th>Console</th>
          </tr>
    `;
  }

  // Add new entry to table
  const newEntry = `
    <tr>
      <td>${entry.timestamp}</td>
      <td>${entry.description}</td>
      <td><a href="${entry.imgPath}" target="_blank"><img src="${entry.imgPath}" class="thumbnail"></a></td>
      <td>${entry.htmlPath ? `<a href="${entry.htmlPath}" target="_blank">HTML</a>` : 'N/A'}</td>
      <td><a href="${entry.metadataPath}" target="_blank">Metadata</a></td>
      <td>${entry.logPath ? `<a href="${entry.logPath}" target="_blank">Console</a>` : 'N/A'}</td>
    </tr>
  `;

  // Insert new row before closing tags
  if (indexContent.includes('</table>')) {
    indexContent = indexContent.replace('</table>', newEntry + '</table>');
  } else {
    // If somehow the index file exists but doesn't have a table closing tag
    indexContent += newEntry + '</table></body></html>';
  }

  // Add viewer JS if it doesn't exist
  if (!indexContent.includes('function showModal')) {
    indexContent = indexContent.replace('</body>', `
      <div id="imageModal" class="modal">
        <span class="close">&times;</span>
        <img class="modal-content" id="modalImage">
      </div>
      <script>
        // Image modal viewer
        const modal = document.getElementById("imageModal");
        const modalImg = document.getElementById("modalImage");
        const closeBtn = document.getElementsByClassName("close")[0];

        document.querySelectorAll("img.thumbnail").forEach(img => {
          img.onclick = function() {
            modal.style.display = "block";
            modalImg.src = this.src;
          }
        });

        closeBtn.onclick = function() {
          modal.style.display = "none";
        }

        window.onclick = function(event) {
          if (event.target == modal) {
            modal.style.display = "none";
          }
        }
      </script>
    </body>`);
  }

  fs.writeFileSync(indexPath, indexContent);
}
