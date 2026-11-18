import type { Tables } from "@/integrations/supabase/types";

export type ExternalEvent = Tables<"external_events">;

export const SUPPORTED_EXTERNAL_SOURCES = [
  "townscript",
  "allevents",
  "meetup",
  "luma",
  "bookmyshow",
  "insider",
  "partner",
  "organizer",
] as const;

export type ExternalSourceName = (typeof SUPPORTED_EXTERNAL_SOURCES)[number] | string;

export interface SourceMeta {
  key: string;
  label: string;
  domain: string;
  badgeClass: string;
  verifiedLabel: string;
}

export const SOURCE_METADATA: Record<string, SourceMeta> = {
  townscript: {
    key: "townscript",
    label: "Townscript",
    domain: "townscript.com",
    badgeClass: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    verifiedLabel: "Official Townscript Ticketing",
  },
  allevents: {
    key: "allevents",
    label: "AllEvents.in",
    domain: "allevents.in",
    badgeClass: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20",
    verifiedLabel: "Official AllEvents Partner",
  },
  meetup: {
    key: "meetup",
    label: "Meetup",
    domain: "meetup.com",
    badgeClass: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
    verifiedLabel: "Verified Meetup Community",
  },
  luma: {
    key: "luma",
    label: "Luma",
    domain: "lu.ma",
    badgeClass: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    verifiedLabel: "Official Luma Calendar",
  },
  bookmyshow: {
    key: "bookmyshow",
    label: "BookMyShow",
    domain: "bookmyshow.com",
    badgeClass: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
    verifiedLabel: "Official BMS Booking Link",
  },
  insider: {
    key: "insider",
    label: "Paytm Insider",
    domain: "insider.in",
    badgeClass: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
    verifiedLabel: "Official Insider Link",
  },
  partner: {
    key: "partner",
    label: "Official Partner",
    domain: "",
    badgeClass: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
    verifiedLabel: "Verified Organizer Link",
  },
  organizer: {
    key: "organizer",
    label: "Organizer Submission",
    domain: "",
    badgeClass: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    verifiedLabel: "Verified Organizer Submission",
  },
};

export function detectProviderFromUrl(url: string): {
  sourceName: string;
  label: string;
  domain: string;
} {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (host.includes("townscript.com"))
      return { sourceName: "townscript", label: "Townscript", domain: "townscript.com" };
    if (host.includes("bookmyshow.com"))
      return { sourceName: "bookmyshow", label: "BookMyShow", domain: "bookmyshow.com" };
    if (host.includes("insider.in") || host.includes("paytm.com"))
      return { sourceName: "insider", label: "Paytm Insider", domain: "insider.in" };
    if (host.includes("allevents.in"))
      return { sourceName: "allevents", label: "AllEvents.in", domain: "allevents.in" };
    if (host.includes("lu.ma")) return { sourceName: "luma", label: "Luma", domain: "lu.ma" };
    if (host.includes("meetup.com"))
      return { sourceName: "meetup", label: "Meetup", domain: "meetup.com" };
    return { sourceName: "partner", label: "Official Website", domain: host };
  } catch {
    return { sourceName: "partner", label: "Official Link", domain: "" };
  }
}

export function getSourceMeta(sourceName: string): SourceMeta {
  const normalized = sourceName.toLowerCase().trim();
  if (SOURCE_METADATA[normalized]) {
    return SOURCE_METADATA[normalized];
  }
  return {
    key: normalized,
    label: sourceName.charAt(0).toUpperCase() + sourceName.slice(1),
    domain: "",
    badgeClass: "bg-muted text-muted-foreground border-border",
    verifiedLabel: "Verified External Link",
  };
}

/**
 * Validates that an external URL is strictly HTTPS and well-formed.
 * Rejects javascript:, http:, file:, data:, and relative URLs.
 */
