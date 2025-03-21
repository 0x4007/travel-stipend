import { DatabaseService } from "./database";

const DEFAULT_COL_FACTOR = 1.0;

export async function getCostOfLivingFactor(city: string): Promise<number> {
  try {
    const result = await DatabaseService.getInstance().getCostOfLiving(city);
    return result?.cost_index ?? DEFAULT_COL_FACTOR;
  } catch (error) {
    console.error(`Error getting cost of living for ${city}:`, error);
    return DEFAULT_COL_FACTOR;
  }
}
