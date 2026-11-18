import { useState, useMemo } from "react";
import { createFileRoute, Link, Outlet, useChildMatches } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PlusCircle, Search, CalendarDays, Globe, ExternalLink, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { EVENT_SELECT, errMsg, fmtDateTime, useMe, type EventWithCreator } from "@/lib/cc";
import { EmptyState, ErrorState, EventCover, ListSkeleton, StatusTag } from "@/components/cc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getSourceMeta, type ExternalEvent } from "@/lib/external-events";

export const Route = createFileRoute("/_authenticated/creator/events")({
  head: () => ({
    meta: [
      { title: "Manage Creator Events — CreatorConnect" },
      {
        name: "description",
        content:
          "Overview of all your hosted and upcoming creator events, capacity, and check-in status.",
      },
      { property: "og:site_name", content: "CreatorConnect" },
      { property: "og:title", content: "Manage Creator Events — CreatorConnect" },
      {
        property: "og:description",
        content:
          "Overview of all your hosted and upcoming creator events, capacity, and check-in status.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://creatorconnect.app/creator/events" },
      { property: "og:image", content: "https://creatorconnect.app/assets/og-image.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Manage Creator Events — CreatorConnect" },
      {
        name: "twitter:description",
        content:
          "Overview of all your hosted and upcoming creator events, capacity, and check-in status.",
      },
      { name: "twitter:image", content: "https://creatorconnect.app/assets/og-image.png" },
    ],
    links: [{ rel: "canonical", href: "https://creatorconnect.app/creator/events" }],
  }),
  component: CreatorEventsRoute,
});

function CreatorEventsRoute() {
  const childMatches = useChildMatches();
  if (childMatches.length > 0) {
    return <Outlet />;
  }
  return <CreatorEventsTablePage />;
}

type CreatorUnifiedItem =
  | {
      sourceType: "internal";
      id: string;
      title: string;
      venue: string;
      area: string;
      status: string;
      starts_at: string;
      seats_taken: number;
      capacity: number;
      cover_url: string | null;
      official_booking_url?: null;
      source_name?: null;
    }
  | {
      sourceType: "external";
      id: string;
      title: string;
      venue: string;
      area: string;
      status: string;
      starts_at: string;
      seats_taken?: number;
      capacity?: number;
      source_name: string;
      official_booking_url: string;
      cover_url: string | null;
    };

