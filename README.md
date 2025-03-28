# Travel Stipend Calculator

A TypeScript application using Bun that calculates fair travel stipends for conference trips, factoring in variable travel expenses based on location, flight costs, lodging, meals, local transport, and other allowances.

## Overview

This travel stipend calculator helps provide fair and consistent travel stipends for employees attending conferences. It aims to automate calculations based on:

-   **Flight Cost**: Looked up via Google Flights scraping (falls back to $0 if scraping fails or is not applicable).
-   **Lodging Cost**: Based on a standard per-night rate, adjusted by the destination's cost-of-living index and potential weekend multipliers.
-   **Meals Cost**: Based on standard daily rates (basic and business entertainment), adjusted by the destination's cost-of-living index.
-   **Local Transportation Cost**: Estimated based on destination city taxi fare data.
-   **Conference Ticket Price**: Provided as input.
-   **Allowances**: Includes standard amounts for internet/data and incidentals.
-   **Travel Duration**: Accounts for conference duration plus configurable buffer days before and after.

## Features

-   **CLI Tool**: Calculate stipends for individual trips with flexible date inputs and options.
-   **Batch Processing**: A GitHub Actions workflow (`.github/workflows/batch-travel-stipend.yml`) processes multiple trips defined in `.github/test-events.json` (on push) or via `workflow_dispatch` inputs.
-   **Real-time Flight Data**: Integrates a Google Flights scraper for dynamic flight cost estimation.
-   **Cost-of-Living Adjustments**: Uses index data to adjust lodging and meal costs.
-   **Database Integration**: Uses a SQLite database (`db/travel-stipend.db`) to store and query reference data (conferences, cost of living, coordinates, taxi fares).
-   **Caching**: Implements persistent caching for flight prices, distances, coordinates, and cost-of-living data to improve performance and reduce redundant lookups.
-   **Flexible Output**: Supports JSON, CSV, and formatted console table outputs via the CLI and generates a consolidated Markdown report in the batch workflow.
-   **Modular Design**: Calculations are separated into utility functions for maintainability.

## Requirements

