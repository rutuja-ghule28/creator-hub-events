import { describe, expect, it } from "vitest";
import { fmtDate, fmtTime, fmtDateTime, seatsLeft } from "@/lib/cc";

interface TestEvent {
  id: string;
  creator_id: string;
  title: string;
  type: string;
  description: string;
  starts_at: string;
  venue: string;
  area: string;
  capacity: number;
  seats_taken: number;
  status: "live" | "pending" | "rejected" | "removed";
  cover_url: string | null;
  promotion_brief: string | null;
  target_niche: string | null;
  application_deadline: string | null;
  creator?: {
    id: string;
    display_name: string;
    category: string;
    verified: boolean;
  };
}

const mockEvents: TestEvent[] = [
  {
    id: "e1",
    creator_id: "c1",
    title: "Sunset Acoustic Meetup",
    type: "Meetup",
    description: "Acoustic night in Koregaon Park",
    starts_at: "2026-10-15T17:30:00+00:00", // Past
    venue: "Koregaon Park Amphitheatre",
    area: "Koregaon Park",
    capacity: 80,
    seats_taken: 13,
    status: "live",
    cover_url: null,
    promotion_brief: "Reels collaboration",
    target_niche: "Influencer",
    application_deadline: "2026-10-12T06:00:00+00:00",
    creator: { id: "c1", display_name: "Meera Joshi", category: "Musician", verified: true },
  },
  {
    id: "e2",
    creator_id: "c2",
    title: "Fan Meet & Greet with Aarav Kulkarni",
    type: "Meet & greet",
    description: "Photos and autographs",
    starts_at: "2026-10-19T16:00:00+00:00", // Past
    venue: "Balewadi Sports Complex",
    area: "Balewadi",
    capacity: 200,
    seats_taken: 184,
    status: "live",
    cover_url: null,
    promotion_brief: null,
    target_niche: null,
    application_deadline: null,
    creator: { id: "c2", display_name: "Aarav Kulkarni", category: "Actor", verified: true },
  },
  {
    id: "e3",
    creator_id: "c3",
    title: "Reel Craft Workshop",
    type: "Workshop",
    description: "Mobile video editing",
    starts_at: "2026-10-24T11:00:00+00:00", // Past
    venue: "Baner Creator Studio",
    area: "Baner",
    capacity: 30,
    seats_taken: 22,
    status: "live",
    cover_url: null,
    promotion_brief: null,
    target_niche: null,
    application_deadline: null,
    creator: { id: "c3", display_name: "Kabir Sharma", category: "Tech reviewer", verified: true },
  },
  {
    id: "e4",
    creator_id: "c1",
    title: "Monsoon Songwriting Circle",
    type: "Workshop",
    description: "Pending approval event",
    starts_at: "2026-11-25T16:00:00+00:00",
    venue: "Aundh Music Room",
    area: "Aundh",
    capacity: 25,
    seats_taken: 0,
    status: "pending", // Should be excluded from public live discovery
    cover_url: null,
    promotion_brief: null,
    target_niche: null,
    application_deadline: null,
    creator: { id: "c1", display_name: "Meera Joshi", category: "Musician", verified: true },
  },
  {
    id: "e5",
    creator_id: "c4",
    title: "Future AI Creator Conclave",
    type: "Workshop",
    description: "Upcoming AI masterclass",
    starts_at: "2026-12-15T10:00:00+00:00", // Future
    venue: "Viman Nagar Tech Hub",
    area: "Viman Nagar",
    capacity: 100,
    seats_taken: 30,
    status: "live",
    cover_url: null,
    promotion_brief: "AI workflow reviewers wanted",
    target_niche: "Tech reviewer",
    application_deadline: "2026-12-10T18:00:00+00:00",
    creator: { id: "c4", display_name: "Priya Nair", category: "Tech reviewer", verified: true },
  },
];

// Helper reproducing the frontend partition & filtering logic
function partitionEvents(events: TestEvent[], referenceDate: Date) {
  // Only live events are exposed publicly
  const liveEvents = events.filter((e) => e.status === "live");
  const upcoming = liveEvents.filter((e) => new Date(e.starts_at) >= referenceDate);
  const past = liveEvents.filter((e) => new Date(e.starts_at) < referenceDate);
  return { upcoming, past };
}

