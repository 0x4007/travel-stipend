export const TRAVEL_STIPEND = {
  conference: {
    defaultDays: 1,
    preDays: 1, // Days to arrive before conference
    postDays: 1, // Days to stay after conference
  },
  costs: {
    ticket: 0, // Conference ticket
    hotel: 150, // Per night
    meals: 65, // Per day
    transport: 35, // Local transport per day
    incidentals: 25, // Per day
    businessEntertainment: 50, // Per day
  },
  rules: {
    costOfLivingIndex: 100, // Base index
    internationalInternet: 5, // Daily allowance for international travel
    weekendRateMultiplier: 1.25, // 25% premium for weekend rates
  },
};
