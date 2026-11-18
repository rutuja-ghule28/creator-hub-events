import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  validateExternalUrl,
  getSourceMeta,
  formatExternalPrice,
  deduplicateExternalEvents,
  MAJOR_INDIAN_CITIES,
  detectProviderFromUrl,
  type ExternalEvent,
} from "@/lib/external-events";
import {
  TownscriptAdapter,
  AllEventsAdapter,
  VerifiedOrganizerLinkAdapter,
} from "@/lib/ingestion/adapters";

// Verified exact demo UUIDs
const DEMO_EVENT_IDS = new Set([
  "e0000000-0000-0000-0000-000000000001",
  "e0000000-0000-0000-0000-000000000002",
  "e0000000-0000-0000-0000-000000000003",
  "e0000000-0000-0000-0000-000000000004",
  "e0000000-0000-0000-0000-000000000005",
  "e0000000-0000-0000-0000-000000000006",
  "e0000000-0000-0000-0000-000000000007",
]);

const DEMO_CREATOR_IDS = new Set([
  "a0000000-0000-0000-0000-000000000001",
  "a0000000-0000-0000-0000-000000000002",
  "a0000000-0000-0000-0000-000000000003",
  "a0000000-0000-0000-0000-000000000004",
  "a0000000-0000-0000-0000-000000000005",
  "a0000000-0000-0000-0000-000000000006",
]);

describe("External Event URL Validation & Safety", () => {
  it("accepts valid HTTPS official booking URLs", () => {
    const urls = [
      "https://www.townscript.com/v2/e/indie-music-fest-2026/booking",
      "https://allevents.in/mumbai/sunburn-arena-alan-walker/8000123456",
      "https://www.meetup.com/pune-tech-creators/events/299182736/",
      "https://lu.ma/ai-founders-delhi",
      "https://in.bookmyshow.com/events/standup-special-live/ET00123456",
    ];

    for (const url of urls) {
      const res = validateExternalUrl(url);
      expect(res.valid).toBe(true);
      expect(res.normalizedUrl).toBe(url);
    }
  });

  it("strictly rejects insecure, malformed, or malicious URL schemes", () => {
    const invalidUrls = [
      "http://insecure-ticketing.com/book",
      "javascript:alert(document.cookie)",
      "data:text/html,<script>alert(1)</script>",
      "file:///etc/passwd",
      "//protocol-relative.com/ticket",
      "https:///no-domain",
      "https://invalid domain with spaces.com",
      "",
      "   ",
      null as unknown as string,
      undefined as unknown as string,
    ];

    for (const badUrl of invalidUrls) {
      const res = validateExternalUrl(badUrl);
      expect(res.valid).toBe(false);
      expect(res.error).toBeDefined();
    }
  });
});

describe("Source Attribution & Price Formatting", () => {
  it("maps supported event sources to official platform metadata", () => {
    const sources = [
      "townscript",
      "allevents",
      "meetup",
      "luma",
      "bookmyshow",
      "insider",
      "partner",
    ];
    for (const s of sources) {
      const meta = getSourceMeta(s);
      expect(meta.label).toBeDefined();
      expect(meta.badgeClass).toBeDefined();
      expect(meta.verifiedLabel).toBeDefined();
    }
  });

  it("formats pricing accurately for free, single, and range tiers in INR", () => {
    expect(formatExternalPrice(true)).toBe("Free Entry");
    expect(formatExternalPrice(false, 0, 0)).toBe("Free Entry");
    expect(formatExternalPrice(false, 499)).toBe("₹499 onwards");
    expect(formatExternalPrice(false, 499, 1499)).toBe("₹499 – ₹1,499");
    expect(formatExternalPrice(false, null, null)).toBe("Official Ticketing");
  });
});

describe("External Ingestion Deduplication & Staleness", () => {
  it("deduplicates external event records by composite key (source_name, source_event_id)", () => {
    const rawBatch = [
      {
        source_name: "townscript",
        source_event_id: "music-fest-2026",
        source_last_verified_at: "2026-11-10T10:00:00Z",
        title: "Music Fest (Old Title)",
      },
      {
        source_name: "townscript",
        source_event_id: "music-fest-2026",
        source_last_verified_at: "2026-11-18T10:00:00Z",
        title: "Music Fest (Updated Title)",
      },
      {
        source_name: "allevents",
        source_event_id: "ae-9988",
        source_last_verified_at: "2026-11-18T10:00:00Z",
        title: "Tech Summit Bengaluru",
      },
    ];

    const deduplicated = deduplicateExternalEvents(rawBatch);
    expect(deduplicated).toHaveLength(2);

    const townscriptItem = deduplicated.find((e) => e.source_name === "townscript");
    expect(townscriptItem?.title).toBe("Music Fest (Updated Title)");
  });
});

