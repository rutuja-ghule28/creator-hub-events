import { supabase } from "@/integrations/supabase/client";
import { fmtCount, type Creator, type EventRow, type EventWithCreator } from "@/lib/cc";

export interface MatchScoreBreakdown {
  nicheScore: number;
  nicheMax: number;
  nicheReason: string;
  locationScore: number;
  locationMax: number;
  locationReason: string;
  audienceScore: number;
  audienceMax: number;
  audienceReason: string;
  trustScore: number;
  trustMax: number;
  trustReason: string;
}

export interface CreatorMatchResult {
  creator: Creator;
  totalScore: number;
  matchLevel: "High Match" | "Moderate Match" | "Basic Match";
  breakdown: MatchScoreBreakdown;
}

/**
 * Normalizes city names for geographic proximity comparison.
 */
function extractCity(str: string | null | undefined): string | null {
  if (!str) return null;
  const s = str.toLowerCase();
  const knownCities = [
    "pune",
    "mumbai",
    "bangalore",
    "bengaluru",
    "delhi",
    "new delhi",
    "hyderabad",
    "chennai",
    "kolkata",
    "ahmedabad",
    "goa",
    "jaipur",
  ];
  for (const city of knownCities) {
    if (s.includes(city)) {
      if (city === "bengaluru") return "bangalore";
      if (city === "new delhi") return "delhi";
      return city;
    }
  }
  return null;
}

/**
 * Transparent Weighted Scoring Algorithm for Creator-Event Matching (0 - 100 points).
 *
 * Weight Distribution:
 * 1. Niche / Category Alignment: 40 points
 * 2. Location Proximity:        25 points
 * 3. Audience Size Suitability: 20 points
 * 4. Verification & Trust:      15 points
 */
