import { describe, expect, test } from "bun:test";
import { validateDestination } from "../src/utils/destination-validator";

describe("City and Country Validation", () => {
  test("should validate Barcelona, Spain correctly", async () => {
    const result = await validateDestination("Barcelona, ES");
    expect(result.isValid).toBe(true);
    expect(result.validatedDestination).toBe("Barcelona, ES");
  });

  test("should reject Barcelona without country and suggest Spain", async () => {
    const result = await validateDestination("Barcelona");
    expect(result.isValid).toBe(true);
    expect(result.validatedDestination).toContain("ES");
    expect(result.suggestions).toBeDefined();
    expect(result.suggestions?.some((s) => s.includes("ES"))).toBe(true);
  });

  test("should reject Barcelona, Philippines", async () => {
    const result = await validateDestination("Barcelona, PH");
    expect(result.isValid).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.suggestions).toBeDefined();
    expect(result.suggestions?.some((s) => s.includes("ES"))).toBe(true);
  });

  test("should handle empty input", async () => {
    const result = await validateDestination("");
    expect(result.isValid).toBe(false);
    expect(result.error).toBe("City name is required");
  });

  test("should handle Seoul correctly", async () => {
    const result = await validateDestination("Seoul, KR");
    expect(result.isValid).toBe(true);
    expect(result.validatedDestination).toBe("Seoul, KR");
  });

  test("should handle city-states correctly", async () => {
    // Test Singapore
    const singaporeResult = await validateDestination("Singapore");
    expect(singaporeResult.isValid).toBe(true);
    expect(singaporeResult.validatedDestination).toBe("Singapore, SG");

    // Test Hong Kong
    const hongKongResult = await validateDestination("Hong Kong");
    expect(hongKongResult.isValid).toBe(true);
    expect(hongKongResult.validatedDestination).toBe("Hong Kong, HK");

    // Test with explicit country provided
    const explicitResult = await validateDestination("Singapore, SG");
    expect(explicitResult.isValid).toBe(true);
    expect(explicitResult.validatedDestination).toBe("Singapore, SG");
  });
});
