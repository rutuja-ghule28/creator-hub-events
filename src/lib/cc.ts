import { queryOptions, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Creator = Tables<"creators">;
export type Organizer = Tables<"organizers">;
export type OrganizerPrivateDetails = Tables<"organizer_private_details">;
export type EventRow = Tables<"events">;
export type EventWithCreator = EventRow & { creator: Creator | null; organizer?: Organizer | null };
export type Registration = Tables<"registrations">;
export type Notification = Tables<"notifications">;

export const EVENT_TYPES = ["Meetup", "Meet & greet", "Workshop", "Launch", "Community"] as const;
export const NICHES = [
  "Musician",
  "Actor",
  "Influencer",
  "Tech reviewer",
  "Comedian",
  "Artist",
  "Fitness",
  "Food",
] as const;

export const ALERT_KINDS = [
  {
    kind: "application",
    label: "Application updates",
    hint: "When someone applies or your application is reviewed",
  },
  { kind: "campaign", label: "New matching campaigns", hint: "Campaigns that fit your niche" },
  { kind: "deadline", label: "Approaching deadlines", hint: "48 hours before applications close" },
  { kind: "event", label: "New events from creators you follow", hint: "When an event goes live" },
  {
    kind: "announcement",
    label: "Organiser updates",
    hint: "Announcements for events you follow or attend",
  },
  {
    kind: "verification",
    label: "Verification results",
    hint: "When your creator request is reviewed",
  },
] as const;

export const VERIFIABLE_FIELDS = [
  { key: "name", label: "Name", criteria: "Matches a government ID or an official public page." },
  { key: "niche", label: "Niche", criteria: "Most recent posts match the stated category." },
  {
    key: "audience",
    label: "Audience size",
    criteria: "Confirmed from analytics or a profile screenshot from the last 30 days, within 10%.",
  },
  {
    key: "location",
    label: "Location",
    criteria: "Confirmed from ID, proof of address or past local events.",
  },
  {
    key: "portfolio",
    label: "Portfolio links",
    criteria: "Every link opens and belongs to the creator.",
  },
  {
    key: "contact",
    label: "Contact details",
    criteria: "Email or phone confirmed by a reply or a code.",
  },
] as const;

export type AccountType = "attendee" | "creator" | "organizer";

export type Me = {
  id: string;
  email: string;
  profile: (Tables<"profiles"> & { account_type?: string }) | null;
  roles: string[];
  creator: Creator | null;
  organizer: (Organizer & { private_details?: OrganizerPrivateDetails | null }) | null;
};

export function resolvePostAuthRedirect({
  accountType,
  roles = [],
  creatorStatus,
  explicitRedirect,
}: {
  accountType?: string | null | undefined;
  roles?: string[] | undefined;
  creatorStatus?: { verified: boolean; verification_status: string } | null | undefined;
  explicitRedirect?: string | null | undefined;
}): string {
  if (
    explicitRedirect &&
    explicitRedirect.startsWith("/") &&
    !explicitRedirect.startsWith("//") &&
    !explicitRedirect.startsWith("/auth") &&
    explicitRedirect !== "/discover" &&
    explicitRedirect !== "/discover/1" &&
    explicitRedirect !== "/"
  ) {
    return explicitRedirect;
  }

  if (roles.includes("admin")) {
    return "/admin/verify";
  }

  const normalizedAccount = accountType?.toLowerCase();
  if (normalizedAccount === "organizer" || roles.includes("organizer")) {
    return "/creator/events";
  }

  if (normalizedAccount === "creator" || roles.includes("creator")) {
    if (creatorStatus?.verified || creatorStatus?.verification_status === "verified") {
      return "/creator/dashboard";
    }
    return "/profile";
  }

  return "/discover/1";
}

export type ResolvedRoleInfo = {
  primaryRole: "admin" | "organizer" | "creator" | "attendee";
  badgeLabel: string;
  displayTitle: string;
  badgeClass: string;
  description: string;
};

export function resolveUserRole(me: Me | null | undefined): ResolvedRoleInfo {
  if (!me) {
    return {
      primaryRole: "attendee",
      badgeLabel: "Attendee",
      displayTitle: "Attendee",
      badgeClass: "bg-brand/10 text-primary border-brand/20",
      description: "Explore upcoming events, reserve tickets, and follow favorite creators.",
    };
  }

  const roles = me.roles ?? [];
  const accountType = me.profile?.account_type?.toLowerCase();

  // Priority 1: Admin
  if (roles.includes("admin")) {
    return {
      primaryRole: "admin",
      badgeLabel: "Admin",
      displayTitle: "Platform Administrator",
      badgeClass: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
      description: "Platform oversight, verification queue review, and incident moderation.",
    };
  }

  // Priority 2: Organizer
  if (roles.includes("organizer") || accountType === "organizer" || Boolean(me.organizer)) {
    return {
      primaryRole: "organizer",
      badgeLabel: "Organizer",
      displayTitle: "Event Organizer & Host",
      badgeClass: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
      description: "Host ticketed meetups, manage venues, and curate attendee experiences.",
    };
  }

  // Priority 3: Verified Creator
  const isVerifiedCreator =
    roles.includes("creator") ||
    me.creator?.verified === true ||
    me.creator?.verification_status === "verified";

  if (isVerifiedCreator) {
    return {
      primaryRole: "creator",
      badgeLabel: "Creator",
      displayTitle: "Verified Creator",
      badgeClass: "bg-trust-soft text-trust border-trust/20",
      description: "Publish workshops, host campaigns, and connect with your audience.",
    };
  }

  // Priority 4: Pending / Submitted Creator
  if (accountType === "creator" || me.creator) {
    const isPending = me.creator?.verification_status === "pending" || !me.creator;
    return {
      primaryRole: "creator",
      badgeLabel: isPending ? "Creator (Pending)" : "Creator",
      displayTitle: isPending ? "Creator (Under Review)" : "Creator",
      badgeClass: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
      description: isPending
        ? "Your creator profile is currently undergoing verification by platform administrators."
        : "Creator profile submitted.",
    };
  }

  // Priority 5: Attendee default
  return {
    primaryRole: "attendee",
    badgeLabel: "Attendee",
    displayTitle: "Attendee",
    badgeClass: "bg-brand/10 text-primary border-brand/20",
    description: "Explore upcoming events, reserve tickets, and follow favorite creators.",
  };
}

export const meQuery = queryOptions({
  queryKey: ["me"],
  queryFn: async (): Promise<Me | null> => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    const [p, r, c, o] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", user.id),
      supabase.from("creators").select("*").eq("user_id", user.id).maybeSingle(),
      supabase
        .from("organizers")
        .select("*, private_details:organizer_private_details(*)")
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);
    return {
      id: user.id,
      email: user.email ?? "",
      profile: p.data,
      roles: (r.data ?? []).map((x) => x.role),
      creator: c.data,
      organizer: o.data,
    };
  },
  staleTime: 30_000,
});

export function useMe() {
  return useQuery(meQuery);
}

const tz = "Asia/Kolkata";
export function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: tz,
  });
}
export function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: tz,
  });
}
export function fmtDateTime(iso: string) {
  return `${fmtDate(iso)} · ${fmtTime(iso)}`;
}
export function fmtAgo(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
export function fmtCount(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(n);
}
export function seatsLeft(e: Pick<EventRow, "capacity" | "seats_taken">) {
  return Math.max(0, e.capacity - e.seats_taken);
}
export function errMsg(e: unknown) {
  if (e && typeof e === "object" && "message" in e)
    return String((e as { message: string }).message);
  return "Something went wrong. Please try again.";
}
export const EVENT_SELECT = "*, creator:creators(*), organizer:organizers(*)";
