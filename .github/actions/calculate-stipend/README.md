# Travel Stipend Calculator Action

This action calculates travel stipends for conferences and business trips.

## Features

- Calculates flight costs using Google Flights data
- Accounts for lodging costs with cost-of-living adjustments
- Includes meal and local transport allowances
- Enforces safe travel scheduling with buffer days
- Supports multi-day conferences

## Usage

```yaml
- uses: org/travel-stipend-action@v1
  with:
    # Required: Destination location
    location: "Singapore, SG"

    # Required: Conference start date
    conference_start: "20 May 2025"

    # Optional: Conference end date (defaults to start date)
    conference_end: "22 May 2025"

    # Optional: Conference name
    conference_name: "TechConf 2025"

    # Optional: Buffer days for travel (defaults: 1 day before/after)
    days_before: 2
    days_after: 1

    # Optional: Conference ticket price
    ticket_price: 750
```

## Outputs

- `stipend`: JSON object containing the complete stipend breakdown