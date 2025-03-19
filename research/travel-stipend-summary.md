# Conference Travel Stipend Analysis Summary

## Original Task

- Verify expenses in a travel stipend CSV for conferences in 2024
- Identify discrepancies between stipend amounts and actual spending
- Suggest additional categories for corporate travel stipends

## Stipend CSV Data Analyzed

```csv
conference,location,conference_start,conference_end,flight_departure,flight_return,flight_cost,lodging_cost,basic_meals_cost,business_entertainment_cost,local_transport_cost,ticket_price,total_stipend
"Asia Blockchain Summit 2024 - Taipei","Taipei","6 August","8 August","2024-08-05","2024-08-09",296.82,440,225,300,75,0,1336.82
"Korea Blockchain Week 2024 - Seoul","Seoul","1 September","7 September","2024-08-31","2024-09-08",0,0,525,700,175,0,1400
"TOKEN2049 Singapore 2024","Singapore","18 September","19 September","2024-09-17","2024-09-20",935.63,264,180,200,57.52,599,2236.15
"GitHub Universe 2024 - San Francisco","San Francisco","29 October","30 October","2024-10-28","2024-10-31",2636.99,220,150,200,50,1300,4556.99
"Devcon 7 - Bangkok","Bangkok","12 November","15 November","2024-11-11","2024-11-16",744.67,660,300,400,100,284.76,2489.43
```

## Key Findings

### Stipend Algorithm Design

- Calculates expenses for conference dates plus one day before/after
- Uses Numbeo cost of living index for location-based adjustments
- Assumes economy flights from Korea to destinations
- Does not account for extended stays beyond conference +1 day

### Major Discrepancies Explained

1. **Taipei Lodging**: Higher actual cost ($2,228.08) due to extended stay beyond conference dates
2. **San Francisco Tickets**: The $2,636.99 was for two conference tickets, not flights
3. **Bangkok Flight**: Higher cost ($3,816) due to business class travel
4. **Meals vs. Entertainment**: Some large transactions (e.g., FENG DU JUAN $1,577.27) were business entertainment (company karaoke) not meals
5. **San Francisco Lodging**: Higher cost due to extended stay including Napa Valley trip

### Context-Specific Factors

- User paid for an assistant for all conferences except Taipei
- Some conference tickets may have been paid with cryptocurrency (not in transaction data)
- User sometimes flies business class for long international flights
- User often extends trips beyond conference dates for additional business purposes
- Some flights may originate from locations other than Korea, although this is rare

## Recommended Stipend Improvements

### Additional Categories

1. **Internet/Data Plans** - Standard allowance of $20-30 per international trip
2. **Incidentals Allowance** - $15-25/day for miscellaneous expenses

### Algorithm Refinements

1. **Duration-Based Scaling**:

   - Days 1-3: 100% of daily meal/entertainment allowance
   - Days 4+: 85% of daily allowance

2. **Improved Meal Allocation**:

   - Increase base meal allowance by 15-20% based on actual spending patterns

3. **Enhanced Location-Based Adjustments**:

   - Add 10-15% premium for high-cost conference districts

4. **Business Entertainment Guidelines**:
   - Consider per-person cap: "$100 per guest, maximum 3 guests per conference"

### Policy Clarifications

1. **Business Days Only** - Maintain conference +1 day model with clear documentation
2. **Economy-Only Flights** - Keep economy fare calculations with upgrade documentation
3. **Split Transaction Handling** - Guidelines for bills spanning business and personal days
