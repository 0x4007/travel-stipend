# Technical Context: Travel Stipend Calculator

## Technology Stack

### Core Technologies

- **TypeScript**: The entire application is written in TypeScript, providing type safety and modern JavaScript features.
- **Node.js**: Runtime environment for executing the application.
- **Bun**: Used as the preferred JavaScript/TypeScript runtime for improved performance.

### Key Dependencies

#### Runtime Dependencies

- **csv-parse**: Library for parsing CSV files into JavaScript objects.
- **dotenv**: Used for loading environment variables from .env files.
- **puppeteer**: Headless browser automation library used for web scraping.

#### Development Dependencies

- **esbuild**: Fast JavaScript bundler used for building the application.
- **eslint**: Static code analysis tool for identifying problematic patterns.
- **prettier**: Code formatter to ensure consistent code style.
- **typescript**: TypeScript compiler and language services.
- **jest**: Testing framework for unit and integration tests.
- **husky**: Git hooks to enforce code quality on commit.
- **cspell**: Spell checker for code and documentation.

## Development Environment

### Required Tools

- **Bun**: Version 1.0.0 or higher (specified in package.json engines).
- **Node.js**: Version 20.10.0 or higher (specified in package.json engines).
- **Git**: For version control and commit hooks.

### Project Structure

```
travel-stipend/
├── build/                  # Build configuration
│   ├── esbuild-build.ts    # Production build script
│   ├── esbuild-server.ts   # Development server
│   └── index.ts            # Entry point
├── db/                     # Database storage
│   └── travel-stipend.db   # SQLite database file
├── fixtures/               # Input data files
│   ├── airport-codes.csv   # Airport code reference data
│   ├── conferences.csv     # Conference information
│   ├── coordinates.csv     # City coordinates
│   ├── cost_of_living.csv  # Cost of living indices
│   ├── taxis.csv           # Taxi fare data
│   └── cache/              # Persistent cache storage
├── src/                    # Source code
│   ├── strategies/         # Flight pricing strategies
│   │   ├── google-flights-strategy.ts  # Google Flights strategy
│   │   ├── hybrid-strategy.ts      # Hybrid pricing strategy
│   │   └── flight-pricing-context.ts   # Strategy context
│   ├── utils/              # Utility functions
│   │   ├── google-flights-scraper/ # Google Flights scraper components
│   │   ├── database.ts     # Database service
│   │   ├── dates.ts        # Date handling utilities
│   │   └── conference-matcher.ts   # Conference fuzzy matching
│   ├── travel-stipend-calculator.ts  # Main calculator logic
│   ├── travel-stipend-cli.ts         # Command-line interface
│   └── historical-stipend-calculator.ts  # Historical data processor
├── tests/                  # Test files
└── outputs/                # Generated output files (created at runtime)
```

### Build System

The project uses esbuild for fast compilation and bundling:

- **Development**: `bun build/esbuild-server.ts` - Runs the development server.
- **Production**: `bun build/esbuild-build.ts` - Creates optimized production build.
- **CLI**: `bun src/travel-stipend-cli.ts [location] --conference-start <date>` - Run the CLI tool with various options.

### Testing Strategy

- **Unit Tests**: Test individual utility functions and calculations.
- **Integration Tests**: Test the end-to-end stipend calculation process.
- **Test Data**: Uses fixture data to ensure consistent test results.

## Data Sources and Formats

### Input Data

1. **conferences.csv**: Contains conference information with fields:

   - Category: Type of conference
   - Start: Conference start date
   - End: Conference end date
   - Conference: Name of the conference
   - Location: City and country
   - Ticket Price: Cost of conference ticket
   - Description: Brief description

2. **cost_of_living.csv**: Contains cost-of-living indices:

   - Location: City and country
   - Index: Cost-of-living index (1.0 is baseline)

3. **coordinates.csv**: Contains city coordinates:

   - City: City name
   - Latitude: Geographic latitude
   - Longitude: Geographic longitude

4. **taxis.csv**: Contains taxi fare information:
   - City: City name
   - Base Fare: Starting fare
   - Per KM: Cost per kilometer
   - Currency: Local currency

### Output Data

1. **CSV Files**: Generated in the outputs directory with timestamp and sort information, including flight price source.
2. **Console Output**: Tabular display of stipend calculations.
3. **Cache Files**: JSON files storing calculation results for reuse.

## Flight Price Lookup

### Google Flights Scraper

The application uses a custom Google Flights scraper to look up flight prices:

- **Web Scraping**: Uses Puppeteer to automate browser interactions with Google Flights.
- **Currency Selection**: Ensures USD currency for consistent pricing.
- **Price Averaging**: Calculates average price from top flights when multiple are available.
- **Headless Mode**: Runs in headless mode for better performance.
- **Fallback**: Distance-based calculation when scraping fails.

### Distance-Based Calculation

When scraping fails, the application falls back to a distance-based calculation:

- **Haversine Formula**: Calculates distance between cities using coordinates.
- **Multi-tier Pricing**: Different pricing tiers based on flight distance.
- **Regional Factors**: Adjusts prices based on regional flight patterns.
- **Popular Route Discounts**: Special pricing for common city pairs.

## Technical Constraints

1. **Performance Considerations**:

   - Caching is essential for performance with large datasets.
   - Web scraping can be slow for batch processing.

2. **Data Accuracy**:

   - Cost-of-living data requires regular updates.
   - Flight prices are volatile and may change frequently.
   - Web scraping reliability depends on Google Flights UI stability.

3. **Error Handling**:

   - Must gracefully handle missing or malformed data.
   - Should provide fallbacks when scraping fails.
   - Needs robust error recovery for web scraping.

4. **Scalability**:
   - Current design handles hundreds of conferences efficiently.
   - Larger datasets may require pagination or streaming.
   - Parallel scraping may be needed for very large datasets.

## Configuration Parameters

The application uses several configurable constants:

```typescript
// Fixed origin for travel
export const ORIGIN = "Seoul, Korea";

// Cost-per-kilometer rate (USD per km)
export const COST_PER_KM = 0.2;

// Base rates for accommodation and daily expenses
export const BASE_LODGING_PER_NIGHT = 200;
export const BASE_MEALS_PER_DAY = 60;
export const BASE_LOCAL_TRANSPORT_PER_DAY = 30;

// Business-specific allowances
export const BUSINESS_ENTERTAINMENT_PER_DAY = 80;

// Travel duration adjustments
export const PRE_CONFERENCE_DAYS = 1;
export const POST_CONFERENCE_DAYS = 1;

// Default ticket price when not provided
export const DEFAULT_TICKET_PRICE = 0;

// Weekend vs Weekday adjustments
export const WEEKEND_RATE_MULTIPLIER = 0.9;
```

These constants can be adjusted to reflect company policy or economic changes.

## Deployment and Execution

The application is designed to be run locally as a command-line tool:

```bash
# Basic usage with new parameter names
bun src/travel-stipend-cli.ts "Singapore" --conference-start "15 April"

# Customize travel buffer days (arrive 2 days before, leave 2 days after)
bun src/travel-stipend-cli.ts "Tokyo" --conference-start "20 May" --days-before 2 --days-after 2

# Multi-day conference with ticket price
bun src/travel-stipend-cli.ts "Barcelona" -c "MobileConf 2025" --conference-start "10 June" --conference-end "12 June" --ticket-price 750

# Batch mode for all upcoming conferences
bun src/travel-stipend-cli.ts -b

# Batch mode with sorting and custom output format
bun src/travel-stipend-cli.ts -b --sort total_stipend -r -o csv
```

Results are displayed in the console and saved to the outputs directory with timestamped filenames.
