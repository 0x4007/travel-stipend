# Project Brief: Travel Stipend Calculator

## Project Overview

The Travel Stipend Calculator is a TypeScript application designed to calculate fair travel stipends for employees attending conferences. It factors in variable travel expenses based on location, providing seed-stage startups with a standardized way to reimburse travel costs.

## Core Requirements

1. **Calculate comprehensive travel stipends** that include:

   - Flight costs based on distance or API lookup
   - Lodging costs adjusted by location's cost of living
   - Meal costs adjusted by location's cost of living
   - Local transportation costs
   - Conference ticket prices

2. **Support for multiple conferences** with the ability to:

   - Process a CSV of conference data
   - Filter for upcoming conferences
   - Sort results by different criteria

3. **Intelligent cost calculations** that account for:

   - Distance between cities using the Haversine formula
   - Cost-of-living adjustments for different locations
   - Weekend vs. weekday lodging rates
   - Pre and post-conference travel days

4. **Caching system** to:

   - Store previously calculated distances
   - Cache cost-of-living data
   - Save stipend calculations for reuse

5. **Flexible output options** including:
   - CSV export with timestamp and sort information
   - Console table display of results

## Technical Goals

1. **Modular design** with separate utility functions for:

   - Distance calculations
   - Cost-of-living adjustments
   - Date handling
   - Flight price lookups
   - Local transport cost calculations

2. **Data persistence** through JSON-based caching for:

   - Reducing redundant calculations
   - Improving performance for repeated queries
   - Storing historical data

3. **Configurable parameters** through constants for:

   - Base rates for lodging, meals, and transport
   - Cost per kilometer for flights
   - Pre and post-conference days
   - Weekend rate adjustments

4. **Robust error handling** to:
   - Gracefully handle missing data
   - Provide fallback calculations when APIs fail
   - Log errors without crashing the application

## Success Criteria

The Travel Stipend Calculator will be considered successful if it:

1. Accurately calculates fair stipends that reflect the true cost of travel to different locations
2. Processes conference data efficiently with appropriate caching
3. Provides clear, formatted output that can be used for budgeting and reimbursement
4. Handles edge cases gracefully (missing data, API failures, etc.)
5. Maintains a modular design that can be extended with new features
