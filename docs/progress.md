# Progress: Travel Stipend Calculator

## What Works

### Core Functionality

✅ **Stipend Calculation Logic (`src/travel-stipend-calculator.ts`)**

-   Calculates flight cost via Google Flights scraping (with $0 fallback).
-   Calculates lodging cost with cost-of-living and weekend adjustments.
-   Calculates meal costs (basic + business) with cost-of-living adjustments and duration scaling.
-   Calculates local transport cost based on taxi data or fallback.
-   Includes ticket price from input.
-   Adds allowances for internet and incidentals based on duration and international travel.

✅ **Data Persistence & Management**

-   SQLite database (`db/travel-stipend.db`) stores reference data (CoL, coordinates, taxis, conferences).
-   Automatic database initialization and data import from `fixtures/*.csv` on first run/empty tables.
-   JSON-based caching (`fixtures/cache/`) for calculated stipends, flight prices, distances, CoL factors, coordinates.

✅ **Flight Price Lookup (`src/utils/flights.ts`, `src/utils/google-flights-scraper/`)**

-   Integrates Puppeteer-based Google Flights scraper (via submodule).
-   Handles scraper errors gracefully, falling back to $0 flight cost.
-   Includes utilities for running in GitHub Actions (screenshots, retries).

✅ **Command Line Interface (`src/travel-stipend-cli.ts`)**

-   Accepts origin, destination, dates, ticket price, buffer days via arguments.
-   Outputs results in JSON, CSV, or formatted console table.
-   Includes verbose logging option.

✅ **GitHub Actions Workflow (`.github/workflows/batch-travel-stipend.yml`)**

-   Triggers on `push` (using `.github/test-events.json`) or `workflow_dispatch`.
-   Uses a matrix strategy to run multiple calculations in parallel (`calculate` job).
-   Generates unique filenames/artifact names for each job result.
-   Consolidates results from all jobs (`consolidate` job).
-   Generates Markdown, JSON, and CSV consolidated reports.
-   Uploads individual and consolidated results as artifacts.
-   **Callback:** Sends consolidated results via POST to a configured URL (`PROXY_CALLBACK_URL`) using a shared secret (`PROXY_CALLBACK_SECRET`) if triggered with a `clientId`.

✅ **Web UI Trigger Mechanism**

-   **Static UI (`ui/`):** HTML form for input, CSS for styling (dark mode), JS (`ui/script.js`) for interaction.
-   **Proxy Function (`api/trigger-workflow.ts`):**
    -   Deno Deploy function serves static UI and API endpoint.
    -   Receives UI requests via WebSocket (`/ws`).
    -   Authenticates with GitHub using GitHub App credentials.
    -   Triggers `batch-travel-stipend.yml` via `workflow_dispatch`, passing UI inputs and a unique `clientId`.
    -   Receives results back from the Action via HTTP POST callback (`/api/workflow-complete`).
    -   Authenticates callback using a shared secret (`CALLBACK_SECRET`).
    -   Forwards results to the correct UI client via WebSocket.
-   **Local Proxy (`start:proxy` script):** Bun/Node version of the proxy for local testing (requires `.env` file).

### Utilities

✅ **Core Utils (`src/utils/`)**

-   Distance calculation (Haversine).
-   Date handling (parsing, diff, flight date generation).
-   Cost-of-living factor lookup.
-   Local transport cost calculation.
-   Caching (`PersistentCache`).
-   Constants for configuration.

## In Progress

🔄 **UI/Proxy/Actions Flow Stabilization**

-   Testing the end-to-end flow in deployed environment (Deno Deploy).
-   Refining error handling and status reporting via WebSockets.
-   Ensuring callback security and reliability.

🔄 **Flight Price Scraper Improvements**

-   Ongoing monitoring for breakages due to Google Flights UI changes.
-   Potential enhancements for reliability and edge case handling.

🔄 **Data Expansion & Accuracy**

-   Need for more comprehensive and up-to-date data in `fixtures/*.csv` (CoL, taxis, coordinates).

## What's Left to Build (Potential Future Goals)

### Core Enhancements

⬜ **Currency Conversion**: Support non-USD inputs/outputs.
⬜ **Advanced Cost Adjustments**: Seasonal factors, conference popularity, etc.
⬜ **Improved City/Airport Matching**: More robust fuzzy matching or alias support.
⬜ **Flight Price Stabilization**: Strategies beyond simple averaging (e.g., multiple lookups, historical data).

### User Experience

⬜ **UI Enhancements**: More detailed result display, input validation, historical view.
⬜ **CLI Enhancements**: Interactive mode, more filtering/sorting.
⬜ **Visualization/Reporting**: Charts, budget forecasting tools.

### Technical Improvements

⬜ **Expanded Test Suite**: More unit and integration tests, especially for scraping and the UI/proxy flow.
⬜ **Refactoring**: Code organization, type safety improvements, performance optimizations.
⬜ **Configuration Management**: Move more constants to `.env` or a config file.
⬜ **Database Migrations**: Implement a proper system if DB schema evolves.

## Known Issues

### High Priority

🐛 **Scraper Reliability**: Highly dependent on Google Flights UI stability. Needs monitoring.
🐛 **Proxy Deployment/Secrets:** Correct configuration of environment variables (especially the multi-line private key) on Deno Deploy is critical and error-prone.
🐛 **Callback Reliability:** Network issues or proxy downtime could prevent results from reaching the UI.

### Medium Priority

🐛 **City Name Matching Failures**: Some cities might not match DB entries.
🐛 **Missing Reference Data**: Gaps in CoL or taxi data lead to fallbacks.
🐛 **WebSocket State Management:** Current server implementation is basic.

### Low Priority

🐛 **Local Testing Callback:** GitHub Actions runners usually cannot reach `localhost` for the callback; requires workarounds like `ngrok`.

## Recent Achievements

✅ **Implemented UI -> Proxy -> Actions -> Proxy -> UI flow:** Major architectural change enabling UI-driven calculations via GitHub Actions.
✅ **Added WebSocket Communication:** For real-time status updates and results delivery to the UI.
✅ **Implemented GitHub App Authentication:** Switched from PAT to more secure App-based auth for the proxy.
✅ **Created Deno Deploy Proxy Function:** Including static file serving and API endpoints.
✅ **Added GitHub Actions Callback:** Workflow now POSTs results back to the proxy.
✅ **Implemented Shared Secret Auth:** For securing the Action -> Proxy callback.
✅ **Added UI Build Step:** Compiling frontend TS to JS.
✅ **Created Key Conversion Script:** To ensure correct private key format.
✅ **Updated Documentation:** Rewrote large parts of README and other docs to reflect new architecture and setup.
✅ **Troubleshooting:** Resolved numerous issues related to GitHub Actions conflicts, Deno Deploy configuration, Git tracking, and UI functionality.

## Next Milestone Goals

1.  **Stabilize UI/Proxy/Actions Flow:** Complete deployment and end-to-end testing.
2.  **Refine UI Error Handling:** Provide clearer feedback to the user on errors.
3.  **Finalize Documentation:** Ensure all setup and usage steps are accurate and clear.
4.  **Monitor Scraper:** Keep an eye on the flight scraper's reliability.
