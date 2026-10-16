import { useState, useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PlusCircle, Search, CalendarDays } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { EVENT_SELECT, errMsg, fmtDateTime, useMe, type EventWithCreator } from "@/lib/cc";
import { EmptyState, ErrorState, EventCover, ListSkeleton, StatusTag } from "@/components/cc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
  component: CreatorEventsTablePage,
});

function CreatorEventsTablePage() {
  const { data: me } = useMe();
  const [filterTab, setFilterTab] = useState<"all" | "live" | "pending" | "removed">("all");
  const [searchQ, setSearchQ] = useState("");

  const eventsQuery = useQuery({
    queryKey: ["creator-events-table", me?.creator?.id],
    queryFn: async () => {
      if (!me?.creator?.id) return [];
      const { data, error } = await supabase
        .from("events")
        .select(EVENT_SELECT)
        .eq("creator_id", me.creator.id)
        .order("starts_at", { ascending: false });
      if (error) throw error;
      return data as unknown as EventWithCreator[];
    },
    enabled: !!me?.creator?.id,
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
        <Link to="/creator/events/create">
          <Button variant="brand" className="gap-2 rounded-2xl font-semibold shadow-brand">
            <PlusCircle className="size-4" /> Create Event
          </Button>
        </Link>
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
                      <Link
                        to="/creator/events/$id/manage"
                        params={{ id: e.id }}
                        className="font-semibold text-foreground hover:text-primary transition-colors block"
                      >
                        {e.title}
                      </Link>
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
                      {e.seats_taken} / {e.capacity} seats
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Link to="/creator/events/$id/manage" params={{ id: e.id }}>
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-xl text-xs font-semibold"
                        >
                          Manage & Attendees
                        </Button>
                      </Link>
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
