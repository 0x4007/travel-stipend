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
- **serpapi**: API client for accessing flight price data.

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
├── fixtures/               # Input data files
│   ├── airport-codes.csv   # Airport code reference data
│   ├── conferences.csv     # Conference information
│   ├── coordinates.csv     # City coordinates
│   ├── cost_of_living.csv  # Cost of living indices
│   ├── taxis.csv           # Taxi fare data
│   └── cache/              # Persistent cache storage
├── src/                    # Source code
│   ├── utils/              # Utility functions
│   ├── travel-stipend-calculator.ts  # Main calculator
│   └── historical-stipend-calculator.ts  # Historical data processor
├── tests/                  # Test files
└── outputs/                # Generated output files (created at runtime)
```

### Build System

The project uses esbuild for fast compilation and bundling:

- **Development**: `bun build/esbuild-server.ts` - Runs the development server.
- **Production**: `bun build/esbuild-build.ts` - Creates optimized production build.

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

5. **airport-codes.csv**: Contains airport reference data:
   - IATA code: Three-letter airport code
   - City: Associated city
   - Country: Country location

### Output Data

1. **CSV Files**: Generated in the outputs directory with timestamp and sort information.
2. **Console Output**: Tabular display of stipend calculations.
3. **Cache Files**: JSON files storing calculation results for reuse.

## External Services

### Flight Price API

The application can use the SerpAPI service to look up flight prices:

- **API Key**: Required in .env file for authentication.
- **Endpoint**: Google Flights search via SerpAPI.
- **Fallback**: Distance-based calculation when API is unavailable.

## Technical Constraints

1. **Performance Considerations**:

   - Caching is essential for performance with large datasets.
   - API rate limits may affect flight price lookups.

2. **Data Accuracy**:

   - Cost-of-living data requires regular updates.
   - Flight prices are volatile and may change frequently.

3. **Error Handling**:

   - Must gracefully handle missing or malformed data.
   - Should provide fallbacks when external services fail.

4. **Scalability**:
   - Current design handles hundreds of conferences efficiently.
   - Larger datasets may require pagination or streaming.

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
export const DEFAULT_TICKET_PRICE = 1000;

// Weekend vs Weekday adjustments
export const WEEKEND_RATE_MULTIPLIER = 0.9;
```

These constants can be adjusted to reflect company policy or economic changes.

## Deployment and Execution

The application is designed to be run locally as a command-line tool:

```bash
# Run the calculator
bun src/travel-stipend-calculator.ts

# Run with sorting options
bun src/travel-stipend-calculator.ts --sort total_stipend --reverse
```

Results are saved to the outputs directory and displayed in the console.