export function validateExternalUrl(url: string | null | undefined): {
  valid: boolean;
  normalizedUrl?: string;
  error?: string;
} {
  if (!url || typeof url !== "string") {
    return { valid: false, error: "URL is required" };
  }

  const trimmed = url.trim();
  if (!trimmed) {
    return { valid: false, error: "URL cannot be empty" };
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "https:") {
      return {
        valid: false,
        error: `Only secure HTTPS URLs are permitted. Received: ${parsed.protocol}`,
      };
    }

    if (!parsed.hostname || !parsed.hostname.includes(".")) {
      return { valid: false, error: "Invalid domain name in URL" };
    }

    // Check for disallowed characters or common injection attempts
    if (/[\s<>"'{}|\\^`]/i.test(trimmed)) {
      return { valid: false, error: "URL contains unsafe characters" };
    }

    return { valid: true, normalizedUrl: parsed.toString() };
  } catch {
    return { valid: false, error: "Malformed URL format" };
  }
}

/**
 * Formats pricing for display (INR symbol, ranges, or Free entry).
 */
export function formatExternalPrice(
  isFree: boolean,
  min?: number | null,
  max?: number | null,
  currency = "INR",
): string {
  if (isFree || (min === 0 && (max === null || max === undefined || max === 0))) {
    return "Free Entry";
  }

  const symbol = currency === "INR" ? "₹" : `${currency} `;

  if (min !== null && min !== undefined && min > 0) {
    const minFormatted = Math.round(min).toLocaleString("en-IN");
    if (max !== null && max !== undefined && max > min) {
      const maxFormatted = Math.round(max).toLocaleString("en-IN");
      return `${symbol}${minFormatted} – ${symbol}${maxFormatted}`;
    }
    return `${symbol}${minFormatted} onwards`;
  }

  if (max !== null && max !== undefined && max > 0) {
    return `Up to ${symbol}${Math.round(max).toLocaleString("en-IN")}`;
  }

  return "Official Ticketing";
}

/**
 * Deduplicates an array of external events by composite key (source_name + source_event_id).
 * Keeps the latest verified item when duplicates exist.
 */
export function deduplicateExternalEvents<
  T extends { source_name: string; source_event_id: string; source_last_verified_at?: string },
>(events: T[]): T[] {
  const map = new Map<string, T>();

  for (const event of events) {
    const key = `${event.source_name.toLowerCase()}::${event.source_event_id}`;
    const existing = map.get(key);

    if (!existing) {
      map.set(key, event);
    } else {
      // If existing exists, pick the one with later verification timestamp
      const existingTime = existing.source_last_verified_at
        ? new Date(existing.source_last_verified_at).getTime()
        : 0;
      const newTime = event.source_last_verified_at
        ? new Date(event.source_last_verified_at).getTime()
        : 0;
      if (newTime >= existingTime) {
        map.set(key, event);
      }
    }
  }

  return Array.from(map.values());
}

/**
 * Discriminated union representing an item in the unified Discover feed.
 */
export type UnifiedDiscoverEvent =
  | {
      sourceType: "creatorconnect";
      id: string;
      title: string;
      type: string;
      description: string;
      starts_at: string;
      venue: string;
      area: string;
      city: string;
      capacity: number;
      seats_taken: number;
      status: string;
      cover_url: string | null;
      is_demo: boolean;
      creator: {
        id: string;
        display_name: string;
        category: string;
        avatar_url: string | null;
        verified: boolean;
        is_demo: boolean;
      } | null;
    }
  | {
      sourceType: "external";
      id: string;
      title: string;
      type: string; // Maps to category
      description: string;
      starts_at: string;
      ends_at: string | null;
      venue: string;
      area: string;
      city: string;
      state: string | null;
      country: string;
      status: string;
      cover_url: string | null;
      source_name: string;
      source_event_id: string;
      source_event_url: string;
      official_booking_url: string;
      ticket_price_min: number | null;
      ticket_price_max: number | null;
      currency: string;
      is_free: boolean;
      source_last_verified_at: string;
      is_demo: boolean;
    };

export const MAJOR_INDIAN_CITIES = [
  "All India",
  "Pune",
  "Mumbai",
  "Bengaluru",
  "Delhi NCR",
  "Hyderabad",
  "Goa",
  "Kolkata",
  "Chennai",
  "Ahmedabad",
] as const;

export type IndianCity = (typeof MAJOR_INDIAN_CITIES)[number];
