# Conference Travel Stipend Analysis

## Executive Summary

This analysis examines the discrepancies between allocated travel stipends and actual spending for five conferences in 2024. The goal is to identify patterns, explain major variances, and recommend improvements to the stipend algorithm to increase accuracy while maintaining company policies.

## Stipend vs. Actual Spending Analysis

### Asia Blockchain Summit 2024 (Taipei, August 6-8)

| Category               | Stipend Amount | Actual Spending | Variance       |
| ---------------------- | -------------- | --------------- | -------------- |
| Flight                 | $296.82        | ~$296.82        | $0             |
| Lodging                | $440.00        | $2,228.08       | +$1,788.08     |
| Meals                  | $225.00        | ~$243.26        | +$18.26        |
| Business Entertainment | $300.00        | $1,577.27       | +$1,277.27     |
| Local Transport        | $75.00         | ~$98.00         | +$23.00        |
| Ticket                 | $0.00          | $0.00           | $0             |
| **Total**              | **$1,336.82**  | **~$4,443.43**  | **+$3,106.61** |

**Key Discrepancies:**

- Lodging costs significantly exceeded the stipend due to an extended stay at Humble House Curio Hilton
- Business entertainment at FENG DU JUAN ($1,577.27) far exceeded the stipend allocation

### Korea Blockchain Week 2024 (Seoul, September 1-7)

| Category               | Stipend Amount | Actual Spending | Variance    |
| ---------------------- | -------------- | --------------- | ----------- |
| Flight                 | $0.00          | $0.00           | $0          |
| Lodging                | $0.00          | $0.00           | $0          |
| Meals                  | $525.00        | ~$650.00        | +$125.00    |
| Business Entertainment | $700.00        | ~$550.00        | -$150.00    |
| Local Transport        | $175.00        | ~$190.00        | +$15.00     |
| Ticket                 | $0.00          | $0.00           | $0          |
| **Total**              | **$1,400.00**  | **~$1,390.00**  | **-$10.00** |

**Key Discrepancies:**

- Meal expenses slightly exceeded the stipend
- Business entertainment was actually less than the stipend allocation
- Overall spending was closely aligned with the total stipend

### TOKEN2049 Singapore 2024 (September 18-19)

| Category               | Stipend Amount | Actual Spending | Variance     |
| ---------------------- | -------------- | --------------- | ------------ |
| Flight                 | $935.63        | ~$935.63        | $0           |
| Lodging                | $264.00        | ~$264.00        | $0           |
| Meals                  | $180.00        | ~$570.00        | +$390.00     |
| Business Entertainment | $200.00        | ~$350.00        | +$150.00     |
| Local Transport        | $57.52         | ~$120.00        | +$62.48      |
| Ticket                 | $599.00        | $599.00         | $0           |
| **Total**              | **$2,236.15**  | **~$2,838.63**  | **+$602.48** |

**Key Discrepancies:**

- Meal expenses significantly exceeded the stipend
- Local transport costs were higher than allocated
- Business entertainment slightly exceeded the stipend

### GitHub Universe 2024 (San Francisco, October 29-30)

| Category               | Stipend Amount | Actual Spending | Variance     |
| ---------------------- | -------------- | --------------- | ------------ |
| Flight                 | $2,636.99      | ~$1,300.00      | -$1,336.99   |
| Lodging                | $220.00        | ~$220.00        | $0           |
| Meals                  | $150.00        | ~$450.00        | +$300.00     |
| Business Entertainment | $200.00        | ~$300.00        | +$100.00     |
| Local Transport        | $50.00         | ~$120.00        | +$70.00      |
| Ticket                 | $1,300.00      | $1,299.00       | -$1.00       |
| **Total**              | **$4,556.99**  | **~$3,689.00**  | **-$867.99** |

**Key Discrepancies:**

- The $2,636.99 listed as "flight cost" appears to be for two conference tickets
- Meal expenses were significantly higher than the stipend
- Local transport costs were higher than allocated

### Devcon 7 (Bangkok, November 12-15)

