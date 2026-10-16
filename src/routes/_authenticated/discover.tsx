import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { MapPin, Search, SlidersHorizontal, ArrowUpDown, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { EVENT_SELECT, EVENT_TYPES, errMsg, type EventWithCreator } from "@/lib/cc";
import { Chip, EmptyState, ErrorState, EventCardLarge, ListSkeleton } from "@/components/cc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/discover")({
  head: () => ({
    meta: [
      { title: "Discover Creator Events in Pune — CreatorConnect" },
      {
        name: "description",
        content:
          "Explore verified creator meetups, acoustic nights, workshops, and tech launches in Pune.",
      },
      { property: "og:site_name", content: "CreatorConnect" },
      { property: "og:title", content: "Discover Creator Events in Pune — CreatorConnect" },
      {
        property: "og:description",
        content:
          "Explore verified creator meetups, acoustic nights, workshops, and tech launches in Pune.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://creatorconnect.app/discover" },
      { property: "og:image", content: "https://creatorconnect.app/assets/og-image.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Discover Creator Events in Pune — CreatorConnect" },
      {
        name: "twitter:description",
        content:
          "Explore verified creator meetups, acoustic nights, workshops, and tech launches in Pune.",
      },
      { name: "twitter:image", content: "https://creatorconnect.app/assets/og-image.png" },
    ],
    links: [{ rel: "canonical", href: "https://creatorconnect.app/discover" }],
  }),
  component: Discover,
});

