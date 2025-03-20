declare module 'airport-codes' {
  interface Airport {
    get(key: string): string;
  }

  const airportCodes: Set<Airport>;
  export default airportCodes;
}
