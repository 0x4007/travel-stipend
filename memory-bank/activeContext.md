# Active Context: Travel Stipend Calculator

## Current Status

The Travel Stipend Calculator is a functional TypeScript application that calculates fair travel stipends for conference trips. The application is currently in a stable state with core functionality implemented.

## Recent Work

The most recent development has focused on:

1. **Implementing the core stipend calculation logic** that factors in:

   - Flight costs (via API lookup or distance-based calculation)
   - Lodging costs adjusted by location's cost of living
   - Meal costs with basic and business entertainment components
   - Local transportation costs based on taxi data
   - Conference ticket prices

2. **Building a robust caching system** to improve performance:

   - Distance cache to avoid recalculating distances
   - Cost-of-living cache for frequently accessed locations
   - Coordinates cache for city location data
   - Stipend cache for complete calculation results

3. **Adding command-line options** for sorting and filtering results:

   - Sort by any column in the output
   - Reverse sort order option
   - Filtering for upcoming conferences

4. **Implementing fallback mechanisms** for resilience:
   - Distance-based flight cost calculation when API lookup fails
   - Fuzzy matching for city names when exact matches aren't found

5. **Improving the Google Flights scraper**:
   - Fixed USD currency selection in the currency dialog
   - Implemented multiple approaches to find and select USD currency
   - Added better error handling and logging
   - Improved code organization and reduced cognitive complexity

## Current Focus

The current development focus is on:

1. **Refining the flight price lookup** to provide more accurate estimates:

   - Improving API integration with SerpAPI
   - Handling edge cases for less common destinations
   - Optimizing API usage to stay within rate limits
   - Enhancing the Google Flights scraper reliability

2. **Enhancing the cost-of-living adjustments** for better accuracy:

   - Expanding the cost_of_living.csv dataset
   - Implementing more nuanced adjustments for different expense types

3. **Improving the output formats** for better usability:
   - Enhanced CSV output with more detailed breakdowns
   - Potential for additional output formats (JSON, HTML)

## Active Decisions

Several key decisions are currently being considered:

1. **Origin City Configuration**:

   - Currently hardcoded as "Seoul, Korea" in constants
   - Considering making this a command-line parameter
   - Potential for supporting multiple origin cities

2. **Cost Adjustment Factors**:

   - Evaluating the current weekend rate multiplier (0.9)
   - Considering seasonal adjustments for high/low travel seasons
   - Exploring additional factors like conference popularity

3. **Historical Data Analysis**:
   - Exploring ways to leverage historical stipend data
   - Considering trend analysis for budget forecasting
   - Potential for machine learning to improve estimates

4. **Web Scraping Strategy**:
   - Evaluating the multi-approach strategy for web element selection
   - Considering more robust selectors for different UI patterns
   - Balancing between specific and generic selectors

## Known Issues

Current known issues that need attention:

1. **City Name Matching**:

   - Some edge cases where fuzzy matching fails to find the correct city
   - Need for more robust city name normalization

2. **Flight Price Volatility**:

   - Flight prices from API can vary significantly
   - Need for strategies to handle price fluctuations

3. **Currency Conversion**:
   - All calculations currently in USD
   - Need for handling multiple currencies

## Next Steps

The immediate next steps for development are:

1. **Expand Test Coverage**:

   - Add more unit tests for utility functions
   - Create integration tests for end-to-end calculation
   - Test edge cases and error handling
   - Add more comprehensive tests for the Google Flights scraper

2. **Improve Documentation**:

   - Add more detailed comments to complex functions
   - Create comprehensive README with examples
   - Document configuration options
   - Document the web scraping strategies

3. **Enhance Data Validation**:

   - Add validation for input CSV files
   - Implement better error messages for malformed data
   - Create data integrity checks

4. **Optimize Performance**:

   - Profile the application to identify bottlenecks
   - Improve caching strategies
   - Consider parallel processing for batch calculations

5. **User Experience Improvements**:
   - Add progress indicators for long-running calculations
   - Improve error reporting
   - Enhance console output formatting
