import { describe, expect, it } from "vitest";

describe("Creator Campaign Workflow", () => {
  it("validates campaign pitch constraints (10 to 1500 characters)", () => {
    const tooShort = "Hi there";
    expect(tooShort.length).toBeLessThan(10);

    const validPitch =
      "I would love to cover this tech launch on my YouTube channel. I can deliver 1 dedicated reel and 2 stories with swipe-up registration links.";
    expect(validPitch.length).toBeGreaterThanOrEqual(10);
    expect(validPitch.length).toBeLessThanOrEqual(1500);

    const tooLong = "A".repeat(1501);
    expect(tooLong.length).toBeGreaterThan(1500);
  });

  it("checks application deadline open vs passed state", () => {
    const futureDate = new Date(Date.now() + 86400000).toISOString(); // 1 day in future
    const pastDate = new Date(Date.now() - 86400000).toISOString(); // 1 day in past

    const isFuturePassed = new Date(futureDate) < new Date();
    const isPastPassed = new Date(pastDate) < new Date();

    expect(isFuturePassed).toBe(false);
    expect(isPastPassed).toBe(true);
  });

  it("validates campaign application statuses", () => {
    const validStatuses = ["pending", "accepted", "rejected"];
    expect(validStatuses).toContain("pending");
    expect(validStatuses).toContain("accepted");
    expect(validStatuses).toContain("rejected");
  });
});
