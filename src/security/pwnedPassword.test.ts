import { describe, it, expect, vi, afterEach } from "vitest";
import { checkPwnedPassword } from "./pwnedPassword";

// SHA-1 of the string password -> prefix 5BAA6 + the suffix below.
const KNOWN_SUFFIX = "1E4C9B93F3F0682250B6CF8331B7EE68FD8";

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

describe("checkPwnedPassword", () => {
  it("returns the breach count when the suffix is found", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetchText(`0018A45C4D1DEF81644B54AB7F969B88D65:1\r\n${KNOWN_SUFFIX}:99999`)
    );
    expect(await checkPwnedPassword("password")).toBe(99999);
  });

  it("returns 0 when the suffix is not in the response", async () => {
    vi.stubGlobal("fetch", mockFetchText("0018A45C4D1DEF81644B54AB7F969B88D65:1"));
    expect(await checkPwnedPassword("password")).toBe(0);
  });

  it("sends only the 5-char hash prefix (k-anonymity)", async () => {
    const fetchMock = mockFetchText("");
    vi.stubGlobal("fetch", fetchMock);
    await checkPwnedPassword("password");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.pwnedpasswords.com/range/5BAA6",
      expect.any(Object)
    );
  });

  it("fails open (returns 0) on network error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    expect(await checkPwnedPassword("password")).toBe(0);
  });
});
