# Travel Stipend Algorithm Implementation Plan

## Phase 1: Algorithm Updates (2-3 weeks)

### 1. Update Core Calculation Logic

#### Meal Allocation Adjustments
- Increase base meal allowance by 15-20%
- Implement duration-based scaling:
  ```typescript
  // Example implementation
  const getDailyMealAllowance = (dayIndex: number, baseMealCost: number): number => {
    if (dayIndex < 3) {
      return baseMealCost; // 100% for days 1-3
    }
    return baseMealCost * 0.85; // 85% for days 4+
  };
  ```

#### Location Premium for Conference Districts
- Add 10-15% premium for high-cost conference districts
  ```typescript
  // Example implementation
  const getLocationAdjustedLodging = (baseRate: number, colFactor: number, isConferenceDistrict: boolean): number => {
    const districtPremium = isConferenceDistrict ? 1.15 : 1.0;
    return baseRate * colFactor * districtPremium;
  };
  ```

#### Add New Expense Categories
- Add Internet/Data Plans allowance
- Add Incidentals allowance
  ```typescript
  // Example implementation
  const calculateStipend = (conference: Conference): StipendBreakdown => {
    // Existing calculations...

    // New categories
    const internetDataAllowance = isInternational ? 25 : 0;
    const incidentalsAllowance = conferenceDays * 20;

    // Add to total
    totalStipend += internetDataAllowance + incidentalsAllowance;

    return {
      // Existing fields...
      internet_data_allowance: internetDataAllowance,
      incidentals_allowance: incidentalsAllowance,
    };
  };
  ```

### 2. Update Data Structures

#### Modify StipendBreakdown Interface
```typescript
export interface StipendBreakdown {
  // Existing fields...
  internet_data_allowance: number;
  incidentals_allowance: number;
  // Add any other new fields
}
```

#### Update CSV Output Format
- Add new columns for the additional categories
- Update header and row generation in the output function

## Phase 2: Documentation & Policy Updates (1-2 weeks)

### 1. Update Employee Documentation

#### Create Clear Policy Document
- Document business days only policy
- Explain economy-only flight policy
- Provide guidelines for split transactions
- Outline business entertainment expectations

#### Update Internal Guidelines
- Create reference guide for finance team
- Document verification procedures for expenses

### 2. Create Testing Framework

#### Develop Test Cases
- Create test cases for various conference scenarios
- Include edge cases for long conferences, high-cost locations, etc.

#### Validation Process
- Implement validation against historical data
- Create benchmarks for accuracy assessment

## Phase 3: Pilot & Refinement (4-6 weeks)

### 1. Pilot Program

#### Select Upcoming Conferences
- Choose 3-5 upcoming conferences for pilot
- Include a mix of domestic and international events

#### Parallel Calculation
- Run both old and new algorithms
- Compare results and document differences

### 2. Feedback & Refinement

#### Collect User Feedback
- Gather input from employees using the new system
- Document any issues or edge cases

#### Algorithm Tuning
- Fine-tune parameters based on pilot results
- Adjust allowances if necessary

## Phase 4: Full Deployment (2 weeks)

### 1. Final Updates

#### Code Finalization
- Incorporate all refinements from pilot
- Perform final code review and testing

#### Documentation Updates
- Update all documentation with final parameters
- Create training materials for finance team

### 2. Rollout

#### System Deployment
- Deploy updated algorithm to production
- Migrate any existing data

#### Announcement & Training
- Announce changes to all employees
- Conduct training sessions for finance team

## Phase 5: Monitoring & Evaluation (Ongoing)

### 1. Regular Review Cycle

#### Quarterly Assessment
- Review stipend accuracy quarterly
- Compare against actual expenses

#### Annual Parameter Update
- Update base rates annually
- Refresh cost of living data

### 2. Continuous Improvement

#### Feedback Collection
- Maintain channel for employee feedback
- Document edge cases and issues

#### Iterative Refinement
- Make minor adjustments as needed
- Plan for major updates annually
