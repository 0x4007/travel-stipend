# Technical Context: Travel Stipend Calculator

## Technology Stack

### Core Technologies

- **TypeScript**: The entire application is written in TypeScript.
- **Bun**: Preferred runtime for local development, CLI execution, testing, and building the UI.
- **Node.js**: Supported runtime environment (v20.10+).
- **Deno**: Runtime for the deployed proxy function (`api/trigger-workflow.ts`) on platforms like Deno Deploy.

### Key Dependencies

#### Runtime Dependencies (Main Application & Local Proxy)

- **sqlite**: SQLite database driver wrapper.
- **sqlite3**: Native SQLite bindings (required by `sqlite`).
- **puppeteer**: Headless browser automation for flight scraping.
- **puppeteer-extra** & **puppeteer-extra-plugin-stealth**: Used by scraper.
- **jsonwebtoken**: Used by the *local* proxy (`api/trigger-workflow.ts` when run via `bun run start:proxy`) for signing GitHub App JWTs.
- **dotenv**: Loads `.env` file for local proxy testing.
- Various utility libraries (`csv-parse`, `city-timezones`, etc.) for data handling.

#### Runtime Dependencies (Deployed Proxy - Deno)

- **Deno Standard Library:**
    - `std/http/server`: For creating the HTTP server.
    - `std/http/file_server`: For serving static UI files.
    - `std/path`: For path manipulation.
    - `std/crypto`: For Web Crypto API used in JWT signing.
- **djwt (`deno.land/x/djwt`):** For creating and verifying JWTs (used for GitHub App auth).

#### Development Dependencies

