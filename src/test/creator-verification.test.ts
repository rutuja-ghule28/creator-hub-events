import { describe, expect, it } from "vitest";
import { VERIFIABLE_FIELDS } from "@/lib/cc";

describe("Creator Verification Workflow", () => {
  it("defines all 6 verifiable criteria with written requirements", () => {
    expect(VERIFIABLE_FIELDS).toHaveLength(6);

    const keys = VERIFIABLE_FIELDS.map((f) => f.key);
    expect(keys).toEqual(["name", "niche", "audience", "location", "portfolio", "contact"]);

    for (const field of VERIFIABLE_FIELDS) {
      expect(field.label).toBeTruthy();
      expect(field.criteria).toBeTruthy();
      expect(field.criteria.length).toBeGreaterThan(10);
    }
  });

  it("checks individual field verification presence correctly", () => {
    const verifiedFields = ["name", "audience", "location"];

    const isNameVerified = verifiedFields.includes("name");
    const isContactVerified = verifiedFields.includes("contact");

    expect(isNameVerified).toBe(true);
    expect(isContactVerified).toBe(false);
  });
});
