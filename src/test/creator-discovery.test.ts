import { describe, expect, it } from "vitest";

interface MockCreator {
  id: string;
  display_name: string;
  bio: string;
  category: string;
  location: string;
  audience_size: number;
  verified: boolean;
  page_views: number;
}

const mockCreators: MockCreator[] = [
  {
    id: "1",
    display_name: "Rohan Sharma",
    bio: "Tech reviewer and gadget enthusiast from Mumbai",
    category: "Tech",
    location: "Mumbai",
    audience_size: 45000,
    verified: true,
    page_views: 1200,
  },
  {
    id: "2",
    display_name: "Pooja Patel",
    bio: "Culinary artist sharing street food and heritage recipes",
    category: "Food",
    location: "Pune",
    audience_size: 15000,
    verified: false,
    page_views: 500,
  },
  {
    id: "3",
    display_name: "Amit Varma",
    bio: "Fitness coach & endurance runner",
    category: "Fitness",
    location: "Bangalore",
    audience_size: 85000,
    verified: true,
    page_views: 3400,
  },
  {
    id: "4",
    display_name: "Neha Gupta",
    bio: "Indie game streamer & developer",
    category: "Gaming",
    location: "Delhi",
    audience_size: 5000,
    verified: false,
    page_views: 200,
  },
];

function filterCreators(
  creators: MockCreator[],
  opts: {
    query?: string;
    niche?: string;
    location?: string;
    minFollowers?: number;
    verifiedOnly?: boolean;
    sortBy?: "followers" | "popular" | "name";
  },
) {
  let res = creators.filter((c) => {
    if (
      opts.niche &&
      opts.niche !== "All" &&
      c.category.toLowerCase() !== opts.niche.toLowerCase()
    ) {
      return false;
    }
    if (opts.location && opts.location !== "All") {
      if (!c.location.toLowerCase().includes(opts.location.toLowerCase())) {
        return false;
      }
    }
    if (opts.minFollowers && c.audience_size < opts.minFollowers) {
      return false;
    }
    if (opts.verifiedOnly && !c.verified) {
      return false;
    }
    if (opts.query) {
      const q = opts.query.trim().toLowerCase();
      const match =
        c.display_name.toLowerCase().includes(q) ||
        c.bio.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q) ||
        c.location.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  if (opts.sortBy === "followers") {
    res = [...res].sort((a, b) => b.audience_size - a.audience_size);
  } else if (opts.sortBy === "popular") {
    res = [...res].sort((a, b) => b.page_views - a.page_views);
  } else if (opts.sortBy === "name") {
    res = [...res].sort((a, b) => a.display_name.localeCompare(b.display_name));
  }

  return res;
}

describe("Creator Discovery Workflow", () => {
  it("filters creators by search query across name, bio, niche, and location", () => {
    const techSearch = filterCreators(mockCreators, { query: "tech" });
    expect(techSearch).toHaveLength(1);
    expect(techSearch[0]?.display_name).toBe("Rohan Sharma");

    const mumbaiSearch = filterCreators(mockCreators, { query: "mumbai" });
    expect(mumbaiSearch).toHaveLength(1);
    expect(mumbaiSearch[0]?.id).toBe("1");
  });

  it("filters creators by category/niche", () => {
    const fitnessCreators = filterCreators(mockCreators, { niche: "Fitness" });
    expect(fitnessCreators).toHaveLength(1);
    expect(fitnessCreators[0]?.display_name).toBe("Amit Varma");

    const allCreators = filterCreators(mockCreators, { niche: "All" });
    expect(allCreators).toHaveLength(4);
  });

  it("filters creators by audience size threshold", () => {
    const largeAudience = filterCreators(mockCreators, { minFollowers: 25000 });
    expect(largeAudience).toHaveLength(2); // Rohan (45k) and Amit (85k)
    expect(largeAudience.map((c) => c.display_name)).toEqual(
      expect.arrayContaining(["Rohan Sharma", "Amit Varma"]),
    );
  });

  it("filters creators by verification status", () => {
    const verifiedOnly = filterCreators(mockCreators, { verifiedOnly: true });
    expect(verifiedOnly).toHaveLength(2);
    expect(verifiedOnly.every((c) => c.verified)).toBe(true);
  });

  it("sorts creators by audience size, page views, and alphabetical name", () => {
    const byFollowers = filterCreators(mockCreators, { sortBy: "followers" });
    expect(byFollowers[0]?.display_name).toBe("Amit Varma");
    expect(byFollowers[byFollowers.length - 1]?.display_name).toBe("Neha Gupta");

    const byPopular = filterCreators(mockCreators, { sortBy: "popular" });
    expect(byPopular[0]?.page_views).toBe(3400);

    const byName = filterCreators(mockCreators, { sortBy: "name" });
    expect(byName[0]?.display_name).toBe("Amit Varma");
    expect(byName[1]?.display_name).toBe("Neha Gupta");
    expect(byName[2]?.display_name).toBe("Pooja Patel");
    expect(byName[3]?.display_name).toBe("Rohan Sharma");
  });
});
