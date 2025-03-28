export function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number;

export function getDistanceKmFromCities(city1: string, city2: string): Promise<number>;

export function calculateDistancePrice(distanceKm: number, basePrice: number): number;
