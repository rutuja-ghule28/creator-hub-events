import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, Check, X, Calendar, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { EVENT_SELECT, errMsg, fmtDateTime, type Creator, type EventWithCreator } from "@/lib/cc";
import {
  Avatar,
  CreatorName,
  EmptyState,
  ErrorState,
  EventCover,
  ListSkeleton,
  StatusTag,
} from "@/components/cc";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/admin/verify")({
  head: () => ({
    meta: [{ title: "Admin Verification Queue — CreatorConnect" }],
  }),
  component: AdminVerifyPage,
});

function AdminVerifyPage() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<"events" | "creators">("events");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Pending events queue query
  const pendingEventsQuery = useQuery({
    queryKey: ["admin-pending-events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select(EVENT_SELECT)
        .eq("status", "pending")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as unknown as EventWithCreator[];
    },
  });

  // Pending creators queue query
  const pendingCreatorsQuery = useQuery({
    queryKey: ["admin-pending-creators"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("creators")
        .select("*")
        .eq("verification_status", "pending")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as Creator[];
    },
  });

  const events = pendingEventsQuery.data ?? [];
  const creators = pendingCreatorsQuery.data ?? [];

  const handleReviewEvent = async (eventId: string, approve: boolean) => {
    try {
      const newStatus = approve ? "live" : "rejected";
      const { error } = await supabase
        .from("events")
        .update({ status: newStatus })
        .eq("id", eventId);
      if (error) throw error;

      toast.success(approve ? "Event approved and published live!" : "Event listing rejected.");
      setSelectedId(null);
      qc.invalidateQueries({ queryKey: ["admin-pending-events"] });
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  const handleReviewCreator = async (creatorId: string, approve: boolean) => {
    try {
      const status = approve ? "approved" : "rejected";
      const { error } = await supabase
        .from("creators")
        .update({ verification_status: status, verified: approve })
        .eq("id", creatorId);
      if (error) throw error;

      toast.success(approve ? "Creator verified!" : "Creator application rejected.");
      setSelectedId(null);
      qc.invalidateQueries({ queryKey: ["admin-pending-creators"] });
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  const selectedEvent = events.find((e) => e.id === (selectedId || events[0]?.id));
  const selectedCreator = creators.find((c) => c.id === (selectedId || creators[0]?.id));

  return (
    <main className="px-4 py-5 md:px-6 md:py-8 pb-24 space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight">
            Verification Queue
          </h1>
          <p className="text-sm text-muted-foreground">
            Review pending creator registrations and event submissions.
          </p>
        </div>

        {/* Tab Selector with Badges */}
        <div className="flex bg-muted/60 p-1 rounded-2xl border border-border">
          <button
            type="button"
            onClick={() => {
              setActiveTab("events");
              setSelectedId(null);
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
              activeTab === "events"
                ? "bg-card text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Calendar className="size-4 text-primary" />
            <span>Events Queue</span>
            <span className="min-w-5 rounded-full bg-brand px-1.5 py-0.2 text-[10px] font-bold text-primary-foreground">
              {events.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("creators");
              setSelectedId(null);
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
              activeTab === "creators"
                ? "bg-card text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <UserCheck className="size-4 text-primary" />
            <span>Creators Queue</span>
            <span className="min-w-5 rounded-full bg-brand px-1.5 py-0.2 text-[10px] font-bold text-primary-foreground">
              {creators.length}
            </span>
          </button>
        </div>
      </div>

      {/* Split Master-Detail Layout */}
      {activeTab === "events" ? (
        pendingEventsQuery.isLoading ? (
          <ListSkeleton rows={3} tall />
        ) : events.length === 0 ? (
          <EmptyState
            title="Queue is clear!"
            body="There are no pending event submissions awaiting verification."
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Queue List (lg:col-span-5) */}
            <div className="lg:col-span-5 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Pending Items ({events.length})
              </p>
              <div className="space-y-2">
                {events.map((e) => {
                  const active = (selectedEvent?.id ?? events[0]?.id) === e.id;
                  return (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => setSelectedId(e.id)}
                      className={`w-full text-left p-4 rounded-2xl border transition-all ${
                        active
                          ? "bg-card border-primary/50 ring-2 ring-primary/20 shadow-xs"
                          : "bg-card/60 border-border hover:bg-card"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="size-14 rounded-xl overflow-hidden relative shrink-0 border border-border">
                          <EventCover
                            id={e.id}
                            src={e.cover_url}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-semibold text-sm line-clamp-1 text-foreground">
                            {e.title}
                          </h3>
                          <p className="text-xs text-muted-foreground">
                            <CreatorName c={e.creator} />
                          </p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {fmtDateTime(e.starts_at)}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right Selected Event Preview & Action Buttons (lg:col-span-7) */}
            {selectedEvent && (
              <div className="lg:col-span-7 rounded-3xl bg-card border border-border p-6 shadow-xs space-y-6 sticky top-24">
                <div className="space-y-4">
                  <div className="aspect-[16/9] rounded-2xl overflow-hidden relative border border-border">
                    <EventCover
                      id={selectedEvent.id}
                      src={selectedEvent.cover_url}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  </div>

                  <div>
                    <span className="text-xs font-semibold text-primary uppercase tracking-wide">
                      {selectedEvent.type}
                    </span>
                    <h2 className="font-display text-2xl font-bold text-foreground mt-1">
                      {selectedEvent.title}
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      Organiser: <CreatorName c={selectedEvent.creator} />
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4 p-4 rounded-2xl bg-muted/40 border border-border text-xs">
                    <div>
                      <span className="text-muted-foreground block">Venue & Area</span>
                      <span className="font-semibold text-foreground">
                        {selectedEvent.venue}, {selectedEvent.area}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Capacity</span>
                      <span className="font-semibold text-foreground">
                        {selectedEvent.capacity} Total Seats
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Description
                    </span>
                    <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                      {selectedEvent.description}
                    </p>
                  </div>
                </div>

                {/* Approve & Reject Action Bar */}
                <div className="pt-4 border-t border-border flex items-center justify-end gap-3">
                  <Button
                    variant="outline"
                    onClick={() => handleReviewEvent(selectedEvent.id, false)}
                    className="gap-1.5 rounded-xl border-destructive/40 text-destructive hover:bg-destructive/10"
                  >
                    <X className="size-4" /> Reject Event
                  </Button>
                  <Button
                    variant="brand"
                    onClick={() => handleReviewEvent(selectedEvent.id, true)}
                    className="gap-1.5 rounded-xl shadow-brand"
                  >
                    <Check className="size-4" /> Approve & Publish Live
                  </Button>
                </div>
              </div>
            )}
          </div>
        )
      ) : pendingCreatorsQuery.isLoading ? (
        <ListSkeleton rows={3} tall />
      ) : creators.length === 0 ? (
        <EmptyState
          title="No pending creator applications"
          body="All creator verification requests have been reviewed."
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Queue List */}
          <div className="lg:col-span-5 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Pending Creators ({creators.length})
            </p>
            <div className="space-y-2">
              {creators.map((c) => {
                const active = (selectedCreator?.id ?? creators[0]?.id) === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedId(c.id)}
                    className={`w-full text-left p-4 rounded-2xl border transition-all ${
                      active
                        ? "bg-card border-primary/50 ring-2 ring-primary/20 shadow-xs"
                        : "bg-card/60 border-border hover:bg-card"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar name={c.display_name} src={c.avatar_url} size={44} />
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold text-sm line-clamp-1 text-foreground">
                          {c.display_name}
                        </h3>
                        <p className="text-xs text-muted-foreground">{c.category} creator</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Selected Creator Preview */}
          {selectedCreator && (
            <div className="lg:col-span-7 rounded-3xl bg-card border border-border p-6 shadow-xs space-y-6 sticky top-24">
              <div className="flex items-center gap-4 border-b border-border pb-4">
                <Avatar
                  name={selectedCreator.display_name}
                  src={selectedCreator.avatar_url}
                  size={64}
                />
                <div>
                  <h2 className="font-display text-xl font-bold">{selectedCreator.display_name}</h2>
                  <p className="text-xs text-muted-foreground">
                    {selectedCreator.category} · {selectedCreator.location}
                  </p>
                </div>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <span className="text-muted-foreground block font-semibold uppercase">Bio</span>
                  <p className="text-sm text-foreground mt-1">
                    {selectedCreator.bio || "No bio provided."}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground block font-semibold uppercase">
                    Stated Audience Size
                  </span>
                  <p className="text-sm text-foreground mt-1">
                    {selectedCreator.audience_size} Followers
                  </p>
                </div>
              </div>

              <div className="pt-4 border-t border-border flex items-center justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => handleReviewCreator(selectedCreator.id, false)}
                  className="gap-1.5 rounded-xl border-destructive/40 text-destructive hover:bg-destructive/10"
                >
                  <X className="size-4" /> Reject Verification
                </Button>
                <Button
                  variant="brand"
                  onClick={() => handleReviewCreator(selectedCreator.id, true)}
                  className="gap-1.5 rounded-xl shadow-brand"
                >
                  <ShieldCheck className="size-4" /> Approve Verified Status
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
