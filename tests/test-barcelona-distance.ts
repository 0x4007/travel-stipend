import { haversineDistance } from "../src/utils/distance";
import { Coordinates } from "../src/utils/types";

// Seoul coordinates from constants.ts (ORIGIN = "Seoul, Korea")
const seoul: Coordinates = {
  lat: 37.5600,
  lng: 126.9900
};

// Different Barcelona coordinates from coordinates.csv
const barcelonaSpain: Coordinates = {
  lat: 41.3828,
  lng: 2.1769
};

const barcelonaVenezuela: Coordinates = {
  lat: 10.1403,
  lng: -64.6833
};

const barcelonaPhilippines: Coordinates = {
  lat: 12.8694,
  lng: 124.1419
};

// Calculate distances
const distanceToSpain = haversineDistance(seoul, barcelonaSpain);
const distanceToVenezuela = haversineDistance(seoul, barcelonaVenezuela);
const distanceToPhilippines = haversineDistance(seoul, barcelonaPhilippines);

console.log("Distance from Seoul to Barcelona, Spain:", Math.round(distanceToSpain), "km");
console.log("Distance from Seoul to Barcelona, Venezuela:", Math.round(distanceToVenezuela), "km");
console.log("Distance from Seoul to Barcelona, Philippines:", Math.round(distanceToPhilippines), "km");
