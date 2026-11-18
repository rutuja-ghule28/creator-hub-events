import { useState, useMemo } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import {
  Sparkles,
  CalendarDays,
  MapPin,
  Plus,
  ArrowLeft,
  Clock,
  Megaphone,
  Globe,
  Ticket,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { EVENT_TYPES, NICHES, errMsg, useMe } from "@/lib/cc";
import { ListSkeleton } from "@/components/cc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  validateExternalUrl,
  detectProviderFromUrl,
  MAJOR_INDIAN_CITIES,
  formatExternalPrice,
} from "@/lib/external-events";

export const Route = createFileRoute("/_authenticated/creator/events/create")({
  head: () => ({
    meta: [
      { title: "Host a New Event — CreatorConnect" },
      {
        name: "description",
        content: "Create and publish official creator meetups, workshops, and ticketed sessions.",
      },
      { property: "og:site_name", content: "CreatorConnect" },
      { property: "og:title", content: "Host a New Event — CreatorConnect" },
      {
        property: "og:description",
        content: "Create and publish official creator meetups, workshops, and ticketed sessions.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://creatorconnect.app/creator/events/create" },
      { property: "og:image", content: "https://creatorconnect.app/assets/og-image.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Host a New Event — CreatorConnect" },
      {
        name: "twitter:description",
        content: "Create and publish official creator meetups, workshops, and ticketed sessions.",
      },
      { name: "twitter:image", content: "https://creatorconnect.app/assets/og-image.png" },
    ],
    links: [{ rel: "canonical", href: "https://creatorconnect.app/creator/events/create" }],
  }),
  component: CreateEventPage,
});

