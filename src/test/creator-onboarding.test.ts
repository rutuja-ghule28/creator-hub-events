import { describe, expect, it } from "vitest";

interface CreatorApplicationInput {
  display_name: string;
  category: string;
  location: string;
  bio: string;
  audience_size: string | number;
  contact_email: string;
  contact_phone?: string;
  portfolio_links: string[];
}

function validateCreatorApplication(
  input: CreatorApplicationInput,
  existingCreator: unknown | null,
) {
  if (existingCreator) {
    return { valid: false, error: "Duplicate application: You already have a creator profile." };
  }

  if (!input.display_name || input.display_name.trim().length < 2) {
    return { valid: false, error: "Creator name must be at least 2 characters." };
  }

  if (!input.category || input.category.trim() === "") {
    return { valid: false, error: "Please select a category." };
  }

  if (!input.location || input.location.trim().length < 2) {
    return { valid: false, error: "Please provide a valid location." };
  }

  if (!input.bio || input.bio.trim().length < 10) {
    return { valid: false, error: "Bio must be at least 10 characters long." };
  }

  const aud =
    typeof input.audience_size === "string"
      ? parseInt(input.audience_size, 10)
      : input.audience_size;
  if (isNaN(aud) || aud < 0) {
    return { valid: false, error: "Audience size must be a non-negative number." };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!input.contact_email || !emailRegex.test(input.contact_email.trim())) {
    return { valid: false, error: "Please provide a valid contact email." };
  }

  const urlRegex = /^https?:\/\/.+/i;
  const validUrls = input.portfolio_links.filter((l) => urlRegex.test(l.trim()));
  if (validUrls.length === 0) {
    return {
      valid: false,
      error:
        "Please provide at least one valid portfolio link (starting with http:// or https://).",
    };
  }

  return {
    valid: true,
    data: {
      display_name: input.display_name.trim(),
      category: input.category.trim(),
      location: input.location.trim(),
      bio: input.bio.trim(),
      audience_size: aud,
      contact_email: input.contact_email.trim(),
      contact_phone: input.contact_phone?.trim() || null,
      portfolio_links: validUrls,
      verification_status: "pending",
      verified: false,
    },
  };
}

describe("Creator Onboarding Workflow", () => {
  const validPayload: CreatorApplicationInput = {
    display_name: "Tanmay B",
    category: "Tech reviewer",
    location: "Pune",
    bio: "Reviewing latest consumer gadgets, smartphones, and software tools.",
    audience_size: "35000",
    contact_email: "tanmay@techreviews.com",
    contact_phone: "+91 9876543210",
    portfolio_links: ["https://youtube.com/@tanmayreviews", "https://instagram.com/tanmaytech"],
  };

  it("validates successful creator application payload", () => {
    const res = validateCreatorApplication(validPayload, null);
    expect(res.valid).toBe(true);
    expect(res.data?.verification_status).toBe("pending");
    expect(res.data?.verified).toBe(false);
    expect(res.data?.audience_size).toBe(35000);
    expect(res.data?.portfolio_links).toHaveLength(2);
  });

  it("rejects duplicate application if creator record already exists", () => {
    const existing = { id: "cr-1", verification_status: "pending" };
    const res = validateCreatorApplication(validPayload, existing);
    expect(res.valid).toBe(false);
    expect(res.error).toMatch(/Duplicate application/i);
  });

  it("enforces minimum creator name length", () => {
    const res = validateCreatorApplication({ ...validPayload, display_name: "A" }, null);
    expect(res.valid).toBe(false);
    expect(res.error).toMatch(/name must be at least 2 characters/i);
  });

  it("enforces minimum bio length", () => {
    const res = validateCreatorApplication({ ...validPayload, bio: "Short" }, null);
    expect(res.valid).toBe(false);
    expect(res.error).toMatch(/Bio must be at least 10 characters/i);
  });

  it("enforces non-negative audience size", () => {
    const res = validateCreatorApplication({ ...validPayload, audience_size: -5 }, null);
    expect(res.valid).toBe(false);
    expect(res.error).toMatch(/Audience size must be a non-negative number/i);
  });

  it("validates email address format", () => {
    const res = validateCreatorApplication(
      { ...validPayload, contact_email: "invalid-email" },
      null,
    );
    expect(res.valid).toBe(false);
    expect(res.error).toMatch(/valid contact email/i);
  });

  it("requires at least one valid http/https portfolio link", () => {
    const res = validateCreatorApplication(
      { ...validPayload, portfolio_links: ["not-a-url", "ftp://invalid"] },
      null,
    );
    expect(res.valid).toBe(false);
    expect(res.error).toMatch(/at least one valid portfolio link/i);
  });

  it("sets verification_status to pending and verified to false on submission", () => {
    const res = validateCreatorApplication(validPayload, null);
    expect(res.data?.verification_status).toBe("pending");
    expect(res.data?.verified).toBe(false);
  });
});
