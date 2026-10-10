import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Users, Eye, Bookmark, CalendarDays, PlusCircle, ArrowUpRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { EVENT_SELECT, errMsg, fmtDateTime, useMe, type EventWithCreator } from "@/lib/cc";
import {
  EmptyState,
  ErrorState,
  ListSkeleton,
  MiniBars,
  SeatsBar,
  StatusTag,
} from "@/components/cc";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/creator/dashboard")({
  head: () => ({
    meta: [{ title: "Creator Dashboard — CreatorConnect" }],
  }),
  component: CreatorDashboardPage,
});

function CreatorDashboardPage() {
  const { data: me } = useMe();

  const eventsQuery = useQuery({
    queryKey: ["creator-events", me?.creator?.id],
    queryFn: async () => {
      if (!me?.creator?.id) return [];
      const { data, error } = await supabase
        .from("events")
        .select(EVENT_SELECT)
        .eq("creator_id", me.creator.id)
        .order("starts_at", { ascending: true });
      if (error) throw error;
      return data as unknown as EventWithCreator[];
    },
    enabled: !!me?.creator?.id,
  });

  const events = eventsQuery.data ?? [];
  const totalRegistrations = events.reduce((acc, curr) => acc + curr.seats_taken, 0);

  return (
    <main className="px-4 py-5 md:px-6 md:py-8 pb-24 space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight">
            Creator Dashboard
          </h1>
          <p className="text-sm text-muted-foreground">
            Overview of your events, registrations, and audience engagement.
          </p>
        </div>
        <Link to="/creator/events/create">
          <Button variant="brand" className="gap-2 rounded-2xl font-semibold shadow-brand">
            <PlusCircle className="size-4" /> Create New Event
          </Button>
        </Link>
      </div>

      {/* Main Grid: Registrations Chart (Wide) + Stat Cards Column */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Wide Registrations Chart (lg:col-span-8) */}
        <div className="lg:col-span-8 rounded-3xl bg-card border border-border p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display font-semibold text-lg">Weekly Registrations</h2>
              <p className="text-xs text-muted-foreground">
                Total signups across all active listings
              </p>
            </div>
            <span className="font-display font-bold text-2xl text-primary">
              {totalRegistrations}
            </span>
          </div>

          {/* MiniBars Chart Graphic */}
          <div className="pt-4">
            <MiniBars
              values={[12, 28, 45, 32, 60, 85, totalRegistrations || 40]}
              labels={["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]}
            />
          </div>
        </div>

        {/* Stat Cards Side Column (lg:col-span-4) */}
        <div className="lg:col-span-4 grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 gap-4">
          <div className="rounded-2xl bg-card border border-border p-5 space-y-1 shadow-xs">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-semibold uppercase tracking-wider">Followers</span>
              <Users className="size-4 text-primary" />
            </div>
            <p className="font-display text-2xl font-bold text-foreground">
              {me?.creator?.audience_size ?? 1250}
            </p>
            <p className="text-[11px] text-trust font-medium">+14% this month</p>
          </div>

          <div className="rounded-2xl bg-card border border-border p-5 space-y-1 shadow-xs">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-semibold uppercase tracking-wider">Page Views</span>
              <Eye className="size-4 text-primary" />
            </div>
            <p className="font-display text-2xl font-bold text-foreground">
              {me?.creator?.page_views ?? 4820}
            </p>
            <p className="text-[11px] text-trust font-medium">+22% engagement</p>
          </div>

          <div className="rounded-2xl bg-card border border-border p-5 space-y-1 shadow-xs">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-semibold uppercase tracking-wider">Event Saves</span>
              <Bookmark className="size-4 text-primary" />
            </div>
            <p className="font-display text-2xl font-bold text-foreground">340</p>
            <p className="text-[11px] text-muted-foreground font-medium">Bookmarked by attendees</p>
          </div>
        </div>
      </div>

      {/* Live Events Table with Registration Progress Bars */}
      <div className="rounded-3xl bg-card border border-border p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-semibold text-lg">My Active Events</h2>
          <Link
            to="/creator/events"
            className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
          >
            View all table <ArrowUpRight className="size-3.5" />
          </Link>
        </div>

        {eventsQuery.isLoading ? (
          <ListSkeleton rows={3} />
        ) : eventsQuery.error ? (
          <ErrorState message={errMsg(eventsQuery.error)} onRetry={() => eventsQuery.refetch()} />
        ) : events.length === 0 ? (
          <EmptyState
            title="No events created yet"
            body="Publish your first event to start accepting guest registrations."
            action={
              <Link to="/creator/events/create">
                <Button variant="brand">Create event</Button>
              </Link>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border text-xs text-muted-foreground uppercase font-semibold">
                <tr>
                  <th className="py-3 px-4">Event Title</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Date & Time</th>
                  <th className="py-3 px-4 w-48">Registration Progress</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {events.map((e) => (
                  <tr key={e.id} className="hover:bg-muted/40 transition-colors">
                    <td className="py-3.5 px-4 font-semibold text-foreground">
                      <Link
                        to="/creator/events/$id/manage"
                        params={{ id: e.id }}
                        className="hover:text-primary transition-colors"
                      >
                        {e.title}
                      </Link>
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusTag status={e.status} />
                    </td>
                    <td className="py-3.5 px-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <CalendarDays className="size-3.5 text-primary" />{" "}
                        {fmtDateTime(e.starts_at)}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <SeatsBar taken={e.seats_taken} capacity={e.capacity} />
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <Link to="/creator/events/$id/manage" params={{ id: e.id }}>
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-xl text-xs font-semibold"
                        >
                          Manage
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
