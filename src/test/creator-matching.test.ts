import { describe, expect, it } from "vitest";
import { calculateMatchScore, rankCreatorsForEvent } from "@/lib/matching";
import type { Creator, EventRow } from "@/lib/cc";

const sampleEvent: EventRow = {
  id: "ev-1",
  creator_id: "host-creator-id",
  title: "Pune Tech Innovators Meetup",
  description: "Hands-on tech launch and gadget workshop for developers and creators.",
  type: "Workshop",
  target_niche: "Tech reviewer",
  venue: "FC Road, Pune",
  area: "Deccan Gymkhana, Pune",
  capacity: 100,
  seats_taken: 20,
  starts_at: "2026-12-01T10:00:00Z",
  created_at: "2026-11-01T10:00:00Z",
  cover_url: null,
  promotion_brief: "Promote on YouTube and Instagram",
  application_deadline: "2026-11-28T18:00:00Z",
  status: "live",
};

const sampleCreator: Creator = {
  id: "cr-1",
  user_id: "usr-1",
  display_name: "Rohan Tech",
  category: "Tech reviewer",
  location: "Pune, MH",
  bio: "Full time tech reviewer and gadget tester.",
  audience_size: 15000,
  verified: true,
  verification_status: "verified",
  verified_fields: ["name", "niche", "audience"],
  avatar_url: null,
  contact_email: "rohan@tech.com",
  contact_phone: null,
  portfolio_links: ["https://youtube.com/@rohantech"],
  page_views: 1200,
  created_at: "2026-10-01T10:00:00Z",
  verification_docs: [],
};

describe("Creator-Event Matching Engine", () => {
  it("awards maximum niche score for exact category match", () => {
    const result = calculateMatchScore(sampleEvent, sampleCreator);
    expect(result.breakdown.nicheScore).toBe(40);
    expect(result.breakdown.nicheReason).toContain("Exact target niche match");
  });

  it("awards high semantic score for related niches", () => {
    const musicEvent = { ...sampleEvent, target_niche: "Music" };
    const musicianCreator = { ...sampleCreator, category: "Musician" };
    const result = calculateMatchScore(musicEvent, musicianCreator);
    expect(result.breakdown.nicheScore).toBe(36);
  });

  it("awards maximum location score when creator is local to event city", () => {
    const result = calculateMatchScore(sampleEvent, sampleCreator);
    expect(result.breakdown.locationScore).toBe(25);
    expect(result.breakdown.locationReason).toContain("Local creator");
  });

  it("recognizes regional proximity for nearby metro hubs (Mumbai <-> Pune)", () => {
    const mumbaiCreator = { ...sampleCreator, location: "Bandra, Mumbai" };
    const result = calculateMatchScore(sampleEvent, mumbaiCreator);
    expect(result.breakdown.locationScore).toBe(18);
    expect(result.breakdown.locationReason).toContain("High regional proximity");
  });

  it("scores audience size relative to event capacity", () => {
    // 15K audience for 100 capacity (~150 expected conversion, ideal balance)
    const result = calculateMatchScore(sampleEvent, sampleCreator);
    expect(result.breakdown.audienceScore).toBe(20);
    expect(result.breakdown.audienceReason).toContain("Optimal capacity balance");
  });

  it("awards bonus trust points for platform-verified creators", () => {
    const verifiedResult = calculateMatchScore(sampleEvent, sampleCreator);
    expect(verifiedResult.breakdown.trustScore).toBe(15); // 12 base + 3 verified fields

    const unverifiedCreator = { ...sampleCreator, verified: false, verification_status: "pending", verified_fields: [] };
    const unverifiedResult = calculateMatchScore(sampleEvent, unverifiedCreator);
    expect(unverifiedResult.breakdown.trustScore).toBe(9);
  });

  it("handles missing or incomplete creator data gracefully without NaN", () => {
    const incompleteCreator: Creator = {
      id: "cr-incomplete",
      user_id: null,
      display_name: "Anonymous Creator",
      category: "",
      location: "",
      bio: "",
      audience_size: 0,
      verified: false,
      verification_status: "pending",
      verified_fields: [],
      avatar_url: null,
      contact_email: null,
      contact_phone: null,
      portfolio_links: [],
      page_views: 0,
      created_at: "2026-10-01T10:00:00Z",
      verification_docs: [],
    };

    const result = calculateMatchScore({ ...sampleEvent, target_niche: null }, incompleteCreator);
    expect(result.totalScore).toBeGreaterThanOrEqual(0);
    expect(result.totalScore).toBeLessThanOrEqual(100);
    expect(isNaN(result.totalScore)).toBe(false);
  });

  it("ranks creators descending by score and excludes the host creator", () => {
    const hostAsCreator: Creator = { ...sampleCreator, id: "host-creator-id", display_name: "Host Organizer" };
    const creatorA: Creator = { ...sampleCreator, id: "cr-a", display_name: "Perfect Match", category: "Tech reviewer", location: "Pune", audience_size: 20000 };
    const creatorB: Creator = { ...sampleCreator, id: "cr-b", display_name: "Distant Match", category: "Food", location: "Delhi", audience_size: 500 };

    const ranked = rankCreatorsForEvent(sampleEvent, [hostAsCreator, creatorB, creatorA], 5);

    // Host must be excluded
    expect(ranked.some((r) => r.creator.id === "host-creator-id")).toBe(false);
    expect(ranked.length).toBe(2);
    expect(ranked[0].creator.id).toBe("cr-a");
    expect(ranked[0].totalScore).toBeGreaterThan(ranked[1].totalScore);
  });
});
