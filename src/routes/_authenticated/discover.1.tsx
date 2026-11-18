import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  MapPin,
  Search,
  SlidersHorizontal,
  ArrowUpDown,
  Sparkles,
  Users,
  ShieldCheck,
  BadgeCheck,
  CheckCircle2,
  Clock,
  PlusCircle,
  CalendarDays,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { EVENT_SELECT, EVENT_TYPES, NICHES, errMsg, useMe, type Creator, type EventWithCreator } from "@/lib/cc";
import {
  Chip,
  CreatorCard,
  EmptyState,
  ErrorState,
  EventCardLarge,
  ListSkeleton,
} from "@/components/cc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type DiscoverSearch = {
  tab?: "events" | "creators";
  q?: string;
  scope?: "upcoming" | "past";
};

export const Route = createFileRoute("/_authenticated/discover/1")({
  validateSearch: (s: Record<string, unknown>): DiscoverSearch => ({
    tab: s["tab"] === "creators" ? "creators" : "events",
    q: typeof s["q"] === "string" ? s["q"] : undefined,
    scope: s["scope"] === "past" ? "past" : "upcoming",
  }),
  head: () => ({
    meta: [
      { title: "Discover Creator Events & Directory in Pune — CreatorConnect" },
      {
        name: "description",
        content:
          "Explore verified creator meetups, acoustic nights, workshops, tech launches, and verified creator profiles.",
      },
      { property: "og:site_name", content: "CreatorConnect" },
      { property: "og:title", content: "Discover Creator Events & Directory in Pune — CreatorConnect" },
      {
        property: "og:description",
        content:
          "Explore verified creator meetups, acoustic nights, workshops, tech launches, and verified creator profiles.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://creatorconnect.app/discover/1" },
      { property: "og:image", content: "https://creatorconnect.app/assets/og-image.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Discover Creator Events & Directory in Pune — CreatorConnect" },
      {
        name: "twitter:description",
        content:
          "Explore verified creator meetups, acoustic nights, workshops, tech launches, and verified creator profiles.",
      },
      { name: "twitter:image", content: "https://creatorconnect.app/assets/og-image.png" },
    ],
    links: [{ rel: "canonical", href: "https://creatorconnect.app/discover/1" }],
  }),
  component: Discover,
});

