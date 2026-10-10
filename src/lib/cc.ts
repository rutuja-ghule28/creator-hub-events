import { queryOptions, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Creator = Tables<"creators">;
export type EventRow = Tables<"events">;
export type EventWithCreator = EventRow & { creator: Creator | null };
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
  { kind: "application", label: "Application updates", hint: "When someone applies or your application is reviewed" },
  { kind: "campaign", label: "New matching campaigns", hint: "Campaigns that fit your niche" },
  { kind: "deadline", label: "Approaching deadlines", hint: "48 hours before applications close" },
  { kind: "event", label: "New events from creators you follow", hint: "When an event goes live" },
  { kind: "announcement", label: "Organiser updates", hint: "Announcements for events you follow or attend" },
  { kind: "verification", label: "Verification results", hint: "When your creator request is reviewed" },
] as const;

export const VERIFIABLE_FIELDS = [
  { key: "name", label: "Name", criteria: "Matches a government ID or an official public page." },
  { key: "niche", label: "Niche", criteria: "Most recent posts match the stated category." },
  { key: "audience", label: "Audience size", criteria: "Confirmed from analytics or a profile screenshot from the last 30 days, within 10%." },
  { key: "location", label: "Location", criteria: "Confirmed from ID, proof of address or past local events." },
  { key: "portfolio", label: "Portfolio links", criteria: "Every link opens and belongs to the creator." },
  { key: "contact", label: "Contact details", criteria: "Email or phone confirmed by a reply or a code." },
] as const;

export type Me = {
  id: string;
  email: string;
  profile: Tables<"profiles"> | null;
  roles: string[];
  creator: Creator | null;
};

export const meQuery = queryOptions({
  queryKey: ["me"],
  queryFn: async (): Promise<Me | null> => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    const [p, r, c] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", user.id),
      supabase.from("creators").select("*").eq("user_id", user.id).maybeSingle(),
    ]);
    return {
      id: user.id,
      email: user.email ?? "",
      profile: p.data,
      roles: (r.data ?? []).map((x) => x.role),
      creator: c.data,
    };
  },
  staleTime: 30_000,
});

export function useMe() {
  return useQuery(meQuery);
}

const tz = "Asia/Kolkata";
export function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: tz });
}
export function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: tz });
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
  if (e && typeof e === "object" && "message" in e) return String((e as { message: string }).message);
  return "Something went wrong. Please try again.";
}
export const EVENT_SELECT = "*, creator:creators(*)";
