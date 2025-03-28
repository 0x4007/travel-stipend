declare module "../src/utils/destination-validator" {
  export function validateDestination(input: string): {
    isValid: boolean;
    suggestions?: string[];
  };
}