-   [Bun](https://bun.sh/) runtime (v1.0.0 or higher)
-   Node.js (v20.10.0 or higher, primarily for compatibility if Bun isn't used)
-   Git (for submodules and hooks)
-   [Deno](https://deno.land/) (for running/deploying the proxy function)
-   [deployctl](https://deno.com/deploy/docs/deployctl) (Deno Deploy CLI, for manual proxy deployment script)

## Setup

1.  Clone the repository:
    ```bash
    git clone <repository-url>
    cd travel-stipend
    ```
2.  Initialize submodules (for the Google Flights scraper):
    ```bash
    git submodule update --init --recursive
    ```
3.  Install dependencies in the main project and the submodule:
    ```bash
    bun install
    cd src/utils/google-flights-scraper
    bun install
    cd ../../..
    ```
4.  Initialize the database (if empty): The application automatically imports data from CSV files in `fixtures/` into the SQLite database (`db/travel-stipend.db`) on first run if tables are empty.
5.  Install Deno Deploy CLI (optional, for manual deployment script):
    ```bash
    deno install -A --no-check -r -f https://deno.land/x/deploy/deployctl.ts
    ```

## Input Data (Fixtures for Database)

The calculator relies on data stored in the SQLite database, initially populated from these CSV files in the `fixtures/` directory:

-   **`conferences.csv`**: Default conference data.
-   **`cost_of_living.csv`**: Cost-of-living indices relative to a baseline (e.g., Seoul=1.0).
-   **`coordinates.csv`**: Latitude and longitude for cities.
-   **`taxis.csv`**: Base fare and per-kilometer taxi costs for cities.

## Configuration

Key calculation parameters are defined as constants in `src/utils/constants.ts`:

-   `ORIGIN`: Default origin city (can be overridden).
-   `COST_PER_KM`: Fallback cost per kilometer if flight scraping fails (currently fallback is $0).
-   `BASE_LODGING_PER_NIGHT`: Base rate before CoL adjustment.
-   `BASE_MEALS_PER_DAY`: Base rate for basic meals before CoL adjustment.
-   `BASE_LOCAL_TRANSPORT_PER_DAY`: Base rate used if taxi data is unavailable.
-   `BUSINESS_ENTERTAINMENT_PER_DAY`: Additional daily allowance for business meals/entertainment.
-   `PRE_CONFERENCE_DAYS`, `POST_CONFERENCE_DAYS`: Default buffer days for travel.
-   `DEFAULT_TICKET_PRICE`: Used if ticket price is not provided.
-   `WEEKEND_RATE_MULTIPLIER`: Factor applied to lodging on weekend nights.
-   `INTERNET_DATA_ALLOWANCE_PER_DAY`, `INCIDENTALS_ALLOWANCE_PER_DAY`: Daily allowances.

## Usage

There are three main ways to use the calculator:

### 1. Web Interface (Recommended)

A simple web UI allows triggering calculations via GitHub Actions. This is the recommended way for most users as it leverages the robust backend environment provided by Actions.

**Architecture:**

1.  **Static UI:** The HTML, CSS, and JS files in the `ui/` directory are served as static assets. These can be hosted on any static hosting provider (GitHub Pages, Netlify, Vercel, Cloudflare Pages, etc.).
2.  **Proxy Function:** A serverless function (example provided in `api/trigger-workflow.ts` for Deno Deploy) acts as a secure proxy. It receives calculation requests from the UI and uses the GitHub API to trigger the `batch-travel-stipend.yml` workflow via `workflow_dispatch`.
3.  **GitHub Actions Workflow:** The `batch-travel-stipend.yml` workflow runs the actual calculation using the inputs provided by the proxy function. Results are available in the Actions tab of the repository and as uploaded artifacts.

**Setup:**

1.  **Deploy Static UI:** Host the contents of the `ui/` directory (specifically `index.html`, `style.css`, and the compiled `script.js`) on a static hosting provider. You'll need to compile the script first:
    ```bash
    bun run build:ui
    # Now deploy the ui/ directory contents
    ```
2.  **Create GitHub App:** (Recommended over PAT)
    *   Go to your GitHub Settings -> Developer settings -> GitHub Apps -> New GitHub App.
    *   Give it a name (e.g., "Travel Stipend Trigger").
    *   Set Homepage URL (can be your repository URL).
    *   **Disable Webhook.**
    *   **Permissions:** Under "Repository permissions", grant `Actions: Read & write`.
    *   **Installation:** Choose "Only on this account" or select specific repositories.
    *   Click "Create GitHub App".
    *   On the app's page, **generate a private key** (.pem file) and download it. Store this securely. **Do not commit this file to Git.** Add `keys/` or the specific `.pem` filename to your `.gitignore`.
    *   **Install the App:** Install the app on the account/organization containing your `travel-stipend` repository. During installation, note the **Installation ID** (visible in the URL after installing, e.g., `.../installations/12345678`).
    *   Note your **App ID** from the app's settings page.
3.  **Deploy Proxy Function:**
    *   Choose a serverless platform. **Deno Deploy** is a good option as the proxy function (`api/trigger-workflow.ts`) is written for the Deno runtime. Alternatively, adapt the script for Node.js/Bun if using platforms like Vercel or Netlify Functions.
    *   **Deploying to Deno Deploy (Recommended):**
        1.  Go to [dash.deno.com](https://dash.deno.com/) and create a new project.
        2.  Link the project to your GitHub repository (`0x4007/travel-stipend`).
        3.  Select the branch to deploy from (e.g., `main`).
        4.  Set the **Entry point** to `api/trigger-workflow.ts`.
        5.  Go to the project's **Settings** -> **Environment Variables**.
        6.  Add the following **secrets**:
            *   `GITHUB_APP_ID`: Your App ID (`975031`).
            *   `GITHUB_APP_INSTALLATION_ID`: Your Installation ID (`60991083`).
            *   `GITHUB_APP_PRIVATE_KEY`: Paste the **entire content** of your `.pem` private key file.
            *   `GITHUB_OWNER`: Your GitHub username or organization (`0x4007`).
            *   `GITHUB_REPO`: The repository name (`travel-stipend`).
            *   `WORKFLOW_ID`: The workflow filename (`batch-travel-stipend.yml`).
        7.  Deno Deploy will automatically build and deploy upon pushes to the selected branch, OR you can use the manual deployment script (see below).
    *   **Manual Deployment using `deployctl` (Optional):**
        1.  Ensure `deployctl` is installed (see Setup section).
        2.  Create a Deno Deploy access token at [dash.deno.com/account/access-tokens](https://dash.deno.com/account/access-tokens).
        3.  Set the required environment variables locally:
            ```bash
            export DENO_DEPLOY_TOKEN="your_deno_deploy_token"
            export DENO_DEPLOY_PROJECT="your-deno-project-name" # The name of your project on Deno Deploy
            # Ensure GITHUB_APP_* secrets are set in the Deno Deploy dashboard first!
            ```
        4.  Run the deployment script:
            ```bash
            bun run deploy:proxy
            ```
    *   **Deploying to Other Platforms:** You would need to adapt `api/trigger-workflow.ts` to use Node.js APIs (e.g., using `node-fetch`, a JWT library like `jsonwebtoken`, and a server framework like Express or Fastify) and configure the same environment variables on that platform.
    *   Note the **URL** of your deployed proxy function (e.g., `your-project-name.deno.dev`).
4.  **Update UI Script:** Modify the `proxyApiUrl` constant in `ui/script.ts` to point to the URL of your deployed proxy function. Re-compile using `bun run build:ui` and re-deploy the static UI.

**Using the UI:**

1.  Navigate to the URL where you deployed the static UI.
2.  Fill in the form and click "Calculate Stipend".
3.  A status message will indicate if the workflow was triggered successfully.
4.  Go to the "Actions" tab in your GitHub repository (`https://github.com/0x4007/travel-stipend/actions`) to monitor the workflow run and view the results/artifacts.

### 2. Command Line Interface (CLI)

Use `bun src/travel-stipend-cli.ts` for single trip calculations directly on your local machine. This requires the full setup (Bun, Node, submodules, dependencies).

**Required Arguments:**

-   `--origin <city>`: Origin city (e.g., 'seoul')
-   `--destination <city>`: Destination city (e.g., 'singapore')
-   `--departure-date <date>`: Departure date (flexible format, e.g., '15 april', '2025-09-18')
-   `--return-date <date>`: Return date (flexible format)

**Optional Arguments:**

-   `--buffer-before <days>`: Override default pre-conference buffer days.
-   `--buffer-after <days>`: Override default post-conference buffer days.
-   `--ticket-price <price>`: Specify event ticket price.
-   `-o, --output <format>`: Output format (`json`, `csv`, `table` - default: `table`).
-   `-v, --verbose`: Show detailed debug logging.

**Examples:**

```bash
# Basic calculation (Seoul to Singapore)
bun run src/travel-stipend-cli.ts \
  --origin seoul \
  --destination singapore \
  --departure-date "17 Sep" \
  --return-date "20 Sep"

# Calculation with ticket price and JSON output
bun run src/travel-stipend-cli.ts \
  --origin seoul \
  --destination "san francisco" \
  --departure-date "Oct 28" \
  --return-date "Oct 31" \
  --ticket-price 1300 \
  -o json
```

### 3. Batch Processing via GitHub Actions (Directly)

The `.github/workflows/batch-travel-stipend.yml` workflow handles batch calculations automatically or manually within GitHub.

-   **On Push:** Reads trip data from `.github/test-events.json` and runs calculations for each entry.
-   **Manual Trigger (`workflow_dispatch`):** Allows specifying lists of origins, destinations, dates, and prices via GitHub UI inputs.

The workflow generates individual JSON results for each calculation, uploads them as artifacts, downloads them in a consolidation job, and runs `.github/scripts/consolidate-stipend-results.ts` to produce:
    -   `consolidated-results.md`: A Markdown summary report (also uploaded as `travel-stipend-results`).
    -   `consolidated-results/results.json`: Combined JSON output.
    -   `consolidated-results/results.csv`: Combined CSV output.

## Output Example (JSON - Single Trip)

```json
{
  "conference": "Conference in singapore",
  "origin": "seoul",
  "destination": "singapore",
  "conference_start": "Sep 18",
  "conference_end": "Sep 19",
  "flight_departure": "17 September",
  "flight_return": "20 September",
  "flight_cost": 347,
  "flight_price_source": "Google Flights",
  "lodging_cost": 450,
  "basic_meals_cost": 210.15,
  "business_entertainment_cost": 140.1,
  "local_transport_cost": 140,
  "ticket_price": 599,
  "internet_data_allowance": 20,
  "incidentals_allowance": 100,
  "total_stipend": 1656.25,
  "meals_cost": 350.25
}
```

## Extending the Calculator

-   **Adding/Updating Cities/Data**: Modify the CSV files in `fixtures/` (`coordinates.csv`, `cost_of_living.csv`, `taxis.csv`, `conferences.csv`). You may need to clear the database (`db/travel-stipend.db`) or implement specific update scripts for changes to take effect on subsequent runs.
-   **Adjusting Constants**: Modify values in `src/utils/constants.ts`.

## License

MIT