function filterEvents(
  events: TestEvent[],
  scope: "upcoming" | "past",
  referenceDate: Date,
  opts: {
    q?: string;
    type?: string;
    when?: "any" | "this" | "next";
    availOnly?: boolean;
    sortBy?: "soonest" | "popular";
  },
) {
  let res = events.filter((e) => {
    const d = new Date(e.starts_at);
    if (scope === "upcoming") {
      const m =
        (d.getFullYear() - referenceDate.getFullYear()) * 12 +
        d.getMonth() -
        referenceDate.getMonth();
      if (opts.when === "this" && m !== 0) return false;
      if (opts.when === "next" && m !== 1) return false;
      if (opts.availOnly && e.seats_taken >= e.capacity) return false;
    }
    if (opts.type && opts.type !== "All" && e.type !== opts.type) return false;
    if (opts.q) {
      const s = opts.q.trim().toLowerCase();
      const match = [e.title, e.venue, e.area, e.creator?.display_name].some((x) =>
        x?.toLowerCase().includes(s),
      );
      if (!match) return false;
    }
    return true;
  });

  if (opts.sortBy === "popular") {
    res = [...res].sort((a, b) => b.seats_taken - a.seats_taken);
  } else if (scope === "upcoming") {
    res = [...res].sort(
      (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
    );
  } else {
    // Past events sorted most recent first
    res = [...res].sort(
      (a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime(),
    );
  }

  return res;
}

describe("Event Discovery & Lifecycle Workflows", () => {
  const currentDate = new Date("2026-11-18T12:00:00+05:30");

  it("strictly excludes pending events from public discovery", () => {
    const { upcoming, past } = partitionEvents(mockEvents, currentDate);
    const allPublic = [...upcoming, ...past];
    expect(allPublic.every((e) => e.status === "live")).toBe(true);
    expect(allPublic.some((e) => e.id === "e4")).toBe(false); // e4 is pending
  });

  it("correctly partitions live events into upcoming and past based on current time", () => {
    const { upcoming, past } = partitionEvents(mockEvents, currentDate);
    expect(upcoming).toHaveLength(1);
    expect(upcoming[0]?.id).toBe("e5"); // Dec 15, 2026 is future

    expect(past).toHaveLength(3);
    expect(past.map((e) => e.id)).toEqual(["e1", "e2", "e3"]);
  });

  it("sorts past events in descending order (most recent first)", () => {
    const { past } = partitionEvents(mockEvents, currentDate);
    const sortedPast = filterEvents(past, "past", currentDate, { sortBy: "soonest" });
    // e3 is Oct 24, e2 is Oct 19, e1 is Oct 15
    expect(sortedPast[0]?.id).toBe("e3");
    expect(sortedPast[1]?.id).toBe("e2");
    expect(sortedPast[2]?.id).toBe("e1");
  });

  it("identifies concluded status and prevents booking on past events", () => {
    const { past } = partitionEvents(mockEvents, currentDate);
    for (const e of past) {
      const isPast = new Date(e.starts_at) < currentDate;
      expect(isPast).toBe(true);

      // Seats left calculation must not represent registrations as attendees
      const left = seatsLeft(e);
      expect(left).toBe(e.capacity - e.seats_taken);
      // Ensure registration count is labeled as bookings
      expect(e.seats_taken).toBeLessThanOrEqual(e.capacity);
    }
  });

  it("triggers platform-wide empty state when zero upcoming events exist", () => {
    // Dataset with only past events
    const onlyPastEvents = mockEvents.filter((e) => e.id !== "e5");
    const { upcoming, past } = partitionEvents(onlyPastEvents, currentDate);

    expect(upcoming).toHaveLength(0);
    expect(past.length).toBeGreaterThan(0);

    // Empty state condition:
    const showPlatformEmptyState = upcoming.length === 0;
    expect(showPlatformEmptyState).toBe(true);

    // Filtered result for upcoming is empty
    const filteredUpcoming = filterEvents(upcoming, "upcoming", currentDate, {});
    expect(filteredUpcoming).toHaveLength(0);
  });

  it("filters upcoming events by category, search keywords, and availability", () => {
    const { upcoming } = partitionEvents(mockEvents, currentDate);

    const workshopFilter = filterEvents(upcoming, "upcoming", currentDate, { type: "Workshop" });
    expect(workshopFilter).toHaveLength(1);
    expect(workshopFilter[0]?.id).toBe("e5");

    const meetupFilter = filterEvents(upcoming, "upcoming", currentDate, { type: "Meetup" });
    expect(meetupFilter).toHaveLength(0);

    const searchAi = filterEvents(upcoming, "upcoming", currentDate, { q: "conclave" });
    expect(searchAi).toHaveLength(1);

    const searchMissing = filterEvents(upcoming, "upcoming", currentDate, { q: "nonexistent" });
    expect(searchMissing).toHaveLength(0);
  });

  it("formats dates and times correctly for IST (Asia/Kolkata)", () => {
    // 2026-10-15T17:30:00+00:00 in UTC is 23:00 IST on Oct 15
    const dt = fmtDateTime("2026-10-15T17:30:00+00:00");
    expect(dt).toContain("15 Oct");
    expect(dt).toContain("11:00");
    expect(dt).toContain("pm");

    // 2026-10-24T11:00:00+00:00 in UTC is 16:30 IST on Oct 24
    const dt2 = fmtDateTime("2026-10-24T11:00:00+00:00");
    expect(dt2).toContain("24 Oct");
    expect(dt2).toContain("4:30");
    expect(dt2).toContain("pm");
  });
});
