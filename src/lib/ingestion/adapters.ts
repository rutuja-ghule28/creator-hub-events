import { validateExternalUrl, type ExternalEvent } from "../external-events";

export type IngestedEventPayload = Omit<
  ExternalEvent,
  | "id"
  | "created_at"
  | "updated_at"
  | "submitted_by_creator_id"
  | "submitted_by_organizer_id"
  | "submission_type"
> & {
  submitted_by_creator_id?: string | null | undefined;
  submitted_by_organizer_id?: string | null | undefined;
  submission_type?: string | undefined;
};

export interface EventSourceAdapter {
  sourceName: string;
  isAvailable(): boolean;
  fetchEventsByCity(city: string): Promise<IngestedEventPayload[]>;
  verifyEvent(sourceEventId: string): Promise<{ active: boolean; payload?: IngestedEventPayload }>;
}

/**
 * Townscript Organizer/Event Integration Adapter
 * Connects to Townscript's public event data endpoint:
 * https://www.townscript.com/api/bookingflow/eventPageData?eventCode=...
 */
export class TownscriptAdapter implements EventSourceAdapter {
  public readonly sourceName = "townscript";

  isAvailable(): boolean {
    return true; // Endpoint is public per eventCode without requiring client secrets
  }

  async verifyEvent(
    eventCode: string,
  ): Promise<{ active: boolean; payload?: IngestedEventPayload }> {
    const cleanCode = eventCode.trim().toLowerCase();
    if (!cleanCode) return { active: false };

    try {
      const res = await fetch(
        `https://www.townscript.com/api/bookingflow/eventPageData?eventCode=${encodeURIComponent(cleanCode)}`,
        {
          headers: {
            Accept: "application/json",
            "User-Agent": "CreatorConnect/2.0 EventDiscovery (admin@creatorconnect.app)",
          },
        },
      );

      if (!res.ok) {
        return { active: false };
      }

      const data = await res.json();
      if (!data || !data.eventDetails) {
        return { active: false };
      }

      const details = data.eventDetails;
      const canonicalUrl = `https://www.townscript.com/e/${cleanCode}`;
      const bookingUrl = `https://www.townscript.com/v2/e/${cleanCode}/booking`;

      const urlVal = validateExternalUrl(bookingUrl);
      if (!urlVal.valid || !urlVal.normalizedUrl) {
        return { active: false };
      }

      const startsAt = details.startDateTime
        ? new Date(details.startDateTime).toISOString()
        : new Date().toISOString();
      const endsAt = details.endDateTime ? new Date(details.endDateTime).toISOString() : null;

      // Extract pricing tiers
      let minPrice: number | null = null;
      let maxPrice: number | null = null;
      let isFree = true;

      if (Array.isArray(data.ticketDetails) && data.ticketDetails.length > 0) {
        const prices: number[] = [];
        for (const t of data.ticketDetails) {
          const price = Number(t.price ?? t.totalPrice ?? 0);
          if (price > 0) {
            prices.push(price);
            isFree = false;
          }
        }
        if (prices.length > 0) {
          minPrice = Math.min(...prices);
          maxPrice = Math.max(...prices);
        }
      }

      const payload: IngestedEventPayload = {
        source_name: this.sourceName,
        source_event_id: cleanCode,
        source_event_url: canonicalUrl,
        official_booking_url: urlVal.normalizedUrl,
        title: details.eventName || "Townscript Event",
        description: details.eventDescription || "",
        category: mapCategory(details.eventCategory),
        starts_at: startsAt,
        ends_at: endsAt,
        venue_name: details.venueName || "Venue TBA",
        address: details.venueAddress || null,
        city: details.city || "Pune",
        state: details.state || null,
        country: "IN",
        ticket_price_min: minPrice,
        ticket_price_max: maxPrice,
        currency: "INR",
        is_free: isFree,
        cover_url: details.bannerImageUrl || null,
        status: new Date(startsAt) > new Date() ? "live" : "concluded",
        is_demo: false,
        source_last_verified_at: new Date().toISOString(),
      };

      return { active: true, payload };
    } catch {
      return { active: false };
    }
  }

