# Travel Stipend CLI

A command-line tool for calculating travel stipends for employees attending conferences or business trips.

## Features

- Calculate travel stipends for single destinations
- Batch process multiple conferences
- Real-time flight pricing with Google Flights
- Fallback to distance-based calculation when flight pricing is unavailable
- Support for simple city names (e.g., "dubai") or full format (e.g., "Dubai, AE")
- Adjusts for cost of living differences between cities
- Accounts for lodging, meals, local transportation, and incidentals

## Usage

```bash
# Basic usage with city name
bun run src/travel-stipend-cli.ts "Dubai" --start-date "1 april"

# With optional conference name and other details
bun run src/travel-stipend-cli.ts "Tokyo, JP" --conference "TechSummit" --start-date "10 may" --end-date "12 may"

# Using output formats (table, json, csv)
bun run src/travel-stipend-cli.ts "Singapore" --start-date "15 june" -o json

# Batch mode for all conferences
bun run src/travel-stipend-cli.ts --batch
```

## Options

| Option | Description |
|--------|-------------|
| `[location]` | Destination location (positional argument) |
| `-c, --conference <name>` | Conference name (optional) |
| `--start-date <date>` | Conference start date (required for single mode) |
| `--end-date <date>` | Conference end date (defaults to start date) |
| `--ticket-price <price>` | Conference ticket price (defaults to standard price) |
| `-o, --output <format>` | Output format: json, csv, table (default: table) |
| `-b, --batch` | Process all upcoming conferences (batch mode) |
| `--sort <field>` | Sort results by field (for batch mode) |
| `-r, --reverse` | Reverse sort order |
| `-v, --verbose` | Show detailed output including flight pricing info |

## Architecture

This CLI implements multiple strategies for flight pricing:

1. **Google Flights Strategy** - Used in single destination mode
   - Scrapes real-time pricing information from Google Flights
   - Most accurate for immediate calculations

2. **Hybrid Strategy** - Used in batch mode
   - Combines Amadeus API and distance-based calculation
   - More efficient for batch processing

3. **Distance-based Strategy** - Fallback option
   - Calculates flight costs based on distance and regional factors
   - Used when other strategies are unavailable

## Recent Improvements

- **Destination Validation**: Now accepts simple city names like "dubai" without requiring country codes
- **Database Handling**: Fixed path issues for CSV imports, with fallbacks to multiple locations
- **Configuration**: Added more seed data for common cities to work without CSV files
- **Error Handling**: Improved error messaging and graceful fallbacks
- **End Date Calculation**: Fixed end date display in output for multi-day conferences
- **Documentation**: Added detailed help text with examples

## Environment Variables

The application uses the following environment variables:

- `AMADEUS_API_KEY` - Amadeus API key for flight pricing
- `AMADEUS_API_SECRET` - Amadeus API secret

These variables are automatically loaded from the `.env` file by Bun.