function Discover() {
  const searchParams = Route.useSearch();
  const { data: me } = useMe();
  const isCreator = me?.roles?.includes("creator");

  const [activeTab, setActiveTab] = useState<"events" | "creators">(
    searchParams.tab === "creators" ? "creators" : "events",
  );
  const [eventScope, setEventScope] = useState<"upcoming" | "past">(
    searchParams.scope === "past" ? "past" : "upcoming",
  );

  // Events Filter State
  const [q, setQ] = useState(searchParams.q ?? "");
  const [type, setType] = useState<string>("All");
  const [when, setWhen] = useState<"any" | "this" | "next">("any");
  const [availOnly, setAvailOnly] = useState(false);
  const [sortBy, setSortBy] = useState<"soonest" | "popular">("soonest");

  // Creators Directory Filter State
  const [creatorQ, setCreatorQ] = useState("");
  const [creatorNiche, setCreatorNiche] = useState<string>("All");
  const [creatorLocation, setCreatorLocation] = useState<string>("All");
  const [creatorMinFollowers, setCreatorMinFollowers] = useState<number>(0);
  const [creatorVerifiedOnly, setCreatorVerifiedOnly] = useState(false);
  const [creatorSortBy, setCreatorSortBy] = useState<"followers" | "popular" | "name">("followers");

  // Real Supabase Events Query - Only live events (pending remain protected by RLS and status check)
  const eventsQuery = useQuery({
    queryKey: ["events", "live"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select(EVENT_SELECT)
        .eq("status", "live")
        .order("starts_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as EventWithCreator[];
    },
  });

  const allEvents = useMemo(() => eventsQuery.data ?? [], [eventsQuery.data]);
  const now = new Date();

  const upcomingEvents = useMemo(
    () => allEvents.filter((e) => new Date(e.starts_at) >= now),
    [allEvents, now],
  );

  const pastEvents = useMemo(
    () => allEvents.filter((e) => new Date(e.starts_at) < now),
    [allEvents, now],
  );

  // Real Supabase Creators Query
  const creatorsQuery = useQuery({
    queryKey: ["creators-directory"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("creators")
        .select("*")
        .order("audience_size", { ascending: false });
      if (error) throw error;
      return data as Creator[];
    },
  });

  // Filtered Events
  const eventList = useMemo(() => {
    const pool = eventScope === "upcoming" ? upcomingEvents : pastEvents;
    const nowTime = new Date();

    let res = pool.filter((e) => {
      const d = new Date(e.starts_at);
      if (eventScope === "upcoming") {
        const m = (d.getFullYear() - nowTime.getFullYear()) * 12 + d.getMonth() - nowTime.getMonth();
        if (when === "this" && m !== 0) return false;
        if (when === "next" && m !== 1) return false;
        if (availOnly && e.seats_taken >= e.capacity) return false;
      }
      if (type !== "All" && e.type !== type) return false;
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
    } else if (eventScope === "upcoming") {
      res = [...res].sort(
        (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
      );
    } else {
      // Past events: show most recent first
      res = [...res].sort(
        (a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime(),
      );
    }

    return res;
  }, [eventScope, upcomingEvents, pastEvents, q, type, when, availOnly, sortBy]);

  // Filtered Creators
  const creatorList = useMemo(() => {
    let res = (creatorsQuery.data ?? []).filter((c) => {
      if (creatorNiche !== "All" && c.category.toLowerCase() !== creatorNiche.toLowerCase()) {
        return false;
      }
      if (creatorLocation !== "All") {
        const locMatch = c.location?.toLowerCase().includes(creatorLocation.toLowerCase());
        if (!locMatch) return false;
      }
      if (c.audience_size < creatorMinFollowers) {
        return false;
      }
      if (creatorVerifiedOnly && !c.verified) {
        return false;
      }
      const s = creatorQ.trim().toLowerCase();
      if (s) {
        const matches =
          c.display_name?.toLowerCase().includes(s) ||
          c.bio?.toLowerCase().includes(s) ||
          c.category?.toLowerCase().includes(s) ||
          c.location?.toLowerCase().includes(s);
        if (!matches) return false;
      }
      return true;
    });

    if (creatorSortBy === "followers") {
      res = [...res].sort((a, b) => b.audience_size - a.audience_size);
    } else if (creatorSortBy === "popular") {
      res = [...res].sort((a, b) => (b.page_views ?? 0) - (a.page_views ?? 0));
    } else if (creatorSortBy === "name") {
      res = [...res].sort((a, b) => a.display_name.localeCompare(b.display_name));
    }

    return res;
  }, [
    creatorsQuery.data,
    creatorNiche,
    creatorLocation,
    creatorMinFollowers,
    creatorVerifiedOnly,
    creatorQ,
    creatorSortBy,
  ]);

  // Derived available unique locations from creators
  const availableLocations = useMemo(() => {
    const raw = (creatorsQuery.data ?? []).map((c) => c.location).filter(Boolean);
    const set = new Set(["Pune", "Mumbai", "Delhi", "Bangalore", ...raw]);
    return Array.from(set);
  }, [creatorsQuery.data]);

  const soonEvents = eventList.slice(0, 3);
  const restEvents = eventList.slice(3);

  const clearEventFilters = () => {
    setQ("");
    setType("All");
    setWhen("any");
    setAvailOnly(false);
    setSortBy("soonest");
    setEventScope("upcoming");
  };

  const clearCreatorFilters = () => {
    setCreatorQ("");
    setCreatorNiche("All");
    setCreatorLocation("All");
    setCreatorMinFollowers(0);
    setCreatorVerifiedOnly(false);
    setCreatorSortBy("followers");
  };

  return (
    <main className="px-4 py-5 md:px-6 md:py-8 pb-24 space-y-8">
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-card via-card to-muted/40 border border-border p-6 md:p-10 shadow-xs">
        <div className="max-w-2xl space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full bg-brand/10 border border-brand/20 px-3.5 py-1 text-xs font-semibold text-primary">
            <Sparkles className="size-3.5" aria-hidden />
            <span>Pune Creator Hub</span>
          </div>
          <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-foreground leading-tight">
            Meet your favourite creators, in person.
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed max-w-xl">
            Discover official meetups and workshops, or explore verified creator profiles for
            collabs and brand campaigns.
          </p>

          {/* Quick Search */}
          <div className="relative pt-2 max-w-lg">
            <span className="sr-only">Search</span>
            <Search
              className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={activeTab === "events" ? q : creatorQ}
              onChange={(e) =>
                activeTab === "events" ? setQ(e.target.value) : setCreatorQ(e.target.value)
              }
              placeholder={
                activeTab === "events"
                  ? "Search events, creators, or venues..."
                  : "Search creator name, category, or bio..."
              }
              className="h-12 rounded-2xl bg-background/90 pl-11 pr-4 text-sm sm:text-base shadow-xs focus:ring-2 focus:ring-primary border-border"
            />
          </div>
        </div>
      </section>

      {/* Main Mode Tabs Switcher */}
      <div className="flex bg-muted/60 p-1.5 rounded-2xl border border-border self-start inline-flex">
        <button
          type="button"
          onClick={() => setActiveTab("events")}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
            activeTab === "events"
              ? "bg-card text-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Sparkles className="size-4 text-primary" />
          <span>Explore Events ({allEvents.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("creators")}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
            activeTab === "creators"
              ? "bg-card text-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Users className="size-4 text-primary" />
          <span>Creator Directory ({creatorsQuery.data?.length ?? 0})</span>
        </button>
      </div>

      {/* VIEW 1: CREATOR DIRECTORY FOR ORGANIZERS */}
      {activeTab === "creators" ? (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
          {/* Left Filters Panel */}
          <aside aria-label="Creator filters" className="space-y-6">
            <div className="sticky top-24 space-y-6 rounded-3xl bg-card border border-border p-6 shadow-xs">
              <div className="flex items-center justify-between border-b border-border pb-4">
                <h2 className="font-display font-semibold text-lg flex items-center gap-2">
                  <SlidersHorizontal className="size-4 text-primary" aria-hidden />
                  Creator Filters
                </h2>
                {(creatorNiche !== "All" ||
                  creatorLocation !== "All" ||
                  creatorMinFollowers > 0 ||
                  creatorVerifiedOnly ||
                  creatorQ) && (
                  <button
                    type="button"
                    onClick={clearCreatorFilters}
                    className="text-xs font-semibold text-primary hover:underline"
                  >
                    Clear all
                  </button>
                )}
              </div>

              {/* Creator Niche / Category */}
              <div className="space-y-3">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Niche / Category
                </label>
                <div className="flex flex-wrap gap-2">
                  {["All", ...NICHES].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setCreatorNiche(n)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                        creatorNiche === n
                          ? "bg-foreground text-background shadow-xs"
                          : "bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              {/* Location Filter */}
              <div className="space-y-3 pt-2 border-t border-border">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Location / City
                </label>
                <select
                  value={creatorLocation}
                  onChange={(e) => setCreatorLocation(e.target.value)}
                  className="w-full h-10 rounded-xl border border-input bg-background px-3 text-xs sm:text-sm font-semibold focus:ring-2 focus:ring-ring"
                >
                  <option value="All">All Locations</option>
                  {availableLocations.map((loc) => (
                    <option key={loc} value={loc}>
                      {loc}
                    </option>
                  ))}
                </select>
              </div>

              {/* Follower Count Filter */}
              <div className="space-y-3 pt-2 border-t border-border">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Minimum Followers
                </label>
                <div className="space-y-1.5">
                  {[
                    [0, "Any audience size"],
                    [1000, "1K+ followers"],
                    [5000, "5K+ followers"],
                    [10000, "10K+ followers"],
                    [50000, "50K+ followers"],
                    [100000, "100K+ followers"],
                  ].map(([count, label]) => (
                    <button
                      key={count}
                      type="button"
                      onClick={() => setCreatorMinFollowers(Number(count))}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs sm:text-sm font-medium transition-colors ${
                        creatorMinFollowers === count
                          ? "bg-primary/10 text-primary font-semibold"
                          : "text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Verified Creators Toggle */}
              <div className="space-y-3 pt-2 border-t border-border">
                <label className="flex items-center gap-2.5 px-1 py-1 text-sm font-medium text-foreground cursor-pointer hover:opacity-90 transition-opacity">
                  <input
                    type="checkbox"
                    checked={creatorVerifiedOnly}
                    onChange={(e) => setCreatorVerifiedOnly(e.target.checked)}
                    className="size-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
                  />
                  <span className="flex items-center gap-1.5 text-xs font-semibold">
                    <ShieldCheck className="size-4 text-trust" /> Verified creators only
                  </span>
                </label>
              </div>
            </div>
          </aside>

          {/* Right Creator Cards Grid */}
          <section className="lg:col-span-3 space-y-6">
            {/* Header Controls: Count & Sort */}
            <div className="flex items-center justify-between border-b border-border pb-4">
              <p className="text-sm font-semibold text-muted-foreground">
                Showing <span className="text-foreground">{creatorList.length}</span>{" "}
                {creatorList.length === 1 ? "creator" : "creators"}
              </p>

              <div className="flex items-center gap-2">
                <ArrowUpDown className="size-4 text-muted-foreground" aria-hidden />
                <label htmlFor="creator-sort-dropdown" className="sr-only">
                  Sort creators
                </label>
                <select
                  id="creator-sort-dropdown"
                  value={creatorSortBy}
                  onChange={(e) =>
                    setCreatorSortBy(e.target.value as "followers" | "popular" | "name")
                  }
                  className="bg-card border border-border rounded-xl px-3 py-1.5 text-xs sm:text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="followers">Most followers</option>
                  <option value="popular">Most profile views</option>
                  <option value="name">Name (A–Z)</option>
                </select>
              </div>
            </div>

            {/* Creators Feed States */}
            {creatorsQuery.isLoading ? (
              <ListSkeleton tall rows={3} />
            ) : creatorsQuery.error ? (
              <ErrorState
                message={errMsg(creatorsQuery.error)}
                onRetry={() => creatorsQuery.refetch()}
              />
            ) : creatorList.length === 0 ? (
              <EmptyState
                title="No creators match your criteria"
                body="Try adjusting your niche, location, or audience size filters."
                action={
                  <Button variant="brand" onClick={clearCreatorFilters}>
                    Reset filters
                  </Button>
                }
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                {creatorList.map((c) => (
                  <CreatorCard key={c.id} c={c} />
                ))}
              </div>
            )}
          </section>
        </div>
      ) : (
        /* VIEW 2: EXPLORE EVENTS VIEW */
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Left Event Filter Panel */}
          <aside aria-label="Event filters" className="space-y-6">
            {/* Mobile Filter Chips */}
            <div className="lg:hidden space-y-3">
              <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
                <Chip active={eventScope === "upcoming"} onClick={() => setEventScope("upcoming")}>
                  Upcoming ({upcomingEvents.length})
                </Chip>
                <Chip active={eventScope === "past"} onClick={() => setEventScope("past")}>
                  Past Events ({pastEvents.length})
                </Chip>
              </div>
              <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
                {["All", ...EVENT_TYPES].map((t) => (
                  <Chip key={t} active={type === t} onClick={() => setType(t)}>
                    {t}
                  </Chip>
                ))}
              </div>
              {eventScope === "upcoming" && (
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
              )}
            </div>

            {/* Desktop Event Filter Panel */}
            <div className="hidden lg:block sticky top-24 space-y-6 rounded-3xl bg-card border border-border p-6 shadow-xs">
              <div className="flex items-center justify-between border-b border-border pb-4">
                <h2 className="font-display font-semibold text-lg flex items-center gap-2">
                  <SlidersHorizontal className="size-4 text-primary" aria-hidden />
                  Event Filters
                </h2>
                {(type !== "All" || when !== "any" || availOnly || q || eventScope !== "upcoming") && (
                  <button
                    type="button"
                    onClick={clearEventFilters}
                    className="text-xs font-semibold text-primary hover:underline"
                  >
                    Clear all
                  </button>
                )}
              </div>

              {/* Status Switcher (Upcoming vs Past) */}
              <div className="space-y-3">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Status
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setEventScope("upcoming")}
                    className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all text-center ${
                      eventScope === "upcoming"
                        ? "bg-foreground text-background shadow-xs"
                        : "bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Upcoming ({upcomingEvents.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setEventScope("past")}
                    className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all text-center ${
                      eventScope === "past"
                        ? "bg-foreground text-background shadow-xs"
                        : "bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Past ({pastEvents.length})
                  </button>
                </div>
              </div>

              {/* Event Type */}
              <div className="space-y-3 pt-2 border-t border-border">
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

              {/* Date Range (Upcoming only) */}
              {eventScope === "upcoming" && (
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
              )}

              {/* Location Pill & Available Seats */}
              <div className="space-y-3 pt-2 border-t border-border">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Preferences
                </label>
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-muted/60 text-sm font-medium">
                  <MapPin className="size-4 text-primary" aria-hidden />
                  <span>Pune, MH</span>
                </div>
                {eventScope === "upcoming" && (
                  <label className="flex items-center gap-2.5 px-3 py-2 text-sm font-medium text-foreground cursor-pointer hover:bg-muted rounded-xl transition-colors">
                    <input
                      type="checkbox"
                      checked={availOnly}
                      onChange={(e) => setAvailOnly(e.target.checked)}
                      className="size-4 rounded border-border text-primary focus:ring-primary"
                    />
                    <span>Seats available only</span>
                  </label>
                )}
              </div>
            </div>
          </aside>

          {/* Right Event Grid Area */}
          <section className="lg:col-span-3 space-y-6">
            {/* Header Controls: Count & Sort */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
              <div className="flex items-center gap-3">
                <div className="hidden sm:inline-flex rounded-xl bg-muted/70 p-1 border border-border">
                  <button
                    type="button"
                    onClick={() => setEventScope("upcoming")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      eventScope === "upcoming"
                        ? "bg-card text-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Upcoming ({upcomingEvents.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setEventScope("past")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      eventScope === "past"
                        ? "bg-card text-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Past Concluded ({pastEvents.length})
                  </button>
                </div>

                <p className="text-sm font-semibold text-muted-foreground">
                  Showing <span className="text-foreground">{eventList.length}</span>{" "}
                  {eventList.length === 1 ? "event" : "events"}
                </p>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto">
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
                  <option value="soonest">
                    {eventScope === "upcoming" ? "Soonest first" : "Most recent first"}
                  </option>
                  <option value="popular">Most booked</option>
                </select>
              </div>
            </div>

            {/* Feed States */}
            {eventsQuery.isLoading ? (
              <ListSkeleton tall rows={3} />
            ) : eventsQuery.error ? (
              <ErrorState message={errMsg(eventsQuery.error)} onRetry={() => eventsQuery.refetch()} />
            ) : eventScope === "upcoming" && upcomingEvents.length === 0 ? (
              <div className="rounded-3xl bg-card border border-border p-8 md:p-12 text-center shadow-xs space-y-6">
                <div className="mx-auto size-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shadow-xs">
                  <CalendarDays className="size-7" />
                </div>
                <div className="max-w-md mx-auto space-y-2">
                  <h3 className="font-display text-xl sm:text-2xl font-bold text-foreground">
                    No upcoming meetups scheduled right now
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Creators in Pune announce official meetups, workshops, and exclusive launches on a rolling basis. Follow creators in the directory to receive notifications when new tickets drop.
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                  <Button
                    variant="brand"
                    onClick={() => setActiveTab("creators")}
                    className="gap-2 rounded-2xl font-semibold shadow-brand px-5"
                  >
                    <Users className="size-4" /> Explore Creator Directory
                  </Button>

                  {pastEvents.length > 0 && (
                    <Button
                      variant="outline"
                      onClick={() => setEventScope("past")}
                      className="gap-2 rounded-2xl font-semibold px-5"
                    >
                      <Clock className="size-4 text-muted-foreground" /> Browse Past Events ({pastEvents.length})
                    </Button>
                  )}

                  {isCreator ? (
                    <Link to="/creator/events/create">
                      <Button variant="outline" className="gap-2 rounded-2xl font-semibold px-5">
                        <PlusCircle className="size-4 text-primary" /> Host an Event
                      </Button>
                    </Link>
                  ) : (
                    <Link to="/profile">
                      <Button
                        variant="ghost"
                        className="gap-2 rounded-2xl text-xs text-muted-foreground hover:text-foreground"
                      >
                        <Sparkles className="size-3.5 text-primary" /> Apply to become a creator
                      </Button>
                    </Link>
                  )}
                </div>
              </div>
            ) : eventList.length === 0 ? (
              <EmptyState
                title={
                  eventScope === "upcoming"
                    ? "No upcoming events match your filters"
                    : "No past events match your filters"
                }
                body="Try adjusting your search query, location, or selecting another category."
                action={
                  <Button variant="brand" onClick={clearEventFilters}>
                    Reset filters
                  </Button>
                }
              />
            ) : eventScope === "past" ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold font-display tracking-tight text-foreground flex items-center gap-2">
                    <Clock className="size-4 text-primary" /> Concluded Events & Meetups
                  </h2>
                  <span className="text-xs text-muted-foreground font-medium">
                    Archive of previously concluded official gatherings
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                  {eventList.map((e) => (
                    <EventCardLarge key={e.id} e={e} />
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-8">
                {/* Happening Soon Section */}
                {soonEvents.length > 0 && (
                  <div>
                    <h2 className="mb-4 text-xl font-bold font-display tracking-tight">
                      Happening soon
                    </h2>
                    {/* Mobile: Horizontal Snap Scroll, Desktop: 3-Column Card Grid */}
                    <div className="no-scrollbar -mx-4 flex snap-x gap-4 overflow-x-auto px-4 lg:mx-0 lg:px-0 lg:grid lg:grid-cols-3 lg:overflow-visible">
                      {soonEvents.map((e) => (
                        <div key={e.id} className="w-[82%] sm:w-[60%] lg:w-full shrink-0 snap-start">
                          <EventCardLarge e={e} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* More Events Grid */}
                {restEvents.length > 0 && (
                  <div>
                    <h2 className="mb-4 text-xl font-bold font-display tracking-tight">
                      More creator events
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                      {restEvents.map((e) => (
                        <EventCardLarge key={e.id} e={e} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