export function calculateMatchScore(
  event: Pick<
    EventRow,
    "target_niche" | "type" | "title" | "venue" | "area" | "capacity" | "description"
  >,
  creator: Creator,
): CreatorMatchResult {
  // 1. NICHE ALIGNMENT (Max 40 points)
  let nicheScore = 10;
  let nicheReason = "Cross-category promotional potential";

  const eventTarget = event.target_niche?.trim().toLowerCase();
  const creatorCat = (creator.category || "").trim().toLowerCase();
  const eventTitle = (event.title || "").toLowerCase();
  const eventDesc = (event.description || "").toLowerCase();
  const eventType = (event.type || "").toLowerCase();

  if (eventTarget && creatorCat) {
    if (creatorCat === eventTarget) {
      nicheScore = 40;
      nicheReason = `Exact target niche match (${creator.category})`;
    } else if (
      creatorCat.includes(eventTarget) ||
      eventTarget.includes(creatorCat) ||
      (creatorCat === "tech reviewer" && eventTarget === "tech") ||
      (creatorCat === "musician" && eventTarget === "music")
    ) {
      nicheScore = 36;
      nicheReason = `Strong semantic alignment (${creator.category} ↔ ${event.target_niche})`;
    } else if (
      eventTitle.includes(creatorCat) ||
      eventDesc.includes(creatorCat) ||
      eventType.includes(creatorCat)
    ) {
      nicheScore = 30;
      nicheReason = `Matches event theme and description keywords`;
    } else {
      nicheScore = 15;
      nicheReason = `Secondary niche affinity (${creator.category} for ${event.target_niche || event.type})`;
    }
  } else if (!eventTarget || eventTarget === "all") {
    if (eventTitle.includes(creatorCat) || eventDesc.includes(creatorCat)) {
      nicheScore = 35;
      nicheReason = `Direct keyword alignment with event title & brief`;
    } else {
      nicheScore = 25;
      nicheReason = `General audience appeal (${creator.category})`;
    }
  }

  // 2. LOCATION PROXIMITY (Max 25 points)
  let locationScore = 10;
  let locationReason = "Regional/national creator reach";

  const eventCity = extractCity(event.venue) || extractCity(event.area) || "pune";
  const creatorCity = extractCity(creator.location);

  if (creatorCity && eventCity) {
    if (creatorCity === eventCity) {
      locationScore = 25;
      locationReason = `Local creator based in ${creator.location || "event city"}`;
    } else if (
      (creatorCity === "mumbai" && eventCity === "pune") ||
      (creatorCity === "pune" && eventCity === "mumbai")
    ) {
      locationScore = 18;
      locationReason = `High regional proximity (${creator.location} ↔ ${eventCity.toUpperCase()})`;
    } else {
      locationScore = 12;
      locationReason = `Inter-city guest creator (${creator.location || "Remote"})`;
    }
  } else if (creator.location) {
    locationScore = 15;
    locationReason = `Regional presence in ${creator.location}`;
  } else {
    locationScore = 8;
    locationReason = `Location unconfirmed (National distribution)`;
  }

  // 3. AUDIENCE SIZE SUITABILITY (Max 20 points)
  let audienceScore = 8;
  let audienceReason = "Emerging audience profile";

  const aud = creator.audience_size || 0;
  const cap = Math.max(1, event.capacity || 50);

  if (aud <= 0) {
    audienceScore = 5;
    audienceReason = "Audience metrics not yet reported";
  } else {
    // Estimated conversion rate to fill capacity: ~1% of follower base
    const estConversion = aud * 0.01;
    const ratio = estConversion / cap;

    if (ratio >= 0.5 && ratio <= 3.0) {
      audienceScore = 20;
      audienceReason = `Optimal capacity balance (${fmtCount(aud)} audience can comfortably fill ${cap} seats)`;
    } else if (ratio > 3.0) {
      audienceScore = 18;
      audienceReason = `High-reach celebrity impact (${fmtCount(aud)} audience offers maximum viral buzz)`;
    } else if (ratio >= 0.2) {
      audienceScore = 15;
      audienceReason = `Strong community presence (${fmtCount(aud)} followers)`;
    } else {
      audienceScore = 10;
      audienceReason = `Developing micro-creator reach (${fmtCount(aud)} followers)`;
    }
  }

  // 4. VERIFICATION & TRUST SIGNALS (Max 15 points)
  let trustScore = 6;
  let trustReason = "Self-reported creator profile";

  if (creator.verified) {
    const fieldCount = creator.verified_fields?.length || 0;
    const bonus = Math.min(3, fieldCount);
    trustScore = 12 + bonus;
    trustReason = `Verified Creator with ${fieldCount > 0 ? fieldCount + " verified criteria" : "confirmed credentials"}`;
  } else if (creator.verification_status === "pending") {
    trustScore = 9;
    trustReason = "Application submitted & pending platform audit";
  }

  const rawTotal = nicheScore + locationScore + audienceScore + trustScore;
  const totalScore = Math.min(100, Math.max(0, Math.round(rawTotal)));

  let matchLevel: "High Match" | "Moderate Match" | "Basic Match" = "Basic Match";
  if (totalScore >= 75) {
    matchLevel = "High Match";
  } else if (totalScore >= 55) {
    matchLevel = "Moderate Match";
  }

  return {
    creator,
    totalScore,
    matchLevel,
    breakdown: {
      nicheScore,
      nicheMax: 40,
      nicheReason,
      locationScore,
      locationMax: 25,
      locationReason,
      audienceScore,
      audienceMax: 20,
      audienceReason,
      trustScore,
      trustMax: 15,
      trustReason,
    },
  };
}

/**
 * Ranks a list of creators against an event and returns the top matches.
 */
export function rankCreatorsForEvent(
  event: EventRow,
  creators: Creator[],
  limit = 5,
): CreatorMatchResult[] {
  // Exclude the event organizer from being recommended to themselves
  const candidates = creators.filter((c) => c.id !== event.creator_id);

  const scored = candidates.map((creator) => calculateMatchScore(event, creator));

  // Sort descending by total score, then by audience size
  scored.sort((a, b) => {
    if (b.totalScore !== a.totalScore) {
      return b.totalScore - a.totalScore;
    }
    return (b.creator.audience_size || 0) - (a.creator.audience_size || 0);
  });

  return scored.slice(0, limit);
}

/**
 * Service function to fetch real creators and event data from Supabase and compute recommendations.
 */
export async function fetchEventCreatorMatches(
  eventId: string,
  limit = 5,
): Promise<{ event: EventWithCreator; recommendations: CreatorMatchResult[] }> {
  // 1. Fetch real event details
  const { data: eventData, error: eventErr } = await supabase
    .from("events")
    .select("*, creator:creators(*)")
    .eq("id", eventId)
    .single();

  if (eventErr) throw eventErr;
  if (!eventData) throw new Error("Event not found");

  // 2. Fetch all real creators from Supabase
  const { data: creatorsData, error: creatorsErr } = await supabase
    .from("creators")
    .select("*")
    .order("audience_size", { ascending: false });

  if (creatorsErr) throw creatorsErr;

  const event = eventData as unknown as EventWithCreator;
  const creators = (creatorsData ?? []) as Creator[];

  const recommendations = rankCreatorsForEvent(event, creators, limit);

  return {
    event,
    recommendations,
  };
}
