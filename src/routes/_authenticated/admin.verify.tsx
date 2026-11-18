import { useState, useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ShieldCheck,
  ShieldAlert,
  Check,
  X,
  Calendar,
  UserCheck,
  ExternalLink,
  Mail,
  Phone,
  Save,
  CheckCircle2,
  Clock,
  AlertCircle,
  BadgeCheck,
  Globe,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  EVENT_SELECT,
  VERIFIABLE_FIELDS,
  errMsg,
  fmtCount,
  fmtDateTime,
  useMe,
  type Creator,
  type EventWithCreator,
} from "@/lib/cc";
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
import { getSourceMeta, formatExternalPrice, type ExternalEvent } from "@/lib/external-events";

export const Route = createFileRoute("/_authenticated/admin/verify")({
  head: () => ({
    meta: [
      { title: "Admin Creator Verification — CreatorConnect" },
      {
        name: "description",
        content:
          "Review creator verification applications, credentials, and official trust badges.",
      },
      { property: "og:site_name", content: "CreatorConnect" },
      { property: "og:title", content: "Admin Creator Verification — CreatorConnect" },
      {
        property: "og:description",
        content:
          "Review creator verification applications, credentials, and official trust badges.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://creatorconnect.app/admin/verify" },
      { property: "og:image", content: "https://creatorconnect.app/assets/og-image.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Admin Creator Verification — CreatorConnect" },
      {
        name: "twitter:description",
        content:
          "Review creator verification applications, credentials, and official trust badges.",
      },
      { name: "twitter:image", content: "https://creatorconnect.app/assets/og-image.png" },
    ],
    links: [{ rel: "canonical", href: "https://creatorconnect.app/admin/verify" }],
  }),
  component: AdminVerifyPage,
});

type AdminPendingItem = {
  id: string;
  sourceType: "internal" | "external";
  title: string;
  type: string;
  description: string;
  venue: string;
  area: string;
  city: string;
  capacity?: number;
  starts_at: string;
  cover_url: string | null;
  creator: Creator | null;
  official_booking_url?: string | null;
  source_name?: string;
  submission_type: string;
  ticket_price_min?: number | null;
  ticket_price_max?: number | null;
  is_free?: boolean;
};

