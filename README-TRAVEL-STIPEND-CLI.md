# Travel Stipend CLI

A command-line interface for calculating travel stipends for conferences and events. This utility provides both single-calculation and batch processing modes, with optimized flight pricing strategies for each scenario.

## Features

- **Single Mode**: Calculate stipend for a specific destination with detailed flight pricing using Google Flights data when available
- **Batch Mode**: Process multiple conferences efficiently using a hybrid pricing model
- **Multiple Output Formats**: Export results as tables, JSON, or CSV
- **Sorting and Filtering**: Sort results by any field
- **Flight Price Calculation Strategies**:
  - Google Flights scraping for single destinations
  - Hybrid strategy (Amadeus API + distance-based calculation) for batch processing
  - Automatic fallback to distance-based calculation when APIs are unavailable

## Installation & Setup

1. Make sure you have the required dependencies:
   ```
   bun install
   ```

2. Make the CLI script executable:
   ```
   chmod +x src/travel-stipend-cli.ts
   ```

## Usage

The CLI must be run from the project root directory using `bun run`:

```bash
# Show help and all available options
bun run src/travel-stipend-cli.ts --help
```

### Single Destination Mode

For single destination mode, you MUST include all three required parameters:
- `-s, --single` - The destination location
- `-c, --conference` - The conference name
- `--start-date` - The conference start date

```bash
# Minimal example with required parameters
bun run src/travel-stipend-cli.ts -s "Singapore, Singapore" -c "DevCon Asia 2025" --start-date "15 April"

# Complete example with all optional parameters
bun run src/travel-stipend-cli.ts \
  -s "Singapore, Singapore" \
  -c "DevCon Asia 2025" \
  --start-date "15 April" \
  --end-date "18 April" \
  --ticket-price 550 \
  -o table \
  -v
```

Common errors:
```
# Missing required parameters
$ bun run src/travel-stipend-cli.ts --single "dubai"
Error: For single mode, you must provide location, conference name, and start date
```

### Batch Mode

For batch mode, simply use the `-b, --batch` flag:

```bash
# Process all upcoming conferences
bun run src/travel-stipend-cli.ts -b

# With output format and sorting
bun run src/travel-stipend-cli.ts -b --output json --sort total_stipend -r
```

## Command-Line Options

| Option | Description |
|--------|-------------|
| `-b, --batch` | Process all upcoming conferences (batch mode) |
| `-s, --single <location>` | Calculate stipend for a single location |
| `-c, --conference <name>` | Conference name (required for single mode) |
| `--start-date <date>` | Conference start date (required for single mode) |
| `--end-date <date>` | Conference end date (defaults to start date) |
| `--ticket-price <price>` | Conference ticket price (defaults to standard price) |
| `-o, --output <format>` | Output format: json, csv, table (default: table) |
| `--sort <field>` | Sort results by field (for batch mode) |
| `-r, --reverse` | Reverse sort order |
| `-v, --verbose` | Show detailed output including flight pricing info |
| `-h, --help` | Display help information |

## Architecture

The CLI uses a strategy pattern for flight pricing to optimize for different use cases:

1. **GoogleFlightsStrategy**: For single calculations, uses web scraping for the most accurate pricing
2. **HybridStrategy**: For batch processing, combines:
   - Amadeus API flight data
   - Distance-based price prediction
3. **StrategyFactory**: Creates the appropriate strategy based on the processing mode

## Output Formats

### Table (Default)

```
┌───┬──────────────────┬──────────────────────┬──────────┬──────────┬────────┬─────────┬─────────┬───────────┬────────┬──────────┐
│   │ conference       │ location             │ start    │ end      │ flight │ lodging │ meals   │ transport │ ticket │ total    │
├───┼──────────────────┼──────────────────────┼──────────┼──────────┼────────┼─────────┼─────────┼───────────┼────────┼──────────┤
│ 0 │ DevCon Asia 2025 │ Singapore, Singapore │ 15 April │ 18 April │ $350   │ $1034   │ $816.25 │ $210      │ $550   │ $3105.25 │
└───┴──────────────────┴──────────────────────┴──────────┴──────────┴────────┴─────────┴─────────┴───────────┴────────┴──────────┘
```

### JSON

```json
[
  {
    "conference": "DevCon Asia 2025",
    "location": "Singapore, Singapore",
    "conference_start": "15 April",
    "conference_end": "18 April",
    "flight_departure": "14 April",
    "flight_return": "19 April",
    "distance_km": 4627.4,
    "flight_cost": 350,
    "flight_price_source": "Distance-based calculation",
    "lodging_cost": 1034,
    "meals_cost": 816.25,
    "local_transport_cost": 210,
    "ticket_price": 550,
    "total_stipend": 3105.25
  }
]
```

### CSV

Results are also saved to CSV files in the `outputs/` directory with timestamps for reference.

## Additional Notes

- The CLI handles dates in the format "DD Month" (e.g., "15 April")
- Output files are automatically saved to an `outputs/` directory
- The system automatically adjusts for weekends and international travel
- Cost of living factors are applied to adjust expenses based on destination
