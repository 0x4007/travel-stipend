# System Patterns: Travel Stipend Calculator

## Architecture Overview

The Travel Stipend Calculator follows a modular, functional architecture with clear separation of concerns. The system is organized around core calculation functions that process input data through a pipeline of transformations.

```mermaid
flowchart TD
    Input[CSV Input] --> Parser[CSV Parser]
    Parser --> Filter[Filter Upcoming Conferences]
    Filter --> Calculator[Stipend Calculator]
    Calculator --> Output[CSV/Console Output]

    subgraph Utilities
        Distance[Distance Calculator]
        COL[Cost of Living Adjuster]
        Dates[Date Calculator]
        Flights[Flight Price Lookup]
        Transport[Local Transport Calculator]
    end

    Calculator --> Distance
    Calculator --> COL
    Calculator --> Dates
    Calculator --> Flights
    Calculator --> Transport

    subgraph Caching
        DistCache[Distance Cache]
        COLCache[Cost of Living Cache]
        CoordCache[Coordinates Cache]
        StipendCache[Stipend Cache]
        FlightCache[Flight Price Cache]
    end

    Distance <--> DistCache
    COL <--> COLCache
    Distance <--> CoordCache
    Calculator <--> StipendCache
    Flights <--> FlightCache
```

## Key Design Patterns

### 1. Functional Core, Imperative Shell

- **Core Calculation Logic**: Pure functions that transform input data into output data without side effects.
- **Imperative Shell**: Handles I/O operations, file reading/writing, and command-line interactions.

### 2. Caching Strategy

The application implements a persistent caching system to optimize performance:

- **Cache Classes**: Implemented as generic classes that can store any type of data.
- **Disk Persistence**: Caches are saved to JSON files for reuse between runs.
- **Hash-Based Keys**: Cache entries use hash keys generated from input parameters to ensure uniqueness.

```mermaid
classDiagram
    class PersistentCache~T~ {
        -Map~string, T~ cache
        -string filePath
        +constructor(filePath: string)
        +has(key: string): boolean
        +get(key: string): T | null
        +set(key: string, value: T): void
        +saveToDisk(): void
        +loadFromDisk(): void
    }
```

### 3. Data Transformation Pipeline

The application processes data through a series of transformations:

1. **Input Parsing**: CSV data is parsed into structured objects.
2. **Filtering**: Past conferences are filtered out.
3. **Enrichment**: Basic data is enriched with calculated fields.
4. **Calculation**: Core stipend calculations are performed.
5. **Formatting**: Results are formatted for output.

### 4. Fallback Strategy

The system implements fallback mechanisms for resilience:

- **Web Scraping → Zero Cost**: When Google Flights scraping fails (either throws an error or returns a null price), the `travel-stipend-calculator.ts` now catches the error or null result and sets the `flightCost` to `0`. **Note:** The previously documented distance-based fallback is currently **not** implemented in the main calculation path.
- **Exact City Match → Fuzzy Matching**: When exact city matches fail, the system uses fuzzy matching with similarity thresholds.

### 5. Configuration Constants

The application uses a centralized constants file for configuration:

- **Base Rates**: Standard rates for lodging, meals, and transportation.
- **Adjustment Factors**: Multipliers for weekends, business districts, etc.
- **Default Values**: Fallback values when data is missing.

### 6. Web Scraping Strategy

The Google Flights scraper implements a multi-approach strategy for web element selection:

- **Primary Selectors**: First attempt uses specific CSS selectors.
- **Fallback Approaches**: If primary selectors fail, tries alternative approaches.
- **Error Recovery**: Implements error handling and recovery mechanisms.

```mermaid
flowchart TD
    Initialize[Initialize Scraper] --> Navigate[Navigate to Google Flights]
    Navigate --> Currency[Set Currency to USD]
    Currency --> Search[Search Flights]
    Search --> Extract[Extract Prices]
    Extract --> Calculate[Calculate Average Price]

    subgraph "Error Handling"
        TryPrimary[Try Primary Selectors]
        TryFallback[Try Fallback Approaches]
        HandleError[Handle Errors]
    end

    Currency --> TryPrimary
    TryPrimary -- Fails --> TryFallback
    TryFallback -- Fails --> HandleError
```

## Component Relationships

### Core Calculator

The `calculateStipend` function is the central component that orchestrates the calculation process:

```mermaid
flowchart TD
    CalcStipend[calculateStipend] --> Distance[getDistanceKmFromCities]
    CalcStipend --> FlightCost[calculateFlightCostForConference]
    CalcStipend --> COL[getCostOfLivingFactor]
    CalcStipend --> DateCalc[calculateDateDiff]
    CalcStipend --> Transport[calculateLocalTransportCost]

    FlightCost --> Scraper[scrapeFlightPrice]
    %% FlightCost --> DistCalc[calculateFlightCost] %% Removed as distance fallback is not used here

    Distance --> Haversine[haversineDistance]
    Distance --> FindCity[findCityCoordinates]
    FindCity --> FuzzyMatch[findBestMatch]

    Scraper --> WebAutomation[Puppeteer Browser Automation]
```

### Data Flow

```mermaid
flowchart LR
    CSV[CSV Files] --> Parser[CSV Parser]
    Parser --> Records[Conference Records]
    Records --> Calculator[Stipend Calculator]
    Calculator --> Results[Stipend Results]
    Results --> CSVOutput[CSV Output]
    Results --> ConsoleOutput[Console Table]
```

## Error Handling Strategy

The application implements a robust error handling approach:

1. **Try-Catch Blocks**:
    - The main calculation loop likely wraps individual conference processing (needs verification in CLI/batch processing code).
    - The `calculateFlightCostForConference` function now uses a `try...catch` block specifically for the `scrapeFlightPrice` call.
2. **Graceful Degradation**:
    - **Flight Scraping:** On failure, the flight cost defaults to `0` instead of halting the calculation. The source is marked as "Scraping failed" or "Scraping returned null".
    - **City Matching:** Falls back to fuzzy matching if exact match fails.
3. **Error Logging**: Errors during flight scraping are logged to `console.error`. Other errors are logged with context.
4. **Multi-level Fallbacks**: The system primarily relies on the flight scraping fallback to `0` and the city matching fallback. The distance-based flight cost fallback is not currently active in the main calculation flow.

## Extension Points

The system is designed with several extension points:

1. **New Cost Factors**: Additional cost factors can be added to the stipend calculation.
2. **Alternative Data Sources**: The system can be extended to use different data sources for flights, coordinates, or cost of living.
3. **Output Formats**: New output formats can be added beyond CSV and console table.
4. **Sorting Options**: The command-line interface supports adding new sorting options.
5. **Scraper Enhancements**: The web scraper can be extended with new selection strategies and UI interaction patterns.
