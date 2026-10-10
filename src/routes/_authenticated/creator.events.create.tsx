import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Sparkles, CalendarDays, MapPin, Plus, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { EVENT_TYPES, NICHES, errMsg, useMe } from "@/lib/cc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/creator/events/create")({
  head: () => ({
    meta: [{ title: "Create Event — CreatorConnect" }],
  }),
  component: CreateEventPage,
});

function CreateEventPage() {
  const nav = useNavigate();
  const { data: me } = useMe();

  const [title, setTitle] = useState("");
  const [type, setType] = useState<string>("Meetup");
  const [description, setDescription] = useState("");
  const [venue, setVenue] = useState("");
  const [area, setArea] = useState("Koregaon Park");
  const [capacity, setCapacity] = useState(50);
  const [startsAt, setStartsAt] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 16);
  });
  const [targetNiche, setTargetNiche] = useState<string>("Tech reviewer");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !venue.trim()) {
      toast.error("Please fill in event title and venue.");
      return;
    }
    if (!me?.creator?.id) {
      toast.error("You need an active Creator profile to publish events.");
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase
        .from("events")
        .insert({
          creator_id: me.creator.id,
          title: title.trim(),
          type,
          description: description.trim(),
          venue: venue.trim(),
          area: area.trim(),
          capacity: Number(capacity),
          starts_at: new Date(startsAt).toISOString(),
          target_niche: targetNiche,
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
                <Label htmlFor="evt-niche">Target Category</Label>
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
                rows={4}
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-border">
            <Button
              type="submit"
              variant="brand"
              size="lg"
              className="rounded-2xl font-semibold gap-2"
              disabled={submitting}
            >
              <Plus className="size-4" /> {submitting ? "Publishing..." : "Submit Event Listing"}
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
                <span className="self-start rounded-full bg-white/20 backdrop-blur-md px-3 py-1 text-xs font-semibold">
                  {type}
                </span>
                <div>
                  <p className="text-xs opacity-80">
                    {me?.creator?.display_name || "Your Creator Profile"}
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
                    {venue || "Venue name"}, {area}
                  </p>
                </div>

                <div className="pt-2 border-t border-border flex justify-between text-xs font-semibold">
                  <span>Available Seats</span>
                  <span className="text-trust">{capacity} Total Seats</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
