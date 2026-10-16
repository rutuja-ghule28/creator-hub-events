import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays,
  MapPin,
  Share2,
  Flag,
  UserPlus,
  UserCheck,
  CheckCircle2,
  Clock,
  Sparkles,
  ChevronLeft,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  EVENT_SELECT,
  errMsg,
  fmtDateTime,
  seatsLeft,
  useMe,
  type EventWithCreator,
} from "@/lib/cc";
import {
  Avatar,
  CreatorName,
  ErrorState,
  EventCover,
  ListSkeleton,
  OfficialSeal,
  SeatsBar,
} from "@/components/cc";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/events/$id")({
  head: ({ params }) => ({
    meta: [
      { title: "Event Details & Tickets — CreatorConnect" },
      {
        name: "description",
        content:
          "Check event schedule, venue details, creator profiles, and available tickets for upcoming meetups.",
      },
      { property: "og:site_name", content: "CreatorConnect" },
      { property: "og:title", content: "Event Details & Tickets — CreatorConnect" },
      {
        property: "og:description",
        content:
          "Check event schedule, venue details, creator profiles, and available tickets for upcoming meetups.",
      },
      { property: "og:type", content: "article" },
      { property: "og:url", content: `https://creatorconnect.app/events/${params.id}` },
      { property: "og:image", content: "https://creatorconnect.app/assets/og-image.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Event Details & Tickets — CreatorConnect" },
      {
        name: "twitter:description",
        content:
          "Check event schedule, venue details, creator profiles, and available tickets for upcoming meetups.",
      },
      { name: "twitter:image", content: "https://creatorconnect.app/assets/og-image.png" },
    ],
    links: [{ rel: "canonical", href: `https://creatorconnect.app/events/${params.id}` }],
  }),
  component: EventPage,
});