function Discover() {
  const [q, setQ] = useState("");
  const [type, setType] = useState<string>("All");
  const [when, setWhen] = useState<"any" | "this" | "next">("any");
  const [availOnly, setAvailOnly] = useState(false);
  const [sortBy, setSortBy] = useState<"soonest" | "popular">("soonest");

  const query = useQuery({
    queryKey: ["events", "live"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select(EVENT_SELECT)
        .eq("status", "live")
        .gte("starts_at", new Date().toISOString())
        .order("starts_at");
      if (error) throw error;
      return data as unknown as EventWithCreator[];
    },
  });

  const list = useMemo(() => {
    const now = new Date();
    let res = (query.data ?? []).filter((e) => {
      const d = new Date(e.starts_at);
      const m = (d.getFullYear() - now.getFullYear()) * 12 + d.getMonth() - now.getMonth();
      if (when === "this" && m !== 0) return false;
      if (when === "next" && m !== 1) return false;
      if (type !== "All" && e.type !== type) return false;
      if (availOnly && e.seats_taken >= e.capacity) return false;
      const s = q.trim().toLowerCase();
      return (
        !s ||
        [e.title, e.venue, e.area, e.creator?.display_name].some((x) =>
          x?.toLowerCase().includes(s),
        )
      );
    });

    if (sortBy === "popular") {
      res = [...res].sort((a, b) => b.seats_taken - a.seats_taken);
    } else {
      res = [...res].sort(
        (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
      );
    }

    return res;
  }, [query.data, q, type, when, availOnly, sortBy]);

  const soon = list.slice(0, 3);
  const rest = list.slice(3);
  const clear = () => {
    setQ("");
    setType("All");
    setWhen("any");
    setAvailOnly(false);
    setSortBy("soonest");
  };

  return (
    <main className="px-4 py-5 md:px-6 md:py-8 pb-24">
      {/* Hero Section (Desktop & Mobile) */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-card via-card to-muted/40 border border-border p-6 md:p-10 mb-8 shadow-xs">
        <div className="max-w-2xl space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full bg-brand/10 border border-brand/20 px-3.5 py-1 text-xs font-semibold text-primary">
            <Sparkles className="size-3.5" aria-hidden />
            <span>Featured Events in Pune</span>
          </div>
          <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-foreground leading-tight">
            Meet your favourite creators, in person.
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed max-w-xl">
            Discover official meetups, interactive workshops, live podcasts, and exclusive launches
            near you.
          </p>

          {/* Desktop & Mobile Hero Search */}
          <div className="relative pt-2 max-w-lg">
            <span className="sr-only">Search events</span>
            <Search
              className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search events, creators, or venues..."
              className="h-12 rounded-2xl bg-background/90 pl-11 pr-4 text-sm sm:text-base shadow-xs focus:ring-2 focus:ring-primary border-border"
            />
          </div>
        </div>
      </section>

      {/* Main Grid: Left Filters Panel (Desktop) + Right Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Left Filter Panel (Desktop: lg:block, Mobile: Chip list) */}
        <aside aria-label="Event filters" className="space-y-6">
          {/* Mobile Filter Chips */}
          <div className="lg:hidden space-y-3">
            <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
              {["All", ...EVENT_TYPES].map((t) => (
                <Chip key={t} active={type === t} onClick={() => setType(t)}>
                  {t}
                </Chip>
              ))}
            </div>
            <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
              {(
                [
                  ["any", "Any date"],
                  ["this", "This month"],
                  ["next", "Next month"],
                ] as const
              ).map(([k, l]) => (
                <Chip key={k} active={when === k} onClick={() => setWhen(k)}>
                  {l}
                </Chip>
              ))}
            </div>
          </div>

          {/* Desktop Filter Panel */}
          <div className="hidden lg:block sticky top-24 space-y-6 rounded-3xl bg-card border border-border p-6 shadow-xs">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <h2 className="font-display font-semibold text-lg flex items-center gap-2">
                <SlidersHorizontal className="size-4 text-primary" aria-hidden />
                Filters
              </h2>
              {(type !== "All" || when !== "any" || availOnly || q) && (
                <button
                  type="button"
                  onClick={clear}
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  Clear all
                </button>
              )}
            </div>

            {/* Event Type */}
            <div className="space-y-3">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Category
              </label>
              <div className="flex flex-wrap gap-2">
                {["All", ...EVENT_TYPES].map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                      type === t
                        ? "bg-foreground text-background shadow-xs"
                        : "bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Date Range */}
            <div className="space-y-3 pt-2 border-t border-border">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Date Range
              </label>
              <div className="space-y-1.5">
                {(
                  [
                    ["any", "Any time"],
                    ["this", "This month"],
                    ["next", "Next month"],
                  ] as const
                ).map(([k, l]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setWhen(k)}
                    className={`w-full text-left px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                      when === k
                        ? "bg-primary/10 text-primary font-semibold"
                        : "text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>

            {/* Location Pill & Available Seats */}
            <div className="space-y-3 pt-2 border-t border-border">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Preferences
              </label>
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-muted/60 text-sm font-medium">
                <MapPin className="size-4 text-primary" aria-hidden />
                <span>Pune, MH</span>
              </div>
              <label className="flex items-center gap-2.5 px-3 py-2 text-sm font-medium text-foreground cursor-pointer hover:bg-muted rounded-xl transition-colors">
                <input
                  type="checkbox"
                  checked={availOnly}
                  onChange={(e) => setAvailOnly(e.target.checked)}
                  className="size-4 rounded border-border text-primary focus:ring-primary"
                />
                <span>Seats available only</span>
              </label>
            </div>
          </div>
        </aside>

        {/* Right Event Grid Area */}
        <section className="lg:col-span-3 space-y-6">
          {/* Header Controls: Count & Sort */}
          <div className="flex items-center justify-between border-b border-border pb-4">
            <p className="text-sm font-semibold text-muted-foreground">
              Showing <span className="text-foreground">{list.length}</span>{" "}
              {list.length === 1 ? "event" : "events"}
            </p>

            <div className="flex items-center gap-2">
              <ArrowUpDown className="size-4 text-muted-foreground" aria-hidden />
              <label htmlFor="sort-dropdown" className="sr-only">
                Sort events
              </label>
              <select
                id="sort-dropdown"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as "soonest" | "popular")}
                className="bg-card border border-border rounded-xl px-3 py-1.5 text-xs sm:text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="soonest">Soonest first</option>
                <option value="popular">Most popular</option>
              </select>
            </div>
          </div>

          {/* Feed States */}
          {query.isLoading ? (
            <ListSkeleton tall rows={3} />
          ) : query.error ? (
            <ErrorState message={errMsg(query.error)} onRetry={() => query.refetch()} />
          ) : list.length === 0 ? (
            <EmptyState
              title="No events match your criteria"
              body="Try changing your filters or searching for a different creator or venue."
              action={
                <Button variant="brand" onClick={clear}>
                  Reset filters
                </Button>
              }
            />
          ) : (
            <div className="space-y-8">
              {/* Happening Soon Section */}
              {soon.length > 0 && (
                <div>
                  <h2 className="mb-4 text-xl font-bold font-display tracking-tight">
                    Happening soon
                  </h2>
                  {/* Mobile: Horizontal Snap Scroll, Desktop: 3-Column Card Grid */}
                  <div className="no-scrollbar -mx-4 flex snap-x gap-4 overflow-x-auto px-4 lg:mx-0 lg:px-0 lg:grid lg:grid-cols-3 lg:overflow-visible">
                    {soon.map((e) => (
                      <div key={e.id} className="w-[82%] sm:w-[60%] lg:w-full shrink-0 snap-start">
                        <EventCardLarge e={e} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* More Events Grid */}
              {rest.length > 0 && (
                <div>
                  <h2 className="mb-4 text-xl font-bold font-display tracking-tight">
                    More creator events
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                    {rest.map((e) => (
                      <EventCardLarge key={e.id} e={e} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