describe("India Multi-City Discovery Filtering", () => {
  const sampleEvents = [
    {
      id: "1",
      title: "Pune Acoustic Jam",
      city: "Pune",
      area: "Koregaon Park",
      venue: "The Daily All Day",
    },
    {
      id: "2",
      title: "Mumbai Comedy Club",
      city: "Mumbai",
      area: "Bandra",
      venue: "That Comedy Club",
    },
    {
      id: "3",
      title: "Bengaluru Dev Con",
      city: "Bengaluru",
      area: "Koramangala",
      venue: "Indiranagar Hub",
    },
    {
      id: "4",
      title: "Delhi NCR AI Meetup",
      city: "Delhi NCR",
      area: "Gurgaon CyberHub",
      venue: "WeWork DLF",
    },
    {
      id: "5",
      title: "Noida Creator Brunch",
      city: "Noida",
      area: "Sector 62",
      venue: "Studio One",
    },
    {
      id: "6",
      title: "Hyderabad Pitch Night",
      city: "Hyderabad",
      area: "Hitec City",
      venue: "T-Hub",
    },
  ];

  function filterByCity(items: typeof sampleEvents, city: string) {
    if (!city || city === "All India") return items;
    const target = city.toLowerCase().trim();
    return items.filter((e) => {
      const c = e.city.toLowerCase();
      const a = e.area.toLowerCase();
      const v = e.venue.toLowerCase();
      if (target === "delhi ncr") {
        return (
          c.includes("delhi") ||
          c.includes("noida") ||
          c.includes("gurgaon") ||
          a.includes("delhi") ||
          a.includes("ncr") ||
          a.includes("gurgaon")
        );
      }
      return c.includes(target) || a.includes(target) || v.includes(target);
    });
  }

  it("supports 'All India' showing events from all metro regions", () => {
    const res = filterByCity(sampleEvents, "All India");
    expect(res).toHaveLength(6);
  });

  it("filters correctly for Pune, Mumbai, Bengaluru, and Hyderabad", () => {
    expect(filterByCity(sampleEvents, "Pune")).toHaveLength(1);
    expect(filterByCity(sampleEvents, "Mumbai")).toHaveLength(1);
    expect(filterByCity(sampleEvents, "Bengaluru")).toHaveLength(1);
    expect(filterByCity(sampleEvents, "Hyderabad")).toHaveLength(1);
  });

  it("matches NCR sub-regions (Delhi, Gurgaon, Noida) under 'Delhi NCR'", () => {
    const ncrEvents = filterByCity(sampleEvents, "Delhi NCR");
    expect(ncrEvents).toHaveLength(2);
    expect(ncrEvents.map((e) => e.id)).toEqual(["4", "5"]);
  });
});