  async fetchEventsByCity(_city: string): Promise<IngestedEventPayload[]> {
    // Townscript does not offer a free public global city-search API without organizer credentials.
    // Events must be verified and ingested via verified event codes.
    return [];
  }
}

/**
 * AllEvents.in Ingestion Adapter
 * Connects to AllEvents developer API via Azure APIM portal.
 */
export class AllEventsAdapter implements EventSourceAdapter {
  public readonly sourceName = "allevents";
  private apiKey: string | undefined;

  constructor(apiKey?: string) {
    this.apiKey =
      apiKey || (typeof process !== "undefined" ? process.env["ALLEVENTS_API_KEY"] : undefined);
  }

  isAvailable(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  async fetchEventsByCity(city: string): Promise<IngestedEventPayload[]> {
    if (!this.isAvailable()) {
      // Cleanly report access limitation without throwing or generating mock data
      return [];
    }

    try {
      const endpoint = `https://allevents.azure-api.net/events/list?city=${encodeURIComponent(city)}`;
      const res = await fetch(endpoint, {
        headers: {
          "Ocp-Apim-Subscription-Key": this.apiKey!,
          Accept: "application/json",
        },
      });

      if (!res.ok) {
        return [];
      }

      const json = await res.json();
      if (!json || !Array.isArray(json.data)) return [];

      const results: IngestedEventPayload[] = [];

      for (const item of json.data) {
        const bookingValidation = validateExternalUrl(item.event_url || item.tickets_url);
        if (!bookingValidation.valid || !bookingValidation.normalizedUrl) continue;

        const startsAt = item.start_time ? new Date(item.start_time * 1000).toISOString() : null;
        if (!startsAt) continue;

        results.push({
          source_name: this.sourceName,
          source_event_id: String(item.event_id),
          source_event_url: item.event_url || bookingValidation.normalizedUrl,
          official_booking_url: bookingValidation.normalizedUrl,
          title: item.event_name || "Live Event",
          description: item.description || "",
          category: mapCategory(item.category),
          starts_at: startsAt,
          ends_at: item.end_time ? new Date(item.end_time * 1000).toISOString() : null,
          venue_name: item.venue || "Venue TBA",
          address: item.location || null,
          city: city,
          state: item.state || null,
          country: "IN",
          ticket_price_min: item.min_price ? Number(item.min_price) : null,
          ticket_price_max: item.max_price ? Number(item.max_price) : null,
          currency: item.currency || "INR",
          is_free: Boolean(item.is_free || !item.min_price),
          cover_url: item.banner_url || null,
          status: new Date(startsAt) > new Date() ? "live" : "concluded",
          is_demo: false,
          source_last_verified_at: new Date().toISOString(),
        });
      }

      return results;
    } catch {
      return [];
    }
  }

  async verifyEvent(
    sourceEventId: string,
  ): Promise<{ active: boolean; payload?: IngestedEventPayload }> {
    if (!this.isAvailable()) return { active: false };
    try {
      const endpoint = `https://allevents.azure-api.net/events/details?event_id=${encodeURIComponent(sourceEventId)}`;
      const res = await fetch(endpoint, {
        headers: { "Ocp-Apim-Subscription-Key": this.apiKey! },
      });
      if (!res.ok) return { active: false };
      const item = await res.json();
      if (!item || !item.event_id) return { active: false };

      const urlVal = validateExternalUrl(item.tickets_url || item.event_url);
      if (!urlVal.valid || !urlVal.normalizedUrl) return { active: false };

      const startsAt = item.start_time
        ? new Date(item.start_time * 1000).toISOString()
        : new Date().toISOString();
      return {
        active: true,
        payload: {
          source_name: this.sourceName,
          source_event_id: String(item.event_id),
          source_event_url: item.event_url || urlVal.normalizedUrl,
          official_booking_url: urlVal.normalizedUrl,
          title: item.event_name || "Live Event",
          description: item.description || "",
          category: mapCategory(item.category),
          starts_at: startsAt,
          ends_at: item.end_time ? new Date(item.end_time * 1000).toISOString() : null,
          venue_name: item.venue || "Venue TBA",
          address: item.location || null,
          city: item.city || "Pune",
          state: item.state || null,
          country: "IN",
          ticket_price_min: item.min_price ? Number(item.min_price) : null,
          ticket_price_max: item.max_price ? Number(item.max_price) : null,
          currency: item.currency || "INR",
          is_free: Boolean(item.is_free || !item.min_price),
          cover_url: item.banner_url || null,
          status: new Date(startsAt) > new Date() ? "live" : "concluded",
          is_demo: false,
          source_last_verified_at: new Date().toISOString(),
        },
      };
    } catch {
      return { active: false };
    }
  }
}

/**
 * Organizer-Verified Official Ticketing Link Adapter
 * Safely validates organizer-submitted official booking links (e.g. BMS, Insider, Townscript, Luma).
 */
export class VerifiedOrganizerLinkAdapter {
  static validateOrganizerSubmission(input: {
    title: string;
    bookingUrl: string;
    sourceName?: string;
    city: string;
    venue: string;
    startsAt: string;
    category?: string;
    isFree?: boolean;
    minPrice?: number;
    maxPrice?: number;
  }): { valid: boolean; payload?: IngestedEventPayload; error?: string } {
    const urlValidation = validateExternalUrl(input.bookingUrl);
    if (!urlValidation.valid || !urlValidation.normalizedUrl) {
      return { valid: false, error: urlValidation.error || "Invalid booking URL" };
    }

    if (!input.title || input.title.trim().length < 3) {
      return { valid: false, error: "Event title must be at least 3 characters" };
    }

    if (!input.city || input.city.trim().length === 0) {
      return { valid: false, error: "City is required" };
    }

    if (!input.venue || input.venue.trim().length === 0) {
      return { valid: false, error: "Venue name is required" };
    }

    const startDate = new Date(input.startsAt);
    if (isNaN(startDate.getTime())) {
      return { valid: false, error: "Invalid start date format" };
    }

    const parsedUrl = new URL(urlValidation.normalizedUrl);
    let detectedSource = input.sourceName || "partner";
    if (parsedUrl.hostname.includes("townscript.com")) detectedSource = "townscript";
    else if (parsedUrl.hostname.includes("allevents.in")) detectedSource = "allevents";
    else if (parsedUrl.hostname.includes("meetup.com")) detectedSource = "meetup";
    else if (parsedUrl.hostname.includes("lu.ma")) detectedSource = "luma";
    else if (parsedUrl.hostname.includes("bookmyshow.com")) detectedSource = "bookmyshow";
    else if (parsedUrl.hostname.includes("insider.in")) detectedSource = "insider";

    const payload: IngestedEventPayload = {
      source_name: detectedSource,
      source_event_id: `org-${Math.abs(hashString(urlValidation.normalizedUrl))}`,
      source_event_url: urlValidation.normalizedUrl,
      official_booking_url: urlValidation.normalizedUrl,
      title: input.title.trim(),
      description: "",
      category: mapCategory(input.category),
      starts_at: startDate.toISOString(),
      ends_at: null,
      venue_name: input.venue.trim(),
      address: null,
      city: input.city.trim(),
      state: null,
      country: "IN",
      ticket_price_min: input.minPrice ?? null,
      ticket_price_max: input.maxPrice ?? null,
      currency: "INR",
      is_free: Boolean(input.isFree),
      cover_url: null,
      status: startDate > new Date() ? "live" : "concluded",
      is_demo: false,
      source_last_verified_at: new Date().toISOString(),
    };

    return { valid: true, payload };
  }
}

function mapCategory(raw?: string): string {
  if (!raw) return "Meetup";
  const lower = raw.toLowerCase();
  if (lower.includes("music") || lower.includes("concert") || lower.includes("acoustic"))
    return "Concert";
  if (lower.includes("comedy") || lower.includes("standup")) return "Comedy";
  if (lower.includes("workshop") || lower.includes("masterclass")) return "Workshop";
  if (lower.includes("festival") || lower.includes("flea") || lower.includes("carnival"))
    return "Festival";
  if (lower.includes("launch") || lower.includes("product")) return "Launch";
  return "Meetup";
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}