function EventPage() {
  const { id } = Route.useParams();
  const { data: me } = useMe();
  const qc = useQueryClient();

  const [registerOpen, setRegisterOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);

  // Form states
  const [fullName, setFullName] = useState(me?.profile?.full_name ?? "");
  const [email, setEmail] = useState(me?.email ?? "");
  const [phone, setPhone] = useState(me?.profile?.phone ?? "");
  const [seatsCount, setSeatsCount] = useState(1);
  const [submittingReg, setSubmittingReg] = useState(false);

  // Report state
  const [reportReason, setReportReason] = useState("misleading");
  const [reportNote, setReportNote] = useState("");
  const [submittingReport, setSubmittingReport] = useState(false);

  const query = useQuery({
    queryKey: ["event", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select(EVENT_SELECT)
        .eq("id", id)
        .single();
      if (error) throw error;
      return data as unknown as EventWithCreator;
    },
  });

  const announcementsQuery = useQuery({
    queryKey: ["announcements", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("announcements")
        .select("*")
        .eq("event_id", id)
        .order("created_at", { ascending: false });
      if (error && error.code !== "PGRST116") throw error;
      return data ?? [];
    },
    enabled: !!id,
  });

  const e = query.data;
  const left = e ? seatsLeft(e) : 0;

  const handleRegisterSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!fullName.trim() || !email.trim() || !phone.trim()) {
      toast.error("Please fill in all required fields.");
      return;
    }
    if (!me?.id || !e?.id) return;

    setSubmittingReg(true);
    try {
      const { error } = await supabase.from("registrations").insert({
        event_id: e.id,
        user_id: me.id,
        full_name: fullName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        attendee_count: seatsCount,
        ticket_code: `CC-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
      });

      if (error) throw error;

      // Update seats_taken
      await supabase
        .from("events")
        .update({ seats_taken: e.seats_taken + seatsCount })
        .eq("id", e.id);

      toast.success("Successfully registered! Check your tickets.");
      setRegisterOpen(false);
      qc.invalidateQueries({ queryKey: ["event", id] });
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setSubmittingReg(false);
    }
  };

  const handleReportSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!me?.id || !e?.id) return;

    setSubmittingReport(true);
    try {
      const { error } = await supabase.from("reports").insert({
        event_id: e.id,
        reporter_id: me.id,
        reason: reportReason,
        note: reportNote.trim() || null,
        status: "pending",
      });

      if (error) throw error;

      toast.success("Thank you. Report submitted for review.");
      setReportOpen(false);
      setReportNote("");
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setSubmittingReport(false);
    }
  };

  return (
    <main className="px-4 py-5 md:px-6 md:py-8 pb-24">
      {/* Breadcrumb / Top Bar link */}
      <div className="mb-4 flex items-center justify-between">
        <Link
          to="/discover"
          className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="size-4" />
          Back to Discover
        </Link>
        <button
          type="button"
          onClick={() => {
            if (navigator.share && e?.title) {
              navigator.share({ title: e.title, url: window.location.href });
            } else {
              navigator.clipboard.writeText(window.location.href);
              toast.success("Event link copied to clipboard!");
            }
          }}
          className="inline-flex items-center gap-1.5 rounded-full bg-card border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted transition-colors"
        >
          <Share2 className="size-3.5" aria-hidden />
          Share
        </button>
      </div>

      {query.isLoading ? (
        <ListSkeleton rows={3} tall />
      ) : query.error || !e ? (
        <ErrorState message={errMsg(query.error)} onRetry={() => query.refetch()} />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column (65%, lg:col-span-8) */}
          <div className="lg:col-span-8 space-y-6">
            {/* Cover Banner */}
            <div className="relative aspect-[16/9] sm:aspect-[21/9] overflow-hidden rounded-3xl border border-border shadow-xs">
              <EventCover
                id={e.id}
                src={e.cover_url}
                alt={e.title}
                className="absolute inset-0 h-full w-full object-cover"
              />
              <div className="absolute top-4 left-4 flex items-center gap-2">
                {e.status === "live" && <OfficialSeal />}
                <span className="rounded-full bg-card/90 backdrop-blur-sm px-3 py-1 text-xs font-semibold text-foreground">
                  {e.type}
                </span>
              </div>
            </div>

            {/* Event Header Info */}
            <div className="space-y-3 border-b border-border pb-6">
              <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight leading-tight">
                {e.title}
              </h1>
              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <CalendarDays className="size-4 text-primary" aria-hidden />
                  {fmtDateTime(e.starts_at)}
                </span>
                <span className="flex items-center gap-1.5">
                  <MapPin className="size-4 text-primary" aria-hidden />
                  {e.venue}, {e.area}
                </span>
              </div>
            </div>

            {/* About Section */}
            <div className="space-y-3">
              <h2 className="font-display text-lg font-semibold">About this event</h2>
              <p className="text-muted-foreground text-sm sm:text-base leading-relaxed whitespace-pre-line max-w-prose">
                {e.description ||
                  "Join us for an exciting in-person creator event filled with networking, interactive sessions, and exclusive takeaways."}
              </p>
            </div>

            {/* Organiser Updates Timeline */}
            <div className="space-y-4 pt-4 border-t border-border">
              <h2 className="font-display text-lg font-semibold flex items-center gap-2">
                <Clock className="size-4 text-primary" aria-hidden />
                Organiser Updates
              </h2>
              {announcementsQuery.data && announcementsQuery.data.length > 0 ? (
                <div className="space-y-3">
                  {announcementsQuery.data.map((ann) => (
                    <div
                      key={ann.id}
                      className="rounded-2xl bg-card border border-border p-4 space-y-1"
                    >
                      <p className="text-xs text-muted-foreground">
                        {new Date(ann.created_at).toLocaleDateString("en-IN", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                      <p className="text-sm font-medium text-foreground">{ann.body}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl bg-muted/40 border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                  No announcements published yet. Check back closer to the event date.
                </div>
              )}
            </div>

            {/* Venue Block with Map Placeholder */}
            <div className="space-y-3 pt-4 border-t border-border">
              <h2 className="font-display text-lg font-semibold">Venue & Location</h2>
              <div className="overflow-hidden rounded-2xl border border-border bg-card">
                <div className="p-4 bg-muted/30 border-b border-border space-y-1">
                  <p className="font-semibold text-sm">{e.venue}</p>
                  <p className="text-xs text-muted-foreground">{e.area}, Pune, Maharashtra</p>
                </div>
                {/* Map Graphic Placeholder */}
                <div className="h-44 bg-gradient-to-br from-muted via-background to-muted/80 flex flex-col items-center justify-center p-4 text-center relative overflow-hidden">
                  <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#1E6BFF_1px,transparent_1px)] [background-size:16px_16px]" />
                  <MapPin className="size-8 text-primary mb-2 relative z-10 animate-bounce" />
                  <p className="text-xs font-semibold text-foreground relative z-10">{e.venue}</p>
                  <p className="text-[11px] text-muted-foreground relative z-10">
                    Map navigation coordinates ready on registration
                  </p>
                </div>
              </div>
            </div>

            {/* Report Link */}
            <div className="pt-4 border-t border-border flex justify-end">
              <button
                type="button"
                onClick={() => setReportOpen(true)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-destructive transition-colors"
              >
                <Flag className="size-3.5" aria-hidden />
                Report event
              </button>
            </div>
          </div>

          {/* Right Column (35%, lg:col-span-4): Sticky Ticket / Register Card */}
          <div className="lg:col-span-4">
            <div className="sticky top-24 space-y-6 rounded-3xl bg-card border border-border p-6 shadow-md">
              {/* Event Price & Seats */}
              <div className="space-y-4">
                <div className="flex items-baseline justify-between">
                  <span className="font-display text-2xl font-bold text-foreground">
                    Free Ticket
                  </span>
                  <span className="text-xs font-semibold text-trust bg-trust-soft px-2.5 py-1 rounded-full">
                    Official Entry
                  </span>
                </div>

                <SeatsBar taken={e.seats_taken} capacity={e.capacity} />
              </div>

              {/* Creator Card Row with Follow Button */}
              {e.creator && (
                <div className="flex items-center justify-between rounded-2xl bg-muted/50 p-3 border border-border">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar name={e.creator.display_name} src={e.creator.avatar_url} size={40} />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">
                        <CreatorName c={e.creator} />
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {e.creator.category} creator
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsFollowing(!isFollowing);
                      toast.success(
                        isFollowing
                          ? `Unfollowed ${e.creator?.display_name}`
                          : `Following ${e.creator?.display_name}!`,
                      );
                    }}
                    className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                      isFollowing
                        ? "bg-muted text-foreground border border-border"
                        : "bg-brand text-primary-foreground shadow-brand hover:opacity-90"
                    }`}
                  >
                    {isFollowing ? (
                      <UserCheck className="size-3.5" />
                    ) : (
                      <UserPlus className="size-3.5" />
                    )}
                    <span>{isFollowing ? "Following" : "Follow"}</span>
                  </button>
                </div>
              )}

              {/* Action Button */}
              <Button
                variant="brand"
                size="lg"
                className="w-full text-base font-semibold h-12 rounded-2xl shadow-brand"
                disabled={left === 0}
                onClick={() => setRegisterOpen(true)}
              >
                {left === 0 ? "Sold out" : "Register now — Free"}
              </Button>

              <div className="space-y-2 text-xs text-muted-foreground">
                <p className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-trust shrink-0" /> Instant QR ticket code
                  generated
                </p>
                <p className="flex items-center gap-2">
                  <Sparkles className="size-4 text-primary shrink-0" /> Entry pass valid for{" "}
                  {e.capacity} verified guests
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Sticky Bottom Action Bar (< 768px) */}
      {e && (
        <div className="md:hidden fixed bottom-16 inset-x-0 z-20 bg-card/95 border-t border-border p-4 backdrop-blur shadow-lg flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">
              {left === 0 ? "Sold out" : `${left} seats remaining`}
            </p>
            <p className="font-display font-bold text-lg text-foreground">Free Entry</p>
          </div>
          <Button
            variant="brand"
            size="lg"
            className="rounded-2xl px-6"
            disabled={left === 0}
            onClick={() => setRegisterOpen(true)}
          >
            {left === 0 ? "Sold out" : "Register"}
          </Button>
        </div>
      )}

      {/* Registration Dialog */}
      <Dialog open={registerOpen} onOpenChange={setRegisterOpen}>
        <DialogContent className="sm:max-w-xl rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="font-display text-xl font-bold">
              Register for {e?.title}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Confirm your details below to secure your free event pass.
            </DialogDescription>
          </DialogHeader>

          {/* Form + Order Summary 2-Column Split */}
          <form
            onSubmit={handleRegisterSubmit}
            className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2"
          >
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="reg-name">Full Name</Label>
                <Input
                  id="reg-name"
                  value={fullName}
                  onChange={(ev) => setFullName(ev.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reg-email">Email Address</Label>
                <Input
                  id="reg-email"
                  type="email"
                  value={email}
                  onChange={(ev) => setEmail(ev.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reg-phone">Phone Number</Label>
                <Input
                  id="reg-phone"
                  type="tel"
                  value={phone}
                  onChange={(ev) => setPhone(ev.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reg-count">Number of Passes</Label>
                <select
                  id="reg-count"
                  value={seatsCount}
                  onChange={(ev) => setSeatsCount(Number(ev.target.value))}
                  className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm focus:ring-2 focus:ring-ring"
                >
                  <option value={1}>1 Pass</option>
                  <option value={2}>2 Passes</option>
                </select>
              </div>

              <Button
                type="submit"
                variant="brand"
                className="w-full mt-4"
                disabled={submittingReg}
              >
                {submittingReg ? "Processing..." : "Confirm & Get Ticket"}
              </Button>
            </div>

            {/* Right Summary Panel */}
            <div className="rounded-2xl bg-muted/50 border border-border p-4 space-y-3 flex flex-col justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Order Summary
                </p>
                {e && (
                  <div className="space-y-2">
                    <div className="aspect-video rounded-xl overflow-hidden relative">
                      <EventCover
                        id={e.id}
                        src={e.cover_url}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <p className="font-semibold text-sm line-clamp-1">{e.title}</p>
                    <p className="text-xs text-muted-foreground">{fmtDateTime(e.starts_at)}</p>
                    <p className="text-xs text-muted-foreground">{e.venue}</p>
                  </div>
                )}
              </div>

              <div className="border-t border-border pt-3 space-y-1 text-xs">
                <div className="flex justify-between font-semibold text-foreground">
                  <span>Passes ({seatsCount})</span>
                  <span>Free</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Booking Fee</span>
                  <span>₹0</span>
                </div>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Report Event Dialog */}
      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent className="sm:max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="font-display text-xl font-bold">Report Event</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Let us know why this event listing should be reviewed by administrators.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleReportSubmit} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="rep-reason">Reason for report</Label>
              <select
                id="rep-reason"
                value={reportReason}
                onChange={(ev) => setReportReason(ev.target.value)}
                className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm focus:ring-2 focus:ring-ring"
              >
                <option value="misleading">Misleading information</option>
                <option value="spam">Spam or fake event</option>
                <option value="safety">Safety concern</option>
                <option value="cancelled">Event cancelled</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="rep-notes">Additional Notes (Optional)</Label>
              <textarea
                id="rep-notes"
                value={reportNote}
                onChange={(ev) => setReportNote(ev.target.value)}
                rows={3}
                placeholder="Provide extra details..."
                className="w-full rounded-xl border border-input bg-background p-3 text-sm focus:ring-2 focus:ring-ring resize-none"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setReportOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="destructive" disabled={submittingReport}>
                {submittingReport ? "Submitting..." : "Submit Report"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </main>
  );
}
