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

### Command Line Interface (CLI)

Use `bun src/travel-stipend-cli.ts` for single trip calculations.

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

### Web Interface (Development)

A simple web UI is available for interactive calculations during development.

1.  **Start the UI Server:**
    -   For development (with watching for server changes):
        ```bash
        bun run ui:dev
        ```
        This command first compiles the UI script (`ui/script.ts` to `ui/script.js`) and then runs the API server (`ui/api.ts`) with `--watch`. Note: Changes to `ui/script.ts` still require restarting the command to re-compile the frontend.
    -   To run without watching:
        ```bash
        bun run start:ui
        ```
        This compiles the UI script once and then starts the API server.

2.  **Open in Browser:** Navigate to `http://localhost:3000` in your web browser.

3.  **Use the Form:** Enter the origin, destination, dates, and optional ticket price, then click "Calculate Stipend". The JSON result will be displayed below the form.

### Batch Processing (GitHub Actions)

The `.github/workflows/batch-travel-stipend.yml` workflow handles batch calculations.

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