function CreateEventPage() {
  const nav = useNavigate();
  const { data: me, isLoading: meLoading } = useMe();

  const isAuthorized =
    me?.roles?.includes("creator") ||
    me?.roles?.includes("organizer") ||
    me?.profile?.account_type === "creator" ||
    me?.profile?.account_type === "organizer" ||
    me?.roles?.includes("admin");

  const [ticketingMode, setTicketingMode] = useState<"internal" | "external">("internal");

  // Common Fields
  const [title, setTitle] = useState("");
  const [type, setType] = useState<string>("Meetup");
  const [description, setDescription] = useState("");
  const [venue, setVenue] = useState("");
  const [area, setArea] = useState("Koregaon Park");
  const [city, setCity] = useState("Pune");
  const [capacity, setCapacity] = useState(50);
  const [startsAt, setStartsAt] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 16);
  });
  const [targetNiche, setTargetNiche] = useState<string>("Tech reviewer");

  // External Booking Fields
  const [bookingUrl, setBookingUrl] = useState("");
  const [isFree, setIsFree] = useState(true);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");

  // URL Validation & Source Detection
  const urlValidation = useMemo(() => {
    if (!bookingUrl.trim()) return null;
    return validateExternalUrl(bookingUrl.trim());
  }, [bookingUrl]);

  const detectedProvider = useMemo(() => {
    if (!bookingUrl.trim()) return null;
    return detectProviderFromUrl(bookingUrl.trim());
  }, [bookingUrl]);

  // Creator Campaign & Promotion Brief state (internal events)
  const [hasCampaign, setHasCampaign] = useState(false);
  const [promotionBrief, setPromotionBrief] = useState("");
  const [applicationDeadline, setApplicationDeadline] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 5);
    return d.toISOString().slice(0, 16);
  });

  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !venue.trim()) {
      toast.error("Please fill in event title and venue.");
      return;
    }

    const creatorId = me?.creator?.id;
    const organizerId = me?.organizer?.id;

    if (!creatorId && !organizerId) {
      toast.error("You need an active Creator or Organizer profile to publish events.");
      return;
    }

    if (ticketingMode === "external") {
      const urlCheck = validateExternalUrl(bookingUrl);
      if (!urlCheck.valid || !urlCheck.normalizedUrl) {
        toast.error(urlCheck.error || "Please enter a valid HTTPS official booking URL.");
        return;
      }

      setSubmitting(true);
      try {
        const detected = detectProviderFromUrl(urlCheck.normalizedUrl);
        const { error } = await supabase.from("external_events").insert({
          source_name: detected.sourceName,
          source_event_id: `org-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
          source_event_url: urlCheck.normalizedUrl,
          official_booking_url: urlCheck.normalizedUrl,
          title: title.trim(),
          description: description.trim(),
          category: type,
          starts_at: new Date(startsAt).toISOString(),
          venue_name: venue.trim(),
          address: area.trim(),
          city: city.trim(),
          country: "IN",
          ticket_price_min: isFree ? null : minPrice ? Number(minPrice) : null,
          ticket_price_max: isFree
            ? null
            : maxPrice
              ? Number(maxPrice)
              : minPrice
                ? Number(minPrice)
                : null,
          currency: "INR",
          is_free: isFree,
          status: "pending",
          submission_type: "organizer",
          submitted_by_creator_id: creatorId || null,
          submitted_by_organizer_id: organizerId || null,
          is_demo: false,
        });

        if (error) throw error;
        toast.success("External event submitted for admin verification!");
        nav({ to: "/creator/events" });
      } catch (err) {
        toast.error(errMsg(err));
      } finally {
        setSubmitting(false);
      }
      return;
    }

    // Internal Pass Registration
    if (hasCampaign && !promotionBrief.trim()) {
      toast.error("Please specify the promotion brief for creator collaboration.");
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from("events")
        .insert({
          creator_id: creatorId || null,
          organizer_id: organizerId || null,
          title: title.trim(),
          type,
          description: description.trim(),
          venue: venue.trim(),
          area: area.trim(),
          capacity: Number(capacity),
          starts_at: new Date(startsAt).toISOString(),
          target_niche: targetNiche,
          promotion_brief: hasCampaign && promotionBrief.trim() ? promotionBrief.trim() : null,
          application_deadline:
            hasCampaign && applicationDeadline ? new Date(applicationDeadline).toISOString() : null,
          status: "pending",
        })
        .select()
        .single();

      if (error) throw error;
      toast.success("Event created and submitted for verification!");
      nav({ to: "/creator/events" });
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (meLoading) {
    return <ListSkeleton />;
  }

  if (me && !isAuthorized) {
    return (
      <main className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="size-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
          <Sparkles className="size-8" />
        </div>
        <h1 className="font-display text-2xl font-bold">Create New Event</h1>
        <p className="text-sm text-muted-foreground max-w-md">
          You are currently signed in as an Attendee. Event creation and host management tools are
          available for Creator and Organizer accounts.
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
      <div className="flex items-center gap-3 border-b border-border pb-4">
        <button
          type="button"
          onClick={() => nav({ to: "/creator/events" })}
          className="inline-flex size-10 items-center justify-center rounded-full hover:bg-muted transition-colors"
        >
          <ArrowLeft className="size-5 text-muted-foreground" />
        </button>
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight">
            Create New Event
          </h1>
          <p className="text-sm text-muted-foreground">
            Fill in details on the left to see a live preview on the right.
          </p>
        </div>
      </div>

      {/* 2-Column Split: Form (Left 60%) + Sticky Live Preview Card (Right 40%) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Form (lg:col-span-7) */}
        <form
          onSubmit={handleSubmit}
          className="lg:col-span-7 space-y-6 rounded-3xl bg-card border border-border p-6 shadow-xs"
        >
          {/* Ticketing Mode Switcher */}
          <div className="space-y-2.5 p-4 rounded-2xl bg-muted/40 border border-border">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Ticketing & Booking Method
            </Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setTicketingMode("internal")}
                className={`p-3.5 rounded-2xl text-left border transition-all ${
                  ticketingMode === "internal"
                    ? "bg-card border-primary ring-2 ring-primary/20 text-foreground shadow-xs"
                    : "bg-muted/40 border-border text-muted-foreground hover:bg-muted"
                }`}
              >
                <div className="flex items-center gap-2 font-semibold text-xs sm:text-sm">
                  <Ticket className="size-4 text-primary" />
                  <span>Creator Connect Passes</span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                  In-platform RSVP with instant QR code tickets.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setTicketingMode("external")}
                className={`p-3.5 rounded-2xl text-left border transition-all ${
                  ticketingMode === "external"
                    ? "bg-card border-primary ring-2 ring-primary/20 text-foreground shadow-xs"
                    : "bg-muted/40 border-border text-muted-foreground hover:bg-muted"
                }`}
              >
                <div className="flex items-center gap-2 font-semibold text-xs sm:text-sm">
                  <Globe className="size-4 text-primary" />
                  <span>Official External Ticketing</span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                  Direct attendees to BookMyShow, Townscript, Insider, Luma, etc.
                </p>
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="evt-title">Event Title</Label>
              <Input
                id="evt-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Pune Creator Meetup & Live Q&A"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="evt-type">Event Type</Label>
                <select
                  id="evt-type"
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm focus:ring-2 focus:ring-ring"
                >
                  {EVENT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="evt-niche">Primary Category</Label>
                <select
                  id="evt-niche"
                  value={targetNiche}
                  onChange={(e) => setTargetNiche(e.target.value)}
                  className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm focus:ring-2 focus:ring-ring"
                >
                  {NICHES.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="evt-desc">Event Description</Label>
              <textarea
                id="evt-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Describe what attendees can expect, schedule, and guest highlights..."
                className="w-full rounded-xl border border-input bg-background p-3 text-sm focus:ring-2 focus:ring-ring resize-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="evt-venue">Venue Name</Label>
                <Input
                  id="evt-venue"
                  value={venue}
                  onChange={(e) => setVenue(e.target.value)}
                  placeholder="e.g. Blue Tokai Coffee Roasters"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="evt-area">Area / Locality</Label>
                <Input
                  id="evt-area"
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  placeholder="e.g. Koregaon Park"
                />
              </div>
            </div>

            {/* City Selector & Start Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="evt-city">City / Region</Label>
                <select
                  id="evt-city"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm focus:ring-2 focus:ring-ring"
                >
                  {MAJOR_INDIAN_CITIES.filter((c) => c !== "All India").map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="evt-date">Start Date & Time</Label>
                <Input
                  id="evt-date"
                  type="datetime-local"
                  value={startsAt}
                  onChange={(e) => setStartsAt(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* EXTERNAL TICKETING INPUTS */}
            {ticketingMode === "external" ? (
              <div className="space-y-4 rounded-2xl border border-primary/20 bg-primary/5 p-4">
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <Globe className="size-4 text-primary" /> Official External Ticketing Details
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Provide the official HTTPS checkout or registration link where attendees will
                    complete booking.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="evt-booking-url">Official Booking URL (HTTPS)</Label>
                  <div className="relative">
                    <Input
                      id="evt-booking-url"
                      type="url"
                      value={bookingUrl}
                      onChange={(e) => setBookingUrl(e.target.value)}
                      placeholder="https://in.bookmyshow.com/... or https://www.townscript.com/..."
                      required={ticketingMode === "external"}
                      className="pr-24"
                    />
                    {detectedProvider && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-primary/10 text-primary border border-primary/20">
                        <CheckCircle2 className="size-3 text-trust" />
                        {detectedProvider.label}
                      </span>
                    )}
                  </div>
                  {urlValidation && !urlValidation.valid && (
                    <p className="text-xs text-destructive flex items-center gap-1">
                      <AlertCircle className="size-3.5 shrink-0" />
                      {urlValidation.error}
                    </p>
                  )}
                </div>

                {/* Ticket Price Details */}
                <div className="space-y-2 pt-2 border-t border-border">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Ticket Price
                    </Label>
                    <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-semibold">
                      <input
                        type="checkbox"
                        checked={isFree}
                        onChange={(e) => setIsFree(e.target.checked)}
                        className="size-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
                      />
                      <span>Free Entry</span>
                    </label>
                  </div>

                  {!isFree && (
                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <div className="space-y-1">
                        <Label htmlFor="evt-min-price" className="text-xs">
                          Min Price (₹)
                        </Label>
                        <Input
                          id="evt-min-price"
                          type="number"
                          min={1}
                          placeholder="e.g. 499"
                          value={minPrice}
                          onChange={(e) => setMinPrice(e.target.value)}
                          required={!isFree}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="evt-max-price" className="text-xs">
                          Max Price (₹) (Optional)
                        </Label>
                        <Input
                          id="evt-max-price"
                          type="number"
                          min={minPrice ? Number(minPrice) : 1}
                          placeholder="e.g. 1499"
                          value={maxPrice}
                          onChange={(e) => setMaxPrice(e.target.value)}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-3 text-xs text-amber-900 dark:text-amber-200">
                  <span className="font-semibold">Admin Verification:</span> Official external
                  ticketing links are reviewed by Creator Connect administrators before appearing
                  publicly on Discover Events.
                </div>
              </div>
            ) : (
              /* INTERNAL PASSES INPUTS */
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="evt-cap">Seat Capacity</Label>
                  <Input
                    id="evt-cap"
                    type="number"
                    min={5}
                    max={1000}
                    value={capacity}
                    onChange={(e) => setCapacity(Number(e.target.value))}
                    required
                  />
                </div>

                {/* Creator Collaboration / Campaign Brief Section */}
                <div className="rounded-2xl border border-brand/30 bg-brand/5 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                        <Sparkles className="size-4 text-primary" /> Creator Campaign &
                        Collaboration
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        Invite creators in your niche to apply, submit pitches, and promote your
                        event.
                      </p>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={hasCampaign}
                        onChange={(e) => setHasCampaign(e.target.checked)}
                        className="size-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
                      />
                      <span className="text-xs font-semibold text-foreground">
                        {hasCampaign ? "Active" : "Enable"}
                      </span>
                    </label>
                  </div>

                  {hasCampaign && (
                    <div className="space-y-3.5 pt-3 border-t border-brand/20">
                      <div className="space-y-1.5">
                        <Label htmlFor="evt-brief">Promotion Brief & Deliverables</Label>
                        <textarea
                          id="evt-brief"
                          value={promotionBrief}
                          onChange={(e) => setPromotionBrief(e.target.value)}
                          rows={3}
                          placeholder="e.g. Seeking local creators to attend the event, post 1 reel and 2 stories before the date, and participate in a live speaker session."
                          className="w-full rounded-xl border border-input bg-background p-3 text-sm focus:ring-2 focus:ring-ring resize-none"
                          required={hasCampaign}
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label htmlFor="evt-deadline">Application Deadline</Label>
                          <Input
                            id="evt-deadline"
                            type="datetime-local"
                            value={applicationDeadline}
                            onChange={(e) => setApplicationDeadline(e.target.value)}
                            required={hasCampaign}
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor="evt-collab-niche">Target Creator Niche</Label>
                          <select
                            id="evt-collab-niche"
                            value={targetNiche}
                            onChange={(e) => setTargetNiche(e.target.value)}
                            className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm focus:ring-2 focus:ring-ring"
                          >
                            {NICHES.map((n) => (
                              <option key={n} value={n}>
                                {n}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          <div className="flex justify-end pt-4 border-t border-border">
            <Button
              type="submit"
              variant="brand"
              size="lg"
              className="rounded-2xl font-semibold gap-2"
              disabled={submitting}
            >
              <Plus className="size-4" />{" "}
              {submitting
                ? "Submitting..."
                : ticketingMode === "external"
                  ? "Submit for Admin Verification"
                  : "Submit Event Listing"}
            </Button>
          </div>
        </form>

        {/* Right Sticky Live Preview Card (lg:col-span-5) */}
        <div className="lg:col-span-5">
          <div className="sticky top-24 space-y-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Sparkles className="size-4 text-primary" /> Live Card Preview
            </div>

            <div className="rounded-3xl bg-card border border-border overflow-hidden shadow-lg transition-all">
              {/* Cover Banner Mock */}
              <div className="aspect-[16/9] bg-gradient-to-br from-brand via-primary to-purple-600 p-4 text-primary-foreground flex flex-col justify-between relative">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-white/20 backdrop-blur-md px-3 py-1 text-xs font-semibold">
                    {type}
                  </span>
                  {ticketingMode === "external" && (
                    <span className="rounded-full bg-amber-400/90 text-amber-950 font-bold px-2.5 py-0.5 text-[11px] inline-flex items-center gap-1">
                      <Globe className="size-3" />
                      {detectedProvider?.label || "External"}
                    </span>
                  )}
                </div>
                <div>
                  <p className="text-xs opacity-80">
                    {me?.creator?.display_name || me?.organizer?.name || "Your Creator Profile"}
                  </p>
                  <h3 className="font-display font-bold text-xl line-clamp-1">
                    {title || "Your Event Title Here"}
                  </h3>
                </div>
              </div>

              {/* Card Body */}
              <div className="p-5 space-y-3">
                <div className="space-y-1.5 text-xs text-muted-foreground">
                  <p className="flex items-center gap-2 font-medium text-foreground">
                    <CalendarDays className="size-4 text-primary" />
                    {startsAt
                      ? new Date(startsAt).toLocaleString("en-IN", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "Date & time"}
                  </p>
                  <p className="flex items-center gap-2 font-medium text-foreground">
                    <MapPin className="size-4 text-primary" />
                    {venue || "Venue name"}, {area}, {city}
                  </p>
                </div>

                {ticketingMode === "external" ? (
                  <div className="rounded-2xl bg-muted/40 p-3 border border-border space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Pricing:</span>
                      <span className="font-bold text-foreground">
                        {formatExternalPrice(
                          isFree,
                          minPrice ? Number(minPrice) : null,
                          maxPrice ? Number(maxPrice) : null,
                        )}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border">
                      <span>Status:</span>
                      <span className="font-semibold text-amber-600 dark:text-amber-400">
                        Pending Verification
                      </span>
                    </div>
                  </div>
                ) : (
                  <>
                    {hasCampaign && (
                      <div className="rounded-xl bg-brand/10 border border-brand/20 p-2.5 text-xs space-y-1">
                        <p className="font-semibold text-primary flex items-center gap-1.5">
                          <Megaphone className="size-3.5" /> Creator Campaign Open
                        </p>
                        <p className="text-[11px] text-muted-foreground line-clamp-2">
                          {promotionBrief ||
                            "Campaign brief and creator deliverables specified here."}
                        </p>
                      </div>
                    )}

                    <div className="pt-2 border-t border-border flex justify-between text-xs font-semibold">
                      <span>Available Seats</span>
                      <span className="text-trust">{capacity} Total Seats</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