function AdminVerifyPage() {
  const qc = useQueryClient();
  const { data: me, isLoading: meLoading } = useMe();
  const [activeTab, setActiveTab] = useState<"events" | "creators">("events");
  const [creatorStatusFilter, setCreatorStatusFilter] = useState<"pending" | "verified" | "all">(
    "pending",
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Individual verification fields state for selected creator
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [savingFields, setSavingFields] = useState(false);
  const [processingReview, setProcessingReview] = useState(false);

  // Pending events queue query (Both internal creator events and external organizer submissions)
  const pendingEventsQuery = useQuery({
    queryKey: ["admin-pending-events"],
    queryFn: async () => {
      // 1. Fetch internal pending events
      const { data: internalData, error: internalError } = await supabase
        .from("events")
        .select(EVENT_SELECT)
        .eq("status", "pending")
        .order("created_at", { ascending: true });
      if (internalError) throw internalError;

      // 2. Fetch external pending organizer submissions
      type ExternalWithCreator = ExternalEvent & {
        creators?: Creator | null;
      };
      let externalData: ExternalWithCreator[] = [];
      try {
        const { data, error } = await supabase
          .from("external_events")
          .select("*, creators:submitted_by_creator_id(*)")
          .eq("status", "pending")
          .order("created_at", { ascending: true });
        if (!error && data) externalData = data as unknown as ExternalWithCreator[];
      } catch {
        externalData = [];
      }

      const internalList: AdminPendingItem[] = (
        (internalData ?? []) as unknown as EventWithCreator[]
      ).map((e) => ({
        id: e.id,
        sourceType: "internal" as const,
        title: e.title,
        type: e.type,
        description: e.description,
        venue: e.venue,
        area: e.area,
        city: e.area || "Pune",
        capacity: e.capacity,
        starts_at: e.starts_at,
        cover_url: e.cover_url,
        creator: e.creator,
        submission_type: "organizer",
      }));

      const externalList: AdminPendingItem[] = externalData.map((ext) => ({
        id: ext.id,
        sourceType: "external" as const,
        title: ext.title,
        type: ext.category,
        description: ext.description,
        venue: ext.venue_name,
        area: ext.address || ext.city,
        city: ext.city,
        starts_at: ext.starts_at,
        cover_url: ext.cover_url,
        creator: ext.creators ?? null,
        official_booking_url: ext.official_booking_url,
        source_name: ext.source_name,
        submission_type: ext.submission_type || "organizer",
        ticket_price_min: ext.ticket_price_min,
        ticket_price_max: ext.ticket_price_max,
        is_free: ext.is_free,
      }));

      return [...internalList, ...externalList];
    },
  });

  // Creators queue query (with status filter support)
  const creatorsQuery = useQuery({
    queryKey: ["admin-creators", creatorStatusFilter],
    queryFn: async () => {
      let q = supabase.from("creators").select("*").order("created_at", { ascending: false });
      if (creatorStatusFilter === "pending") {
        q = q.eq("verification_status", "pending");
      } else if (creatorStatusFilter === "verified") {
        q = q.eq("verified", true);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data as Creator[];
    },
  });

  const events = pendingEventsQuery.data ?? [];
  const creators = creatorsQuery.data ?? [];

  const selectedEvent = events.find((e) => e.id === (selectedId || events[0]?.id));
  const selectedCreator = creators.find((c) => c.id === (selectedId || creators[0]?.id));

  // Sync selectedFields when selectedCreator changes
  useEffect(() => {
    if (selectedCreator) {
      setSelectedFields(selectedCreator.verified_fields ?? []);
    } else {
      setSelectedFields([]);
    }
  }, [selectedCreator?.id, selectedCreator?.verified_fields]);

  const handleReviewEvent = async (event: AdminPendingItem, approve: boolean) => {
    try {
      const newStatus = approve ? "live" : "rejected";
      if (event.sourceType === "external") {
        const { error } = await supabase
          .from("external_events")
          .update({ status: newStatus })
          .eq("id", event.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("events")
          .update({ status: newStatus })
          .eq("id", event.id);
        if (error) throw error;
      }

      toast.success(
        approve
          ? `Event approved and published live${event.sourceType === "external" ? " on Discover with official booking link" : ""}!`
          : "Event listing rejected.",
      );
      setSelectedId(null);
      qc.invalidateQueries({ queryKey: ["admin-pending-events"] });
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  const handleSaveFields = async () => {
    if (!selectedCreator?.id) return;
    setSavingFields(true);
    try {
      const { error } = await supabase.rpc("set_verified_fields", {
        _creator_id: selectedCreator.id,
        _fields: selectedFields,
      });
      if (error) throw error;
      toast.success("Verification criteria saved!");
      qc.invalidateQueries({ queryKey: ["admin-creators"] });
      qc.invalidateQueries({ queryKey: ["creator-profile", selectedCreator.id] });
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setSavingFields(false);
    }
  };

  const handleReviewCreator = async (creatorId: string, approve: boolean) => {
    setProcessingReview(true);
    try {
      if (approve) {
        // First sync verified fields criteria
        const { error: fieldsError } = await supabase.rpc("set_verified_fields", {
          _creator_id: creatorId,
          _fields: selectedFields,
        });
        if (fieldsError) throw fieldsError;
      }

      // Execute official review_creator RPC
      const { error } = await supabase.rpc("review_creator", {
        _creator_id: creatorId,
        _approve: approve,
      });
      if (error) throw error;

      toast.success(
        approve ? "Creator verified and granted creator role!" : "Creator application rejected.",
      );
      setSelectedId(null);
      qc.invalidateQueries({ queryKey: ["admin-creators"] });
      qc.invalidateQueries({ queryKey: ["creator-profile", creatorId] });
      qc.invalidateQueries({ queryKey: ["admin-platform-stats"] });
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setProcessingReview(false);
    }
  };

  const toggleFieldVerification = (key: string) => {
    setSelectedFields((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  };

  if (meLoading) {
    return <ListSkeleton />;
  }

  if (!me?.roles?.includes("admin")) {
    return (
      <main className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="size-16 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center">
          <ShieldAlert className="size-8" />
        </div>
        <h1 className="font-display text-2xl font-bold">Admin Authorization Required</h1>
        <p className="text-sm text-muted-foreground max-w-md">
          This portal is reserved exclusively for Creator Connect platform administrators. Your
          current account does not hold admin permissions.
        </p>
        <Link to="/discover/1">
          <Button variant="brand" className="rounded-xl">
            Return to Discover
          </Button>
        </Link>
      </main>
    );
  }

  return (
    <main className="px-4 py-5 md:px-6 md:py-8 pb-24 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight">
            Verification Queue
          </h1>
          <p className="text-sm text-muted-foreground">
            Review pending creator registrations, individual trust criteria, and event submissions.
          </p>
        </div>

        {/* Tab Selector with Badges */}
        <div className="flex bg-muted/60 p-1 rounded-2xl border border-border self-start">
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
                          <div className="flex items-center gap-1.5 mb-1">
                            {e.sourceType === "external" ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                <Globe className="size-2.5" />
                                Organizer Link • {getSourceMeta(e.source_name || "partner").label}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20">
                                <CheckCircle2 className="size-2.5" />
                                Creator Connect RSVP
                              </span>
                            )}
                          </div>
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
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-primary uppercase tracking-wide">
                        {selectedEvent.type}
                      </span>
                      {selectedEvent.sourceType === "external" ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                          <Globe className="size-2.5" />
                          Organizer Submission (
                          {getSourceMeta(selectedEvent.source_name || "partner").label})
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20">
                          Creator Connect RSVP
                        </span>
                      )}
                    </div>
                    <h2 className="font-display text-2xl font-bold text-foreground mt-1">
                      {selectedEvent.title}
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      Organiser: <CreatorName c={selectedEvent.creator} />
                    </p>
                  </div>

                  {selectedEvent.sourceType === "external" ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-4 p-4 rounded-2xl bg-muted/40 border border-border text-xs">
                        <div>
                          <span className="text-muted-foreground block">Venue & City</span>
                          <span className="font-semibold text-foreground">
                            {selectedEvent.venue}, {selectedEvent.city}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block">Pricing & Entry</span>
                          <span className="font-semibold text-foreground">
                            {formatExternalPrice(
                              Boolean(selectedEvent.is_free),
                              selectedEvent.ticket_price_min,
                              selectedEvent.ticket_price_max,
                            )}
                          </span>
                        </div>
                      </div>

                      {selectedEvent.official_booking_url && (
                        <div className="p-4 rounded-2xl bg-brand/5 border border-brand/20 space-y-2 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-foreground flex items-center gap-1.5">
                              <Globe className="size-3.5 text-primary" />
                              Official Booking Link (
                              {getSourceMeta(selectedEvent.source_name || "partner").label})
                            </span>
                            <a
                              href={selectedEvent.official_booking_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity"
                            >
                              <span>Test Link</span>
                              <ExternalLink className="size-3" />
                            </a>
                          </div>
                          <p className="text-muted-foreground font-mono text-[11px] break-all bg-card p-2 rounded-xl border border-border">
                            {selectedEvent.official_booking_url}
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
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
                  )}

                  <div className="space-y-1">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Description
                    </span>
                    <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                      {selectedEvent.description || "No description provided."}
                    </p>
                  </div>
                </div>

                {/* Approve & Reject Action Bar */}
                <div className="pt-4 border-t border-border flex items-center justify-end gap-3">
                  <Button
                    variant="outline"
                    onClick={() => handleReviewEvent(selectedEvent, false)}
                    className="gap-1.5 rounded-xl border-destructive/40 text-destructive hover:bg-destructive/10"
                  >
                    <X className="size-4" /> Reject Event
                  </Button>
                  <Button
                    variant="brand"
                    onClick={() => handleReviewEvent(selectedEvent, true)}
                    className="gap-1.5 rounded-xl shadow-brand"
                  >
                    <Check className="size-4" /> Approve & Publish Live
                  </Button>
                </div>
              </div>
            )}
          </div>
        )
      ) : (
        /* Creators Queue Section */
        <div className="space-y-4">
          {/* Sub-filter tabs for Creators */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground font-semibold">Filter:</span>
            {(["pending", "verified", "all"] as const).map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => {
                  setCreatorStatusFilter(filter);
                  setSelectedId(null);
                }}
                className={`px-3 py-1.5 rounded-full capitalize font-semibold transition-all ${
                  creatorStatusFilter === filter
                    ? "bg-brand text-primary-foreground shadow-brand"
                    : "bg-muted/70 text-muted-foreground hover:text-foreground"
                }`}
              >
                {filter === "pending"
                  ? "Pending Review"
                  : filter === "verified"
                    ? "Verified Creators"
                    : "All Applications"}
              </button>
            ))}
          </div>

          {creatorsQuery.isLoading ? (
            <ListSkeleton rows={3} tall />
          ) : creators.length === 0 ? (
            <EmptyState
              title={
                creatorStatusFilter === "pending"
                  ? "No pending creator applications"
                  : creatorStatusFilter === "verified"
                    ? "No verified creators found"
                    : "No creator applications recorded"
              }
              body={
                creatorStatusFilter === "pending"
                  ? "All creator verification requests have been audited."
                  : "Try switching filter views above."
              }
            />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Left Queue List */}
              <div className="lg:col-span-5 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {creatorStatusFilter === "pending" ? "Pending Applications" : "Creators"} (
                  {creators.length})
                </p>
                <div className="space-y-2">
                  {creators.map((c) => {
                    const active = (selectedCreator?.id ?? creators[0]?.id) === c.id;
                    const verifiedCount = c.verified_fields?.length ?? 0;
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
                            <div className="flex items-center justify-between gap-1">
                              <h3 className="font-semibold text-sm line-clamp-1 text-foreground flex items-center gap-1">
                                {c.display_name}
                                {c.verified && (
                                  <BadgeCheck className="size-3.5 fill-primary text-primary-foreground shrink-0" />
                                )}
                              </h3>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  c.verification_status === "verified"
                                    ? "bg-trust-soft text-trust"
                                    : c.verification_status === "rejected"
                                      ? "bg-destructive/10 text-destructive"
                                      : "bg-warn-soft text-warn font-semibold"
                                }`}
                              >
                                {c.verification_status}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {c.category} · {c.location}
                            </p>
                            <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-2">
                              <span>{fmtCount(c.audience_size)} followers</span>
                              <span>·</span>
                              <span className="text-primary font-medium">
                                {verifiedCount}/6 criteria verified
                              </span>
                            </p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Right Selected Creator Preview & Audit Checklist */}
              {selectedCreator && (
                <div className="lg:col-span-7 rounded-3xl bg-card border border-border p-6 shadow-xs space-y-6 sticky top-24">
                  {/* Creator Header */}
                  <div className="flex items-center justify-between border-b border-border pb-4">
                    <div className="flex items-center gap-4">
                      <Avatar
                        name={selectedCreator.display_name}
                        src={selectedCreator.avatar_url}
                        size={60}
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="font-display text-xl font-bold">
                            {selectedCreator.display_name}
                          </h2>
                          {selectedCreator.verified && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-trust-soft px-2 py-0.5 text-[10px] font-bold text-trust">
                              <ShieldCheck className="size-3" /> Verified Creator
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {selectedCreator.category} · {selectedCreator.location}
                        </p>
                      </div>
                    </div>

                    <span
                      className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${
                        selectedCreator.verification_status === "verified"
                          ? "bg-trust-soft text-trust"
                          : selectedCreator.verification_status === "rejected"
                            ? "bg-destructive/10 text-destructive"
                            : "bg-warn-soft text-warn"
                      }`}
                    >
                      Status: {selectedCreator.verification_status}
                    </span>
                  </div>

                  {/* Creator Profile Metadata */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                    <div className="p-3 rounded-2xl bg-muted/30 border border-border/60">
                      <span className="text-muted-foreground block text-[11px] font-semibold uppercase">
                        Category
                      </span>
                      <span className="font-semibold text-foreground mt-0.5 block">
                        {selectedCreator.category}
                      </span>
                    </div>
                    <div className="p-3 rounded-2xl bg-muted/30 border border-border/60">
                      <span className="text-muted-foreground block text-[11px] font-semibold uppercase">
                        Audience Size
                      </span>
                      <span className="font-semibold text-foreground mt-0.5 block">
                        {fmtCount(selectedCreator.audience_size)} followers
                      </span>
                    </div>
                    <div className="p-3 rounded-2xl bg-muted/30 border border-border/60">
                      <span className="text-muted-foreground block text-[11px] font-semibold uppercase">
                        Location
                      </span>
                      <span className="font-semibold text-foreground mt-0.5 block">
                        {selectedCreator.location}
                      </span>
                    </div>
                  </div>

                  {/* Bio */}
                  {selectedCreator.bio && (
                    <div className="space-y-1 text-xs">
                      <span className="text-muted-foreground font-semibold uppercase tracking-wider block">
                        Bio
                      </span>
                      <p className="text-sm text-foreground bg-muted/20 p-3 rounded-2xl border border-border/50 leading-relaxed">
                        {selectedCreator.bio}
                      </p>
                    </div>
                  )}

                  {/* Portfolio & Contact Links */}
                  <div className="space-y-2 text-xs">
                    <span className="text-muted-foreground font-semibold uppercase tracking-wider block">
                      Submitted Links & Contact
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {selectedCreator.contact_email && (
                        <a
                          href={`mailto:${selectedCreator.contact_email}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-muted/50 border border-border hover:bg-muted text-foreground transition-colors"
                        >
                          <Mail className="size-3.5 text-primary" /> {selectedCreator.contact_email}
                        </a>
                      )}
                      {selectedCreator.contact_phone && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-muted/50 border border-border text-foreground">
                          <Phone className="size-3.5 text-primary" />{" "}
                          {selectedCreator.contact_phone}
                        </span>
                      )}
                      {(selectedCreator.portfolio_links ?? []).map((link, idx) => (
                        <a
                          key={idx}
                          href={link}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-muted/50 border border-border hover:bg-muted text-primary transition-colors font-medium"
                        >
                          <ExternalLink className="size-3.5" />{" "}
                          {link.replace(/^https?:\/\/(www\.)?/, "").slice(0, 30)}
                        </a>
                      ))}
                    </div>
                  </div>

                  {/* Individual Verification Criteria Checklist */}
                  <div className="space-y-3 pt-4 border-t border-border">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-sm text-foreground flex items-center gap-1.5">
                          <ShieldCheck className="size-4 text-primary" /> Individual Verification
                          Criteria
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          Audit and confirm each criteria based on official documentation.
                        </p>
                      </div>
                      <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary">
                        {selectedFields.length} of {VERIFIABLE_FIELDS.length} verified
                      </span>
                    </div>

                    <div className="space-y-2.5">
                      {VERIFIABLE_FIELDS.map((vf) => {
                        const isChecked = selectedFields.includes(vf.key);
                        return (
                          <label
                            key={vf.key}
                            className={`flex items-start gap-3 p-3.5 rounded-2xl border transition-all cursor-pointer ${
                              isChecked
                                ? "bg-trust-soft/30 border-trust/50 shadow-xs"
                                : "bg-muted/30 border-border hover:bg-muted/60"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleFieldVerification(vf.key)}
                              className="mt-0.5 size-4 rounded border-border text-trust focus:ring-trust cursor-pointer"
                            />
                            <div className="flex-1 min-w-0 space-y-1">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                                  {vf.label}
                                  {isChecked && <CheckCircle2 className="size-3 text-trust" />}
                                </span>
                                <span
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                                    isChecked
                                      ? "bg-trust-soft text-trust"
                                      : "bg-muted text-muted-foreground"
                                  }`}
                                >
                                  {isChecked ? "Verified" : "Pending Audit"}
                                </span>
                              </div>
                              <p className="text-[11px] text-muted-foreground leading-snug">
                                {vf.criteria}
                              </p>
                              <div className="text-[11px] text-foreground font-medium bg-background/80 px-2 py-1 rounded-lg border border-border/60 inline-block">
                                {vf.key === "name" && `Submitted: ${selectedCreator.display_name}`}
                                {vf.key === "niche" && `Category: ${selectedCreator.category}`}
                                {vf.key === "audience" &&
                                  `Audience: ${fmtCount(selectedCreator.audience_size)} followers`}
                                {vf.key === "location" && `Location: ${selectedCreator.location}`}
                                {vf.key === "portfolio" &&
                                  (selectedCreator.portfolio_links?.length
                                    ? `${selectedCreator.portfolio_links.length} link(s) provided`
                                    : "No portfolio links submitted")}
                                {vf.key === "contact" &&
                                  `Email: ${selectedCreator.contact_email || "N/A"} · Phone: ${selectedCreator.contact_phone || "N/A"}`}
                              </div>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  {/* Action Bar */}
                  <div className="pt-4 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleSaveFields}
                      disabled={savingFields || processingReview}
                      className="rounded-xl text-xs font-semibold gap-1.5 w-full sm:w-auto"
                    >
                      <Save className="size-3.5" />
                      {savingFields ? "Saving..." : "Save Verified Criteria"}
                    </Button>

                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                      <Button
                        variant="outline"
                        onClick={() => handleReviewCreator(selectedCreator.id, false)}
                        disabled={processingReview || savingFields}
                        className="gap-1.5 rounded-xl border-destructive/40 text-destructive hover:bg-destructive/10 text-xs font-semibold flex-1 sm:flex-initial"
                      >
                        <X className="size-4" /> Reject Application
                      </Button>
                      <Button
                        variant="brand"
                        onClick={() => handleReviewCreator(selectedCreator.id, true)}
                        disabled={processingReview || savingFields}
                        className="gap-1.5 rounded-xl shadow-brand text-xs font-semibold flex-1 sm:flex-initial"
                      >
                        <ShieldCheck className="size-4" />
                        {processingReview ? "Processing..." : "Approve & Verify Creator"}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </main>
  );
}
