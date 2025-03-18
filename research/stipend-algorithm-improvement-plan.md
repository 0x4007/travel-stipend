# Travel Stipend Algorithm Improvement Plan

## Context and Background

The current travel stipend calculator determines appropriate stipend amounts for employees attending conferences. Based on analysis of actual spending vs. stipend amounts for five conferences in 2024, several patterns of discrepancies have been identified that can be addressed through algorithm improvements.

### Current Algorithm Design
- Calculates expenses for conference dates plus one day before/after
- Uses Numbeo cost of living index for location-based adjustments
- Assumes economy flights from Korea to destinations
- Provides allowances for lodging, meals, business entertainment, local transport, and tickets

### Key Business Rules
- Only compensate for business days (conference days + 1 day before/after)
- Economy flights only (employee pays difference for upgrades)
- No seasonal adjustments

## Data Analysis Summary

### Conferences Analyzed
```csv
conference,location,conference_start,conference_end,flight_departure,flight_return,flight_cost,lodging_cost,basic_meals_cost,business_entertainment_cost,local_transport_cost,ticket_price,total_stipend
"Asia Blockchain Summit 2024 - Taipei","Taipei","6 August","8 August","2024-08-05","2024-08-09",296.82,440,225,300,75,0,1336.82
"Korea Blockchain Week 2024 - Seoul","Seoul","1 September","7 September","2024-08-31","2024-09-08",0,0,525,700,175,0,1400
"TOKEN2049 Singapore 2024","Singapore","18 September","19 September","2024-09-17","2024-09-20",935.63,264,180,200,57.52,599,2236.15
"GitHub Universe 2024 - San Francisco","San Francisco","29 October","30 October","2024-10-28","2024-10-31",2636.99,220,150,200,50,1300,4556.99
"Devcon 7 - Bangkok","Bangkok","12 November","15 November","2024-11-11","2024-11-16",744.67,660,300,400,100,284.76,2489.43
```

### Major Discrepancies Identified
1. **Meal Costs**: Consistently underestimated across all conferences (15-20% too low)
2. **Local Transport**: Consistently underestimated (20-30% too low)
3. **Business Entertainment**: Inconsistent - some conferences over, some under
4. **Categorization Issues**: Some expenses miscategorized (e.g., conference tickets as flights)
5. **Missing Categories**: No allowance for internet/data or incidentals

### Specific Examples
- Taipei lodging: $2,228.08 actual vs $440 stipend (extended stay beyond business days)
- Bangkok flight: $3,816 actual vs $744.67 stipend (business class vs economy)
- San Francisco: $2,636.99 incorrectly categorized as flight cost (actually for conference tickets)
- Large group entertainment expenses not adequately captured (e.g., $1,577.27 at FENG DU JUAN in Taipei)

## Algorithm Improvement Plan

### 1. Add New Expense Categories

#### Internet/Data Plans
```typescript
// Add to StipendBreakdown interface
export interface StipendBreakdown {
  // Existing fields...
  internet_data_allowance: number;
}

// Add to calculation function
const internetDataAllowance = isInternational ? 25 : 0;
totalStipend += internetDataAllowance;
```

#### Incidentals Allowance
```typescript
// Add to StipendBreakdown interface
export interface StipendBreakdown {
  // Existing fields...
  incidentals_allowance: number;
}

// Add to calculation function
const incidentalsAllowance = conferenceDays * 20;
totalStipend += incidentalsAllowance;
```

### 2. Refine Existing Categories

#### Meal Allocation Improvements
```typescript
// Update constants
export const BASE_MEALS_PER_DAY = 75; // Increase from current 60

// Implement duration-based scaling
const getDailyMealAllowance = (dayIndex: number, baseMealCost: number): number => {
  if (dayIndex < 3) {
    return baseMealCost; // 100% for days 1-3
  }
  return baseMealCost * 0.85; // 85% for days 4+
};

// In calculation function
let totalMealsCost = 0;
for (let i = 0; i < totalDays; i++) {
  totalMealsCost += getDailyMealAllowance(i, BASE_MEALS_PER_DAY * colFactor);
}
```

