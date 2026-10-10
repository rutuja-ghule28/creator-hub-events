import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Ticket, Bookmark, CalendarDays, MapPin, QrCode } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { EVENT_SELECT, errMsg, fmtDateTime, useMe, type EventWithCreator } from "@/lib/cc";
import { CreatorName, EmptyState, ErrorState, EventCover, ListSkeleton } from "@/components/cc";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/tickets")({
  head: () => ({
    meta: [
      { title: "My Tickets & Saved — CreatorConnect" },
      {
        name: "description",
        content: "View your event passes, ticket QR codes, and saved creator events.",
      },
    ],
  }),
  component: TicketsPage,
});

type RegistrationRow = {
  id: string;
  ticket_code: string;
  attendee_count: number;
  checked_in: boolean;
  created_at: string;
  event: EventWithCreator | null;
};

function TicketsPage() {
  const { data: me } = useMe();
  const [activeTab, setActiveTab] = useState<"tickets" | "saved">("tickets");

  const registrationsQuery = useQuery({
    queryKey: ["my-registrations", me?.id],
    queryFn: async () => {
      if (!me?.id) return [];
      const { data, error } = await supabase
        .from("registrations")
        .select("*, event:events(*, creator:creators(*))")
        .eq("user_id", me.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as RegistrationRow[];
    },
    enabled: !!me?.id,
  });

  const savedQuery = useQuery({
    queryKey: ["my-saved", me?.id],
    queryFn: async () => {
      if (!me?.id) return [];
      const { data, error } = await supabase
        .from("saved_events")
        .select("*, event:events(*, creator:creators(*))")
        .eq("user_id", me.id);
      if (error) throw error;
      return (data ?? []).map((x) => x.event as unknown as EventWithCreator);
    },
    enabled: !!me?.id,
  });

  return (
    <main className="px-4 py-5 md:px-6 md:py-8 pb-24">
      {/* Page Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight">
            My Tickets & Saved
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage your event passes and bookmarked creator events.
          </p>
        </div>

        {/* Tab Selector */}
        <div className="flex bg-muted/60 p-1 rounded-2xl border border-border self-start">
          <button
            type="button"
            onClick={() => setActiveTab("tickets")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
              activeTab === "tickets"
                ? "bg-card text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Ticket className="size-4 text-primary" />
            <span>My Tickets ({registrationsQuery.data?.length ?? 0})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("saved")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
              activeTab === "saved"
                ? "bg-card text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Bookmark className="size-4 text-primary" />
            <span>Saved ({savedQuery.data?.length ?? 0})</span>
          </button>
        </div>
      </div>

      {/* Content Grid */}
      {activeTab === "tickets" ? (
        registrationsQuery.isLoading ? (
          <ListSkeleton rows={3} tall />
        ) : registrationsQuery.error ? (
          <ErrorState
            message={errMsg(registrationsQuery.error)}
            onRetry={() => registrationsQuery.refetch()}
          />
        ) : (registrationsQuery.data ?? []).length === 0 ? (
          <EmptyState
            title="No tickets yet"
            body="Discover events near you and register to get your official QR ticket pass."
            action={
              <Link to="/discover">
                <Button variant="brand">Browse events</Button>
              </Link>
            }
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {registrationsQuery.data?.map((reg) => {
              const ev = reg.event;
              if (!ev) return null;
              return (
                <div
                  key={reg.id}
                  className="rounded-3xl bg-card border border-border overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div className="relative aspect-[16/9] overflow-hidden">
                    <EventCover
                      id={ev.id}
                      src={ev.cover_url}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                    <span className="absolute top-3 right-3 bg-brand text-primary-foreground font-mono font-bold text-xs px-2.5 py-1 rounded-full shadow-brand">
                      {reg.ticket_code}
                    </span>
                  </div>

                  <div className="p-5 space-y-3 flex-1 flex flex-col justify-between">
                    <div className="space-y-1.5">
                      <span className="text-[11px] font-semibold text-primary uppercase tracking-wide">
                        {ev.type}
                      </span>
                      <h3 className="font-semibold text-base line-clamp-1">{ev.title}</h3>
                      <p className="text-xs text-muted-foreground">
                        <CreatorName c={ev.creator} />
                      </p>
                    </div>

                    <div className="space-y-2 pt-3 border-t border-border text-xs text-muted-foreground">
                      <p className="flex items-center gap-1.5">
                        <CalendarDays className="size-3.5 text-primary" />{" "}
                        {fmtDateTime(ev.starts_at)}
                      </p>
                      <p className="flex items-center gap-1.5">
                        <MapPin className="size-3.5 text-primary" /> {ev.venue}
                      </p>
                    </div>

                    <div className="pt-3">
                      <Link to="/tickets/$id" params={{ id: reg.id }}>
                        <Button
                          variant="outline"
                          className="w-full rounded-xl text-xs font-semibold gap-2"
                        >
                          <QrCode className="size-4" /> View Ticket Pass
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : savedQuery.isLoading ? (
        <ListSkeleton rows={3} tall />
      ) : savedQuery.error ? (
        <ErrorState message={errMsg(savedQuery.error)} onRetry={() => savedQuery.refetch()} />
      ) : (savedQuery.data ?? []).length === 0 ? (
        <EmptyState
          title="No saved events"
          body="Bookmark creator events while exploring to save them for later."
          action={
            <Link to="/discover">
              <Button variant="brand">Explore events</Button>
            </Link>
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {savedQuery.data?.map((ev) => (
            <div
              key={ev.id}
              className="rounded-3xl bg-card border border-border overflow-hidden shadow-xs hover:shadow-md transition-all"
            >
              <div className="relative aspect-[16/9] overflow-hidden">
                <EventCover
                  id={ev.id}
                  src={ev.cover_url}
                  alt=""
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-5 space-y-2">
                <h3 className="font-semibold text-base line-clamp-1">{ev.title}</h3>
                <p className="text-xs text-muted-foreground">
                  <CreatorName c={ev.creator} />
                </p>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <CalendarDays className="size-3.5 text-primary" /> {fmtDateTime(ev.starts_at)}
                </p>
                <div className="pt-3">
                  <Link to="/events/$id" params={{ id: ev.id }}>
                    <Button variant="brand" className="w-full rounded-xl text-xs font-semibold">
                      View Event Details
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