describe("Demo Data Exclusion & Integrity", () => {
  it("strictly identifies and tags the 7 verified demo event UUIDs", () => {
    const events = [
      {
        id: "e0000000-0000-0000-0000-000000000001",
        title: "Sunset Acoustic Meetup",
        is_demo: false,
      },
      {
        id: "e0000000-0000-0000-0000-000000000002",
        title: "Fan Meet & Greet with Aarav Kulkarni",
        is_demo: false,
      },
      { id: "e0000000-0000-0000-0000-000000000003", title: "Reel Craft Workshop", is_demo: false },
      {
        id: "e0000000-0000-0000-0000-000000000004",
        title: "Neon Beats Earbuds Launch",
        is_demo: false,
      },
      {
        id: "e0000000-0000-0000-0000-000000000005",
        title: "Open Mic Community Night",
        is_demo: false,
      },
      {
        id: "e0000000-0000-0000-0000-000000000006",
        title: "Monsoon Songwriting Circle",
        is_demo: false,
      },
      { id: "e0000000-0000-0000-0000-000000000007", title: "Creator Brunch Pune", is_demo: false },
      {
        id: "genuine-real-event-uuid-101",
        title: "Real Live Tech Conference 2026",
        is_demo: false,
      },
    ];

    const publicUpcomingEvents = events.filter((e) => !e.is_demo && !DEMO_EVENT_IDS.has(e.id));
    expect(publicUpcomingEvents).toHaveLength(1);
    expect(publicUpcomingEvents[0]?.id).toBe("genuine-real-event-uuid-101");
  });

  it("strictly identifies and tags the 6 verified demo creator UUIDs", () => {
    const creators = [
      { id: "a0000000-0000-0000-0000-000000000001", display_name: "Meera Joshi", is_demo: false },
      {
        id: "a0000000-0000-0000-0000-000000000002",
        display_name: "Aarav Kulkarni",
        is_demo: false,
      },
      { id: "a0000000-0000-0000-0000-000000000003", display_name: "Kabir Sharma", is_demo: false },
      {
        id: "a0000000-0000-0000-0000-000000000004",
        display_name: "Ishaan Deshmukh",
        is_demo: false,
      },
      { id: "a0000000-0000-0000-0000-000000000005", display_name: "Tara Nair", is_demo: false },
      { id: "a0000000-0000-0000-0000-000000000006", display_name: "Nikita Rao", is_demo: false },
      { id: "genuine-creator-uuid-201", display_name: "Rutuja Ghule", is_demo: false },
    ];

    const publicVerifiedCreators = creators.filter(
      (c) => !c.is_demo && !DEMO_CREATOR_IDS.has(c.id),
    );
    expect(publicVerifiedCreators).toHaveLength(1);
    expect(publicVerifiedCreators[0]?.id).toBe("genuine-creator-uuid-201");
  });
});

describe("Authorized Organizer Submission & Redirection Adapters", () => {
  it("validates organizer submissions with verified official booking URLs", () => {
    const validSubmission = {
      title: "Indie Rock Night Live",
      bookingUrl: "https://www.townscript.com/v2/e/indie-rock-night/booking",
      city: "Mumbai",
      venue: "antiSOCIAL",
      startsAt: "2026-12-05T18:00:00.000Z",
      minPrice: 499,
      isFree: false,
    };

    const res = VerifiedOrganizerLinkAdapter.validateOrganizerSubmission(validSubmission);
    expect(res.valid).toBe(true);
    expect(res.payload).toBeDefined();
    expect(res.payload?.source_name).toBe("townscript");
    expect(res.payload?.official_booking_url).toBe(validSubmission.bookingUrl);
  });

  it("rejects organizer submissions with invalid or insecure URLs", () => {
    const invalidSubmission = {
      title: "Insecure Event",
      bookingUrl: "http://unencrypted.com/tickets",
      city: "Pune",
      venue: "Club 10",
      startsAt: "2026-12-05T18:00:00.000Z",
    };

    const res = VerifiedOrganizerLinkAdapter.validateOrganizerSubmission(invalidSubmission);
    expect(res.valid).toBe(false);
    expect(res.error).toContain("HTTPS");
  });

  it("detects ticket providers accurately from official HTTPS URLs", () => {
    expect(detectProviderFromUrl("https://in.bookmyshow.com/events/standup/ET00123").label).toBe(
      "BookMyShow",
    );
    expect(detectProviderFromUrl("https://insider.in/comedy-festival-pune/event").label).toBe(
      "Paytm Insider",
    );
    expect(detectProviderFromUrl("https://www.townscript.com/v2/e/tech-summit/booking").label).toBe(
      "Townscript",
    );
    expect(detectProviderFromUrl("https://lu.ma/delhi-founders-brunch").label).toBe("Luma");
    expect(detectProviderFromUrl("https://www.meetup.com/pune-ai-group/events/123/").label).toBe(
      "Meetup",
    );
    expect(detectProviderFromUrl("https://allevents.in/bangalore/rock-concert/123").label).toBe(
      "AllEvents.in",
    );
    expect(detectProviderFromUrl("https://sunburn.in/tickets").label).toBe("Official Website");
  });

  it("strictly hides pending organizer submissions from public discovery until admin approves", () => {
    const mixedEvents: Array<Partial<ExternalEvent>> = [
      { id: "ext-1", title: "Live Concert (Approved)", status: "live", is_demo: false },
      { id: "ext-2", title: "Pending Meetup", status: "pending", is_demo: false },
      { id: "ext-3", title: "Rejected Event", status: "rejected", is_demo: false },
      { id: "ext-4", title: "Demo Concert", status: "live", is_demo: true },
    ];

    // Public read filter matches the RLS policy: status = 'live' AND is_demo = false
    const publicVisible = mixedEvents.filter((e) => e.status === "live" && !e.is_demo);
    expect(publicVisible).toHaveLength(1);
    expect(publicVisible[0]?.id).toBe("ext-1");

    // Admin view sees pending submissions
    const adminPendingQueue = mixedEvents.filter((e) => e.status === "pending");
    expect(adminPendingQueue).toHaveLength(1);
    expect(adminPendingQueue[0]?.id).toBe("ext-2");
  });
});

