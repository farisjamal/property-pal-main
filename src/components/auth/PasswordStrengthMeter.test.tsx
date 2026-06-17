import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import PasswordStrengthMeter from "./PasswordStrengthMeter";

const SAMPLE = "abcdefgh"; // 8 lowercase chars: length met, uppercase unmet

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("PasswordStrengthMeter", () => {
  it("marks the length requirement met for an 8+ char password", () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve("") }));
    render(<PasswordStrengthMeter password={SAMPLE} />);
    const lengthItem = screen.getByText("At least 8 characters");
    expect(lengthItem.getAttribute("data-met")).toBe("true");
  });

  it("marks the uppercase requirement unmet for an all-lowercase password", () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve("") }));
    render(<PasswordStrengthMeter password={SAMPLE} />);
    const upperItem = screen.getByText("One uppercase letter");
    expect(upperItem.getAttribute("data-met")).toBe("false");
  });
});