| Category               | Stipend Amount | Actual Spending | Variance       |
| ---------------------- | -------------- | --------------- | -------------- |
| Flight                 | $744.67        | $3,816.00       | +$3,071.33     |
| Lodging                | $660.00        | ~$660.00        | $0             |
| Meals                  | $300.00        | ~$650.00        | +$350.00       |
| Business Entertainment | $400.00        | ~$400.00        | $0             |
| Local Transport        | $100.00        | ~$150.00        | +$50.00        |
| Ticket                 | $284.76        | $284.76         | $0             |
| **Total**              | **$2,489.43**  | **~$5,960.76**  | **+$3,471.33** |

**Key Discrepancies:**

- Flight costs were significantly higher due to business class travel ($3,816 vs $744.67)
- Meal expenses exceeded the stipend
- Local transport costs were higher than allocated

## Root Causes of Discrepancies

### 1. Extended Stays Beyond Business Days

- The stipend algorithm assumes conference dates plus one day before/after
- Actual travel often extended beyond this window, particularly for Taipei
- Company policy is to only compensate for business days

### 2. Business Class vs. Economy Travel

- The algorithm assumes economy flights for all travel
- Business class was used for the Bangkok trip, resulting in a $3,071.33 variance
- Company policy is that employees pay the difference for upgrades

### 3. Meal and Entertainment Allocation

- Meal stipends were consistently lower than actual spending across all conferences
- Business entertainment showed mixed patterns, with some conferences exceeding the stipend and others under
- Large group entertainment expenses (e.g., $1,577.27 at FENG DU JUAN in Taipei) weren't adequately captured

### 4. Local Transportation Underestimation

- Local transport stipends were consistently lower than actual spending
- Multiple short Uber/Grab trips per day for conference-related movement weren't fully accounted for

### 5. Categorization Issues

- Some expenses were miscategorized (e.g., conference tickets as flights for GitHub Universe)
- This led to apparent discrepancies that were actually accounting errors

## Recommended Stipend Improvements

### 1. Clearer Business Days Policy

- Maintain the current conference dates + 1 day before/after model
- Explicitly document that personal extensions are 100% employee responsibility
- Develop guidelines for handling hotel bills that span both business and personal days

### 2. Economy-Only Flight Policy Enforcement

- Keep the current flight cost calculation based on economy fares
- Require documentation when employees personally pay for upgrades
- Implement verification against typical economy fares for common routes

### 3. Additional Categories to Consider

#### Internet/Data Plans

- Add standard allowance of $20-30 per international trip
- Evidence: Multiple AIRALO purchases for international data
- Business justification: Necessary for staying connected during conference travel

#### Incidentals Allowance

- Add $15-25/day for miscellaneous business expenses
- Covers small business-related purchases not captured elsewhere
- Reduces administrative overhead of tracking minor expenses

### 4. Algorithm Refinements

#### Improved Meal Allocation

- Increase base meal allowance by 15-20% based on actual spending patterns
- For longer conferences (4+ days), implement a declining scale:
  - Days 1-3: 100% of daily meal allowance
  - Days 4+: 85% of daily allowance

#### Enhanced Location-Based Adjustments

- Improve cost-of-living adjustments specifically for conference districts
- Many conferences are held in premium areas where costs are higher than city averages
- Consider a 10-15% premium for high-cost conference districts

#### Business Entertainment Guidelines

- Create clearer guidelines on business entertainment expectations
- Consider a per-person cap rather than a total cap
- Example: "$100 per guest, maximum 3 guests per conference"

## Implementation Recommendations

1. **Update the stipend calculation algorithm** to incorporate the recommended changes
2. **Create clear documentation** for employees about what is and isn't covered
3. **Develop a verification process** to compare stipends against typical costs
4. **Establish a regular review cycle** to assess stipend accuracy against actual expenses
5. **Consider a pilot program** with the new algorithm for upcoming conferences

## Conclusion

The current travel stipend algorithm provides a reasonable baseline but shows consistent patterns of underestimation in certain categories and overestimation in others. By implementing the recommended improvements, the algorithm can better align with actual business expenses while maintaining company policies regarding extended stays and premium travel options.
