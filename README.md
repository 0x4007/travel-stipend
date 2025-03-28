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
-   **Web UI Trigger**: A simple web interface (`ui/`) allows triggering the GitHub Actions workflow via a secure proxy function.

## Requirements

-   [Bun](https://bun.sh/) runtime (v1.0.0 or higher)
-   Node.js (v20.10.0 or higher, primarily for compatibility if Bun isn't used)
-   Git (for submodules and hooks)
-   [Deno](https://deno.land/) (if deploying the proxy function to Deno Deploy)
-   `openssl` command-line tool (if needing to convert private key format)

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
5.  Install Deno (if deploying proxy function): Ensure [Deno](https://deno.land/) is installed if you plan to deploy the proxy function to Deno Deploy.

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

1.  **Static UI & Proxy Function (Single Deployment):** The Deno Deploy function (`api/trigger-workflow.ts`) serves both the static UI files (`ui/`) and acts as a secure proxy to trigger the GitHub Actions workflow.
2.  **GitHub Actions Workflow:** The `batch-travel-stipend.yml` workflow runs the actual calculation using the inputs provided by the proxy function. Results are available in the Actions tab of the repository and as uploaded artifacts.

**Setup:**

1.  **Create GitHub App:** (Recommended over PAT)
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
    *   **Convert Private Key (If Necessary):** The proxy function expects the private key in unencrypted PKCS#8 PEM format (`-----BEGIN PRIVATE KEY-----`). Keys downloaded from GitHub should already be in this format. If your key starts with something else (like `-----BEGIN RSA PRIVATE KEY-----`), convert it using the provided script:
        ```bash
        # Ensure openssl is installed
        # Make the script executable
        chmod +x scripts/convert-key-to-pkcs8.sh
        # Run the script (uses keys/ubiquity-os.2025-03-28.private-key.pem by default)
        bun run convert:key
        # Or specify a different input key:
        # bun run convert:key path/to/your/original-key.pem
        ```
        This creates a new file ending in `_pkcs8.pem`. Use the content of **this new file** for the environment variable below.
2.  **Deploy to Deno Deploy:**
    1.  Go to [dash.deno.com](https://dash.deno.com/) and create a new project.
    2.  Link the project to your GitHub repository (`0x4007/travel-stipend`).
    3.  Select the branch to deploy from (e.g., `main`).
    4.  Set the **Entry point** to `api/trigger-workflow.ts`.
    5.  Go to the project's **Settings** -> **Environment Variables**.
    6.  Add the following **secrets**:
        *   `GITHUB_APP_ID`: Your App ID (`975031`).
        *   `GITHUB_APP_INSTALLATION_ID`: Your Installation ID (`60991083`).
        *   `GITHUB_APP_PRIVATE_KEY`: Paste the **entire content** of your **PKCS#8 formatted** `.pem` private key file (the original from GitHub or the converted `_pkcs8.pem` file).
        *   `GITHUB_OWNER`: Your GitHub username or organization (`0x4007`).
        *   `GITHUB_REPO`: The repository name (`travel-stipend`).
        *   `WORKFLOW_ID`: The workflow filename (`batch-travel-stipend.yml`).
        *   `CALLBACK_SECRET`: A strong, unique secret string you generate (e.g., using a password manager or `openssl rand -hex 32`). This is used to authenticate the callback from GitHub Actions to your proxy.
    7.  Deno Deploy will automatically build and deploy the `api/trigger-workflow.ts` function (which also serves the UI) upon pushes to the selected branch.
    *   Note the **URL** of your deployed project (e.g., `https://your-project-name.deno.dev`).
3.  **Configure GitHub Secrets:** Go to your `0x4007/travel-stipend` repository settings -> Secrets and variables -> Actions -> New repository secret. Add the following secrets:
    *   `PROXY_CALLBACK_URL`: The full URL of your deployed proxy function's callback endpoint (e.g., `https://your-project-name.deno.dev/api/workflow-complete`).
    *   `PROXY_CALLBACK_SECRET`: The same secret string you configured in Deno Deploy's environment variables.
4.  **Update UI Script (if needed):** The `proxyApiUrl` constant in `ui/script.ts` currently points to `/api/trigger-workflow` (a relative path). This works correctly when the UI and API are served from the same domain by Deno Deploy. Ensure the latest UI script is compiled (`bun run build:ui`) and included in your commit.

**Using the Deployed UI:**

1.  Navigate to the URL of your deployed Deno Deploy project (e.g., `https://your-project-name.deno.dev`).
2.  Fill in the form and click "Calculate Stipend".
3.  A status message will indicate if the workflow was triggered successfully. The UI will then wait for the results via WebSocket.
4.  Go to the **Actions** tab in your GitHub repository (`https://github.com/0x4007/travel-stipend/actions`) to monitor the workflow run.
5.  Once the workflow completes, the results should appear automatically in the UI table.

**Local Testing (UI + Proxy + Actions):**

It's possible to test the UI-to-Actions flow locally, but requires careful setup:

1.  **Create `.env` file:** In the project root, create a `.env` file (and add it to `.gitignore`). Populate it with the required secrets:
    ```dotenv
    # GitHub App Credentials
    GITHUB_APP_ID=975031
    GITHUB_APP_INSTALLATION_ID=60991083
    # Paste the *entire* content of your PKCS#8 .pem file below, replacing newlines with \n literal characters
    GITHUB_APP_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_KEY_LINE_1\nYOUR_KEY_LINE_2\n...\n-----END PRIVATE KEY-----\n"
    GITHUB_OWNER=0x4007
    GITHUB_REPO=travel-stipend
    WORKFLOW_ID=batch-travel-stipend.yml
    # Shared secret for Action->Proxy callback
    CALLBACK_SECRET="your_strong_random_secret_string"
    ```
    *Security Note:* Be extremely careful with the `.env` file and never commit it.
2.  **Run the Proxy Server:** Open a terminal and run:
    ```bash
    # This script uses Bun/Node APIs and requires the .env file
    bun run start:proxy
    ```
    This starts the local proxy server on `http://localhost:8000`. This server now *also* serves the static UI files from the `ui/` directory.
3.  **Compile UI:** Ensure the latest UI script is compiled:
    ```bash
    bun run build:ui
    ```
4.  **Configure UI:** Ensure `proxyApiUrl` in `ui/script.ts` points to `/api/trigger-workflow` (relative path for local testing when served by the same proxy). Re-compile if needed (`bun run build:ui`).
5.  **Test:** Open `http://localhost:8000` in your browser. The UI should load. Submitting the form hits the local proxy, which triggers the GitHub Action. The Action will run, and its final step will attempt to POST results back to `http://localhost:8000/api/workflow-complete` (using the `CALLBACK_SECRET` from `.env`). Check the proxy server's terminal logs, the UI, and the GitHub Actions tab for results. *Note: GitHub Actions runners might not be able to reach `localhost:8000`. Consider using a tool like ngrok to expose your local server for testing the callback.*

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
