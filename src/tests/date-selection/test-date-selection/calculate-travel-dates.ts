/**
 * Calculate travel dates
 */

export function calculateTravelDates(): {
  departureDayOfMonth: number;
  departureMonth: string;
  returnDayOfMonth: number;
  returnMonth: string;
} {
  const today = new Date();

  // Departure date: one week from today
  const departureDate = new Date(today);
  departureDate.setDate(today.getDate() + 7);
  const departureDayOfMonth = departureDate.getDate();
  const departureMonth = departureDate.toLocaleString('en-US', { month: 'long' });

  // Return date: two weeks from today
  const returnDate = new Date(today);
  returnDate.setDate(today.getDate() + 14);
  const returnDayOfMonth = returnDate.getDate();
  const returnMonth = returnDate.toLocaleString('en-US', { month: 'long' });

  console.log(`Selecting departure date: ${departureMonth} ${departureDayOfMonth}, ${departureDate.getFullYear()}`);
  console.log(`Selecting return date: ${returnMonth} ${returnDayOfMonth}, ${returnDate.getFullYear()}`);

  return {
    departureDayOfMonth,
    departureMonth,
    returnDayOfMonth,
    returnMonth
  };
}