function CreatorEventsTablePage() {
  const { data: me, isLoading: meLoading } = useMe();
  const [filterTab, setFilterTab] = useState<"all" | "live" | "pending" | "removed">("all");
  const [searchQ, setSearchQ] = useState("");

  const isAuthorized =
    me?.roles?.includes("creator") ||
    me?.roles?.includes("organizer") ||
    me?.profile?.account_type === "creator" ||
    me?.profile?.account_type === "organizer" ||
    me?.roles?.includes("admin");

  const eventsQuery = useQuery({
    queryKey: ["creator-events-table", me?.creator?.id, me?.organizer?.id],
    queryFn: async () => {
      const creatorId = me?.creator?.id;
      const organizerId = me?.organizer?.id;
      if (!creatorId && !organizerId) return [];

      // 1. Fetch internal events
      let internalQuery = supabase.from("events").select(EVENT_SELECT);
      if (creatorId && organizerId) {
        internalQuery = internalQuery.or(
          `creator_id.eq.${creatorId},organizer_id.eq.${organizerId}`,
        );
      } else if (creatorId) {
        internalQuery = internalQuery.eq("creator_id", creatorId);
      } else if (organizerId) {
        internalQuery = internalQuery.eq("organizer_id", organizerId);
      }
      const { data: internalData, error: internalError } = await internalQuery.order("starts_at", {
        ascending: false,
      });
      if (internalError) throw internalError;

      // 2. Fetch external organizer submissions
      let externalData: ExternalEvent[] = [];
      try {
        let extQuery = supabase.from("external_events").select("*");
        if (creatorId && organizerId) {
          extQuery = extQuery.or(
            `submitted_by_creator_id.eq.${creatorId},submitted_by_organizer_id.eq.${organizerId}`,
          );
        } else if (creatorId) {
          extQuery = extQuery.eq("submitted_by_creator_id", creatorId);
        } else if (organizerId) {
          extQuery = extQuery.eq("submitted_by_organizer_id", organizerId);
        }
        const { data, error } = await extQuery.order("starts_at", { ascending: false });
        if (!error && data) externalData = data as ExternalEvent[];
      } catch {
        externalData = [];
      }

      const internalList: CreatorUnifiedItem[] = (
        (internalData ?? []) as unknown as EventWithCreator[]
      ).map((e) => ({
        sourceType: "internal" as const,
        id: e.id,
        title: e.title,
        venue: e.venue,
        area: e.area,
        status: e.status,
        starts_at: e.starts_at,
        seats_taken: e.seats_taken,
        capacity: e.capacity,
        cover_url: e.cover_url,
      }));

      const externalList: CreatorUnifiedItem[] = externalData.map((ext) => ({
        sourceType: "external" as const,
        id: ext.id,
        title: ext.title,
        venue: ext.venue_name,
        area: ext.city,
        status: ext.status,
        starts_at: ext.starts_at,
        source_name: ext.source_name,
        official_booking_url: ext.official_booking_url,
        cover_url: ext.cover_url,
      }));

      return [...internalList, ...externalList];
    },
    enabled: !!(me?.creator?.id || me?.organizer?.id),
  });

  const filtered = useMemo(() => {
    return (eventsQuery.data ?? []).filter((e) => {
      if (filterTab === "live" && e.status !== "live") return false;
      if (filterTab === "pending" && e.status !== "pending") return false;
      if (filterTab === "removed" && e.status !== "removed" && e.status !== "rejected")
        return false;

      const s = searchQ.trim().toLowerCase();
      return !s || [e.title, e.venue, e.area].some((x) => x?.toLowerCase().includes(s));
    });
  }, [eventsQuery.data, filterTab, searchQ]);

  if (meLoading) {
    return <ListSkeleton />;
  }

  if (me && !isAuthorized) {
    return (
      <main className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="size-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
          <Sparkles className="size-8" />
        </div>
        <h1 className="font-display text-2xl font-bold">Manage Events</h1>
        <p className="text-sm text-muted-foreground max-w-md">
          You are currently signed in as an Attendee. Event creation and attendee management tools
          are available for Creator and Host/Organizer accounts.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link to="/profile">
            <Button variant="brand" className="rounded-xl">
              Go to Profile to Apply
            </Button>
          </Link>
          <Link to="/discover/1">
            <Button variant="outline" className="rounded-xl">
              Discover Events
            </Button>
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="px-4 py-5 md:px-6 md:py-8 pb-24 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight">
            Manage Events
          </h1>
          <p className="text-sm text-muted-foreground">
            View and update all your event listings in a data table.
          </p>
        </div>
        <Button asChild variant="brand" className="gap-2 rounded-2xl font-semibold shadow-brand">
          <Link to="/creator/events/create">
            <PlusCircle className="size-4" /> Create Event
          </Link>
        </Button>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        {/* Filter Tabs */}
        <div className="flex bg-muted/60 p-1 rounded-2xl border border-border self-start">
          {(
            [
              ["all", "All Events"],
              ["live", "Official (Live)"],
              ["pending", "Awaiting review"],
              ["removed", "Removed / Rejected"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setFilterTab(k)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                filterTab === k
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Search Bar */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            placeholder="Search listings..."
            className="h-9 pl-9 rounded-xl text-xs bg-card"
          />
        </div>
      </div>

      {/* Events Desktop Data Table */}
      <div className="rounded-3xl bg-card border border-border overflow-hidden shadow-xs">
        {eventsQuery.isLoading ? (
          <div className="p-6">
            <ListSkeleton rows={4} />
          </div>
        ) : eventsQuery.error ? (
          <div className="p-6">
            <ErrorState message={errMsg(eventsQuery.error)} onRetry={() => eventsQuery.refetch()} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title="No matching events found"
              body="Try selecting another status tab or clearing your search."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/40 border-b border-border text-xs text-muted-foreground uppercase font-semibold">
                <tr>
                  <th className="py-3.5 px-4 w-16">Cover</th>
                  <th className="py-3.5 px-4">Title & Venue</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Date</th>
                  <th className="py-3.5 px-4">Registrations</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((e) => (
                  <tr key={e.id} className="hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4">
                      <div className="size-12 rounded-xl overflow-hidden relative border border-border shrink-0">
                        <EventCover
                          id={e.id}
                          src={e.cover_url}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {e.sourceType === "external" ? (
                        <>
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                              <Globe className="size-2.5" />
                              External • {getSourceMeta(e.source_name || "partner").label}
                            </span>
                          </div>
                          <Link
                            to="/events/$id"
                            params={{ id: e.id }}
                            className="font-semibold text-foreground hover:text-primary transition-colors block"
                          >
                            {e.title}
                          </Link>
                        </>
                      ) : (
                        <Link
                          to="/creator/events/$id/manage"
                          params={{ id: e.id }}
                          className="font-semibold text-foreground hover:text-primary transition-colors block"
                        >
                          {e.title}
                        </Link>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {e.venue}, {e.area}
                      </p>
                    </td>
                    <td className="py-3 px-4">
                      <StatusTag status={e.status} />
                    </td>
                    <td className="py-3 px-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <CalendarDays className="size-3.5 text-primary" />{" "}
                        {fmtDateTime(e.starts_at)}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-semibold text-xs text-foreground">
                      {e.sourceType === "external" ? (
                        <span className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                          <Globe className="size-3 text-primary" /> External Tickets
                        </span>
                      ) : (
                        `${e.seats_taken} / ${e.capacity} seats`
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {e.sourceType === "external" ? (
                        <div className="flex items-center justify-end gap-2">
                          <Link to="/events/$id" params={{ id: e.id }}>
                            <Button
                              variant="outline"
                              size="sm"
                              className="rounded-xl text-xs font-semibold"
                            >
                              Preview
                            </Button>
                          </Link>
                          {e.official_booking_url && (
                            <a
                              href={e.official_booking_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center justify-center size-8 rounded-xl border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                            >
                              <ExternalLink className="size-3.5" />
                            </a>
                          )}
                        </div>
                      ) : (
                        <Link to="/creator/events/$id/manage" params={{ id: e.id }}>
                          <Button
                            variant="outline"
                            size="sm"
                            className="rounded-xl text-xs font-semibold"
                          >
                            Manage & Attendees
                          </Button>
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