#### Local Transport Improvements
```typescript
// Update constants
export const BASE_LOCAL_TRANSPORT_PER_DAY = 35; // Increase from current 25

// In calculation function
const localTransportCost = calculateLocalTransportCost(
  destination,
  totalDays,
  colFactor,
  BASE_LOCAL_TRANSPORT_PER_DAY
);
```

#### Conference District Premium
```typescript
// Add new constant
export const CONFERENCE_DISTRICT_PREMIUM = 1.15;

// Add to conference data or lookup
const isConferenceDistrict = checkIfConferenceDistrict(destination);

// In lodging calculation
const adjustedLodgingRate = BASE_LODGING_PER_NIGHT * colFactor;
const districtAdjustedRate = isConferenceDistrict
  ? adjustedLodgingRate * CONFERENCE_DISTRICT_PREMIUM
  : adjustedLodgingRate;
```

### 3. Improve Business Entertainment Guidelines

```typescript
// Add new constants
export const BUSINESS_ENTERTAINMENT_PER_GUEST = 100;
export const MAX_GUESTS_PER_CONFERENCE = 3;

// In calculation function
const businessEntertainmentCost = Math.min(
  BUSINESS_ENTERTAINMENT_PER_GUEST * MAX_GUESTS_PER_CONFERENCE * conferenceDays,
  BUSINESS_ENTERTAINMENT_PER_DAY * conferenceDays
);
```

### 4. Enhance Documentation and Policies

#### Business Days Policy
```typescript
// Enforce strict conference + 1 day model
const businessDays = conferenceDays + PRE_CONFERENCE_DAYS + POST_CONFERENCE_DAYS;
```

#### Economy Flight Policy
```typescript
// Implement verification against typical economy fares
const verifyEconomyFare = async (destination: string, dates: FlightDates): Promise<number> => {
  const apiFlightPrice = await lookupFlightPrice(destination, dates);
  const distanceBasedPrice = distanceKm * COST_PER_KM;

  // Use historical average or API price if available, otherwise distance-based
  return apiFlightPrice || getHistoricalAverageFare(destination) || distanceBasedPrice;
};
```

## Implementation Steps

### Phase 1: Code Updates (2-3 weeks)
1. Update `StipendBreakdown` interface with new fields
2. Modify constants in `constants.ts`
3. Update calculation logic in `travel-stipend-calculator.ts`
4. Add new utility functions for duration-based scaling
5. Update CSV output format to include new categories

### Phase 2: Testing (1-2 weeks)
1. Create test cases for various conference scenarios
2. Validate against historical data
3. Test edge cases (long conferences, high-cost locations)

### Phase 3: Documentation (1 week)
1. Update employee documentation
2. Create clear policy document
3. Document verification procedures

### Phase 4: Deployment (1 week)
1. Deploy updated algorithm
2. Announce changes to employees
3. Train finance team on new procedures

## Expected Outcomes

### Accuracy Improvements
- Meal stipends should be within 10% of actual spending
- Local transport stipends should be within 15% of actual spending
- Overall stipend accuracy should improve by 20-25%

### Policy Enforcement
- Clear documentation of business days only policy
- Verification process for economy flights
- Guidelines for split transactions

### User Experience
- More comprehensive coverage of actual business expenses
- Clearer expectations for what is and isn't covered
- Reduced out-of-pocket expenses for legitimate business costs

## Monitoring and Evaluation

1. Compare stipend accuracy quarterly against actual expenses
2. Update base rates annually
3. Refresh cost of living data semi-annually
4. Collect employee feedback on stipend adequacy
5. Make minor adjustments as needed

## Technical Implementation Details

### File Changes Required
- `src/utils/constants.ts` - Update constants and add new ones
- `src/utils/types.ts` - Update StipendBreakdown interface
- `src/travel-stipend-calculator.ts` - Update calculation logic
- `src/utils/dates.ts` - Add duration-based scaling functions
- Output formatting code - Add new columns

### Data Requirements
- Conference district designations for major cities
- Historical average economy fares for common routes
- Updated cost of living indices

### Dependencies
- No new external dependencies required
- Uses existing caching and data loading mechanisms