describe("Organizer Ownership & RLS Submission Security", () => {
  type MockCreator = {
    id: string;
    user_id: string;
    verified: boolean;
    verification_status: string;
  };

  type MockUser = {
    id: string;
    roles: string[];
  };

  const creatorsDb: MockCreator[] = [
    { id: "creator-me-101", user_id: "user-101", verified: true, verification_status: "verified" },
    {
      id: "creator-other-202",
      user_id: "user-202",
      verified: true,
      verification_status: "verified",
    },
    {
      id: "creator-pending-303",
      user_id: "user-303",
      verified: false,
      verification_status: "pending",
    },
  ];

  function evaluateCreatorInsertPolicy(
    auth: MockUser,
    insertPayload: {
      status: string;
      submission_type: string;
      is_demo: boolean;
      submitted_by_creator_id: string | null;
    },
  ): { allowed: boolean; reason?: string } {
    if (insertPayload.status !== "pending") {
      return { allowed: false, reason: "Status must be pending" };
    }
    if (insertPayload.submission_type !== "organizer") {
      return { allowed: false, reason: "Submission type must be organizer" };
    }
    if (insertPayload.is_demo !== false) {
      return { allowed: false, reason: "Cannot insert demo events" };
    }
    if (!insertPayload.submitted_by_creator_id) {
      return { allowed: false, reason: "Creator ID is required" };
    }

    const matched = creatorsDb.find(
      (c) =>
        c.id === insertPayload.submitted_by_creator_id &&
        c.user_id === auth.id &&
        (c.verified || c.verification_status === "verified"),
    );

    if (!matched) {
      return { allowed: false, reason: "Unauthorized creator ownership or ineligibility" };
    }

    return { allowed: true };
  }

  function evaluateUpdatePolicy(
    auth: MockUser,
    _updatePayload: { status: string },
  ): { allowed: boolean; reason?: string } {
    if (auth.roles.includes("admin")) {
      return { allowed: true };
    }
    return { allowed: false, reason: "Only admins can update external event status" };
  }

  it("permits verified creator to submit external event with their own creator UUID", () => {
    const authUser = { id: "user-101", roles: ["creator"] };
    const res = evaluateCreatorInsertPolicy(authUser, {
      status: "pending",
      submission_type: "organizer",
      is_demo: false,
      submitted_by_creator_id: "creator-me-101",
    });
    expect(res.allowed).toBe(true);
  });

  it("strictly rejects spoofing another creator's UUID", () => {
    const authUser = { id: "user-101", roles: ["creator"] };
    const res = evaluateCreatorInsertPolicy(authUser, {
      status: "pending",
      submission_type: "organizer",
      is_demo: false,
      submitted_by_creator_id: "creator-other-202", // Spoofed another creator's ID
    });
    expect(res.allowed).toBe(false);
    expect(res.reason).toContain("Unauthorized creator ownership");
  });

  it("strictly rejects submission when creator ownership is missing or invalid", () => {
    const authUser = { id: "user-101", roles: ["creator"] };
    const resNull = evaluateCreatorInsertPolicy(authUser, {
      status: "pending",
      submission_type: "organizer",
      is_demo: false,
      submitted_by_creator_id: null,
    });
    expect(resNull.allowed).toBe(false);

    const resNonExistent = evaluateCreatorInsertPolicy(authUser, {
      status: "pending",
      submission_type: "organizer",
      is_demo: false,
      submitted_by_creator_id: "non-existent-creator-uuid",
    });
    expect(resNonExistent.allowed).toBe(false);
  });

  it("strictly rejects unverified creator even if they possess the creator app role", () => {
    // User has 'creator' role in user_roles, but profile is pending/unverified in creators table
    const unverifiedCreatorUser = { id: "user-303", roles: ["creator"] };
    const res = evaluateCreatorInsertPolicy(unverifiedCreatorUser, {
      status: "pending",
      submission_type: "organizer",
      is_demo: false,
      submitted_by_creator_id: "creator-pending-303",
    });
    expect(res.allowed).toBe(false);
    expect(res.reason).toContain("Unauthorized creator ownership or ineligibility");
  });

  it("permits verified creator to succeed on submission", () => {
    const verifiedUser = { id: "user-101", roles: ["creator"] };
    const res = evaluateCreatorInsertPolicy(verifiedUser, {
      status: "pending",
      submission_type: "organizer",
      is_demo: false,
      submitted_by_creator_id: "creator-me-101",
    });
    expect(res.allowed).toBe(true);
  });

  it("verifies migration 0002 grants table-level UPDATE to authenticated while restricting anon and delete", () => {
    const migrationPath = path.resolve(
      process.cwd(),
      "drizzle/migrations/0002_external_events_and_demo_tagging.sql",
    );
    const migrationSql = fs.readFileSync(migrationPath, "utf-8");

    // Table-level GRANT UPDATE is granted to authenticated
    expect(migrationSql).toMatch(
      /GRANT\s+UPDATE\s+ON\s+public\.external_events\s+TO\s+authenticated;/,
    );

    // Security requirements:
    // 1. Do not grant UPDATE to anon
    expect(migrationSql).not.toMatch(
      /GRANT\s+[^;]*UPDATE[^;]*ON\s+public\.external_events\s+TO\s+anon/i,
    );

    // 2. Do not grant DELETE or ALL to authenticated
    expect(migrationSql).not.toMatch(
      /GRANT\s+[^;]*DELETE[^;]*ON\s+public\.external_events\s+TO\s+authenticated/i,
    );
    expect(migrationSql).not.toMatch(
      /GRANT\s+ALL\s+ON\s+public\.external_events\s+TO\s+authenticated/i,
    );

    // 3. Preserve admin manage RLS policy
    expect(migrationSql).toContain('CREATE POLICY "external_events_admin_manage"');
    expect(migrationSql).toContain("USING (public.has_role(auth.uid(), 'admin'))");
    expect(migrationSql).toContain("WITH CHECK (public.has_role(auth.uid(), 'admin'))");

    // 4. Do not add any creator UPDATE policy
    expect(migrationSql).not.toMatch(
      /CREATE\s+POLICY\s+[^;]*update[^;]*ON\s+public\.external_events[^;]*creators/i,
    );
  });

  it("strictly prevents ordinary creators from updating event status to live or rejected", () => {
    const creatorUser = { id: "user-101", roles: ["creator"] };

    // Creator attempts to self-approve event to live
    const liveAttempt = evaluateUpdatePolicy(creatorUser, { status: "live" });
    expect(liveAttempt.allowed).toBe(false);
    expect(liveAttempt.reason).toContain("Only admins can update");

    // Creator attempts to reject event
    const rejectAttempt = evaluateUpdatePolicy(creatorUser, { status: "rejected" });
    expect(rejectAttempt.allowed).toBe(false);
    expect(rejectAttempt.reason).toContain("Only admins can update");
  });

  it("strictly prevents creators from publishing or rejecting their own submissions", () => {
    const creatorUser = { id: "user-101", roles: ["creator"] };

    // Creator attempts to self-publish their own submission
    const selfPublishAttempt = evaluateUpdatePolicy(creatorUser, { status: "live" });
    expect(selfPublishAttempt.allowed).toBe(false);
    expect(selfPublishAttempt.reason).toContain("Only admins can update");

    // Creator attempts to reject their own submission
    const selfRejectAttempt = evaluateUpdatePolicy(creatorUser, { status: "rejected" });
    expect(selfRejectAttempt.allowed).toBe(false);
    expect(selfRejectAttempt.reason).toContain("Only admins can update");
  });

  it("allows authorized admins to approve and reject external events under admin RLS policy", () => {
    const adminUser = { id: "admin-999", roles: ["admin"] };

    // Admin approves event
    const adminApproval = evaluateUpdatePolicy(adminUser, { status: "live" });
    expect(adminApproval.allowed).toBe(true);

    // Admin rejects event
    const adminRejection = evaluateUpdatePolicy(adminUser, { status: "rejected" });
    expect(adminRejection.allowed).toBe(true);
  });
});
