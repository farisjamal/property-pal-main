import { describe, it, expect } from "vitest";
import { evaluatePassword } from "./passwordStrength";

describe("evaluatePassword", () => {
  it("scores a common password as very weak", async () => {
    const result = await evaluatePassword("password");
    expect(result.score).toBeLessThanOrEqual(1);
    expect(result.label).toBe("Very weak");
  });

  it("scores a long random password as strong", async () => {
    const result = await evaluatePassword("Gx7$mK9pLz!qWeRt");
    expect(result.score).toBeGreaterThanOrEqual(3);
  });

  it("penalizes passwords derived from user context", async () => {
    const withoutContext = await evaluatePassword("johnsmith2020");
    const withContext = await evaluatePassword("johnsmith2020", ["john.smith@example.com"]);
    expect(withContext.score).toBeLessThanOrEqual(withoutContext.score);
  });
});
