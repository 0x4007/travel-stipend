# Travel Stipend Calculator

A TypeScript application that calculates fair travel stipends for conference trips, factoring in variable travel expenses based on location.

## Overview

This travel stipend calculator helps seed-stage startups provide fair travel stipends for employees attending conferences. It calculates stipends based on:

- **Flight Cost**: Calculated using a per-kilometer rate applied to the travel distance.
- **Lodging Cost**: Based on a standard per-night rate, adjusted by a cost-of-living multiplier.
- **Meals Cost**: Based on a standard per-day rate, adjusted by a cost-of-living multiplier.
- **Conference Ticket Price**: Manually input from CSV data.

## Features

- **Distance Calculation**: Uses the Haversine formula to calculate distances between cities based on their coordinates.
- **Cost-of-Living Adjustments**: Uses open-source data to adjust lodging and meal costs based on the destination's cost of living.
- **Date Calculations**: Automatically calculates the number of lodging nights and meal days based on conference start and end dates.
- **Modular Design**: Each calculation is encapsulated in its own function for easy maintenance and extensibility.

## Requirements

- [Bun](https://bun.sh/) runtime
- TypeScript

## Setup

1. Clone the repository
2. Install dependencies:
   ```
   bun install
   ```

## Input Files

The calculator requires two CSV files:

### 1. conferences.csv

Contains information about conferences:

```csv
Category,Start,End,Conference,Location,Description,Ticket Price
Tech,2025-03-15,2025-03-18,"DevCon 2025","San Francisco, USA","Annual Developer Conference",1200
```

Fields:
- **Category**: Type of conference (e.g., Tech, Blockchain)
- **Start**: Conference start date (YYYY-MM-DD)
- **End**: Conference end date (YYYY-MM-DD)
- **Conference**: Name of the conference
- **Location**: City and country
- **Description**: Brief description of the conference
- **Ticket Price**: Price of the conference ticket in USD

### 2. cost_of_living.csv

Contains cost-of-living indices for different locations:

```csv
Location,Index
"Seoul, Korea",1.0
"San Francisco, USA",1.5
```

Fields:
- **Location**: City and country
- **Index**: Cost-of-living index (1.0 is baseline)

## Configuration

The calculator uses several configuration constants that can be adjusted in the code:

- **ORIGIN**: Fixed origin for travel (default: "Seoul, Korea")
- **COST_PER_KM**: Cost per kilometer for flights (default: 0.2 USD)
- **BASE_LODGING_PER_NIGHT**: Base rate for lodging per night (default: 100 USD)
- **BASE_MEALS_PER_DAY**: Base rate for meals per day (default: 50 USD)

## Usage

Run the calculator with:

```
bun src/travel-stipend-calculator.ts
```

## Output

The calculator outputs a structured JSON object with a breakdown of costs for each conference:

```json
{
  "results": [
    {
      "conference": "DevCon 2025",
      "location": "San Francisco, USA",
      "distance_km": 9028.9,
      "flight_cost": 1805.78,
      "lodging_cost": 450,
      "meals_cost": 300,
      "ticket_price": 1200,
      "total_stipend": 3755.78
    }
  ]
}
```

## Extending the Calculator

### Adding New Cities

To add new cities, update the `cityCoordinates` object in the code with the city name and its latitude/longitude coordinates.

### Updating Cost-of-Living Data

To update cost-of-living data, modify the `cost_of_living.csv` file with new locations and indices.

## License

MIT