- **typescript**: TypeScript compiler.
- **bun-types**: Types for Bun runtime.
- **@types/***: Type definitions for various libraries.
- **eslint**, **prettier**, **cspell**: Linting, formatting, and spell checking.
- **jest**: Testing framework.
- **husky**, **lint-staged**, **commitlint**: Git hooks and commit message linting.

## Development Environment

### Required Tools

- **Bun**: v1.0.0+ (Recommended for running scripts).
- **Node.js**: v20.10.0+ (Optional, if not using Bun).
- **Git**: For version control and submodules.
- **Deno**: Required if deploying/testing the proxy function locally using Deno runtime.
- **openssl**: Required if needing to convert GitHub App private key format.

### Project Structure

```
travel-stipend/
├── .github/
│   ├── workflows/
│   │   ├── batch-travel-stipend.yml  # Main calculation workflow
│   │   └── test.yml                # Test workflow
│   ├── scripts/
│   │   └── consolidate-stipend-results.ts # Script for consolidating results in Actions
│   └── test-events.json            # Default events for push trigger
├── api/
│   └── trigger-workflow.ts         # Proxy function (Deno runtime for deployment)
├── db/
│   └── travel-stipend.db           # SQLite database file
├── docs/                           # Project documentation
├── fixtures/                       # Initial data for DB and cache
│   ├── *.csv                       # CSV files for DB import
│   └── cache/                      # Persistent JSON cache storage
├── keys/                           # (Ignored by Git) Private keys, e.g., GitHub App .pem
├── node_modules/                   # Node.js dependencies (managed by Bun)
├── scripts/                        # Utility and helper scripts
│   ├── convert-key-to-pkcs8.sh     # Converts PEM key format
│   └── ...
├── src/                            # Main application source code
│   ├── utils/
│   │   ├── google-flights-scraper/ # Git submodule for scraper logic
│   │   ├── cache.ts                # Caching logic
│   │   ├── constants.ts            # Base rates and config
│   │   ├── database.ts             # SQLite service
│   │   ├── flights.ts              # Flight scraping adapter
│   │   └── ...                     # Other utilities (dates, cost-of-living, etc.)
│   ├── travel-stipend-calculator.ts # Core calculation logic
│   ├── travel-stipend-cli.ts        # Command-line interface entry point
│   └── types.ts                    # Shared TypeScript types
├── tests/                          # Test files
├── ui/                             # Static Web UI files
│   ├── index.html
│   ├── style.css
│   ├── script.ts                   # Frontend TypeScript source
│   └── script.js                   # Compiled frontend JavaScript
├── .env                            # (Ignored by Git) Local environment variables for proxy testing
├── .gitignore
├── package.json                    # Project manifest, scripts, dependencies
├── README.md                       # Main project documentation
└── tsconfig.json                   # TypeScript configuration
```

### Build System

- **UI Build**: `bun run build:ui` compiles `ui/script.ts` to `ui/script.js`. This is needed before deploying the static UI or running the local proxy server.
- **No Backend Build**: The core calculator logic (`src/`) and the proxy (`api/`) are run directly using Bun or Deno from their TypeScript source.

### Testing Strategy

- **Unit Tests**: Using Jest via `bun test`. Tests cover utility functions and core calculation logic.
- **Integration Tests**: Limited; primarily tested via GitHub Actions workflow runs.
- **Test Data**: Uses data from `fixtures/` and `.github/test-events.json`.

## Data Sources and Formats

### Input Data

- **Reference Data (SQLite DB):** Populated from `fixtures/*.csv` (conferences, cost-of-living, coordinates, taxis). Accessed during calculations.
- **Calculation Parameters:** Provided via:
    - CLI arguments (`src/travel-stipend-cli.ts`).
    - GitHub Actions `workflow_dispatch` inputs (triggered by UI via proxy).
    - Hardcoded test data (`.github/test-events.json`) for Actions `push` trigger.

### Output Data

- **CLI:** JSON, CSV, or formatted console table.
- **GitHub Actions:**
    - Individual calculation results (JSON) as job artifacts.
    - Consolidated results (Markdown, JSON, CSV) as workflow artifacts (`travel-stipend-results`).
- **Web UI:** Displays results table pushed via WebSocket from the proxy after receiving callback from GitHub Actions.

## Flight Price Lookup (Google Flights Scraper)

- **Implementation:** Uses Puppeteer via a Git submodule (`src/utils/google-flights-scraper/`). An adapter (`src/utils/flights.ts`) integrates it into the main application.
- **Execution:** Primarily runs within the GitHub Actions environment.
- **Fallback:** Defaults to `$0` flight cost if scraping fails or returns no price.

## Proxy Function (`api/trigger-workflow.ts`)

- **Purpose:** Acts as a secure intermediary between the static Web UI and the GitHub API to trigger the calculation workflow. Serves the static UI files when deployed on Deno Deploy.
- **Runtime:** Deno (intended for Deno Deploy). A Bun/Node compatible version is used for local testing via `bun run start:proxy`.
- **Authentication:** Uses GitHub App credentials (App ID, Installation ID, Private Key) read from environment variables to generate JWTs and obtain installation tokens for API calls.
- **Workflow Trigger:** Calls the GitHub API `workflow_dispatch` endpoint.
- **Result Callback:** Includes an endpoint (`/api/workflow-complete`) for the GitHub Action to POST results back, which are then relayed to the correct UI client via WebSocket. Requires a shared secret (`CALLBACK_SECRET`) for authentication.

## Technical Constraints

1.  **Deployment:** The full application (with SQLite and Puppeteer) runs best in an environment like GitHub Actions or a container/VM. The proxy function is designed for serverless (Deno Deploy).
2.  **Scraper Reliability:** Google Flights UI changes can break the scraper. Error handling and fallbacks are crucial.
3.  **Data Accuracy:** Reference data (CoL, taxis) needs periodic updates. Flight prices are volatile.
4.  **Security:** GitHub App credentials and the callback secret must be stored securely as environment variables/secrets. Private keys should never be committed to Git.

## Configuration Parameters

Constants defined in `src/utils/constants.ts` control base rates, allowances, buffer days, etc.

## Execution

See the main `README.md` for detailed usage instructions for the Web UI, CLI, and GitHub Actions.
