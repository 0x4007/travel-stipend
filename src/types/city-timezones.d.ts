declare module 'city-timezones' {
  interface CityInfo {
    city: string;
    country: string;
    timezone: string;
    lat: number;
    lng: number;
  }

  const cityTimezones: {
    lookupViaCity(cityName: string): CityInfo[];
    findFromCityStateProvince(cityName: string): CityInfo[];
  };

  export default cityTimezones;
}
