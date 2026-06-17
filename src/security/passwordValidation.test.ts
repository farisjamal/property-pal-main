import { describe, it, expect, vi, afterEach } from "vitest";
import { validatePasswordFull } from "./passwordValidation";

function mockFetchText(body: string) {
  return vi.fn().mockResolvedValue({
    ok: true,
    text: () => Promise.resolve(body),
  } as Response);
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("validatePasswordFull", () => {
  it("rejects a breached, weak password", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetchText("1E4C9B93F3F0682250B6CF8331B7EE68FD8:99999")
    );
    const result = await validatePasswordFull("password");
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("This password has appeared in a known data breach");
  });

  it("accepts a strong, non-breached password", async () => {
    vi.stubGlobal("fetch", mockFetchText("0018A45C4D1DEF81644B54AB7F969B88D65:1"));
    const result = await validatePasswordFull("Gx7$mK9pLz!qWeRt");
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });
});
