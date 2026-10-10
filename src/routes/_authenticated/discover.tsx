import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { MapPin, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { EVENT_SELECT, EVENT_TYPES, errMsg, type EventWithCreator } from "@/lib/cc";
import { Chip, EmptyState, ErrorState, EventCardLarge, EventRowCompact, ListSkeleton } from "@/components/cc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/discover")({
  head: () => ({
    meta: [
      { title: "Discover creator events — CreatorConnect" },
      { name: "description", content: "Find official creator meetups, workshops and launches in Pune." },
      { property: "og:title", content: "Discover creator events — CreatorConnect" },
      { property: "og:description", content: "Find official creator meetups, workshops and launches in Pune." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Discover,
});

function Discover() {
  const [q, setQ] = useState("");
  const [type, setType] = useState<string>("All");
  const [when, setWhen] = useState<"any" | "this" | "next">("any");
  const query = useQuery({
    queryKey: ["events", "live"],
    queryFn: async () => {
      const { data, error } = await supabase.from("events").select(EVENT_SELECT).eq("status", "live").gte("starts_at", new Date().toISOString()).order("starts_at");
      if (error) throw error;
      return data as unknown as EventWithCreator[];
    },
  });
  const list = useMemo(() => {
    const now = new Date();
    return (query.data ?? []).filter((e) => {
      const d = new Date(e.starts_at);
      const m = (d.getFullYear() - now.getFullYear()) * 12 + d.getMonth() - now.getMonth();
      if (when === "this" && m !== 0) return false;
      if (when === "next" && m !== 1) return false;
      if (type !== "All" && e.type !== type) return false;
      const s = q.trim().toLowerCase();
      return !s || [e.title, e.venue, e.area, e.creator?.display_name].some((x) => x?.toLowerCase().includes(s));
    });
  }, [query.data, q, type, when]);
  const soon = list.slice(0, 3);
  const rest = list.slice(3);
  const clear = () => { setQ(""); setType("All"); setWhen("any"); };

  return (
    <main className="space-y-5 px-4 pb-24 pt-5">
      <span className="inline-flex min-h-9 items-center gap-1 rounded-full bg-card px-3 text-sm font-semibold ring-1 ring-border"><MapPin className="size-4 text-primary" />Pune</span>
      <h1 className="text-[28px] font-bold leading-tight">Meet your favourite creators, in person.</h1>
      <label className="relative block">
        <span className="sr-only">Search events</span>
        <Search className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search events, creators, venues" className="h-12 rounded-2xl bg-card pl-11" />
      </label>
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
        {["All", ...EVENT_TYPES].map((t) => <Chip key={t} active={type === t} onClick={() => setType(t)}>{t}</Chip>)}
      </div>
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
        {([["any", "Any date"], ["this", "This month"], ["next", "Next month"]] as const).map(([k, l]) => <Chip key={k} active={when === k} onClick={() => setWhen(k)}>{l}</Chip>)}
      </div>
      {query.isLoading ? <ListSkeleton tall rows={2} /> : query.error ? <ErrorState message={errMsg(query.error)} onRetry={() => query.refetch()} /> : list.length === 0 ? (
        <EmptyState title="No events match" body="Try another type or date, or clear your filters." action={<Button variant="brand" onClick={clear}>Clear filters</Button>} />
      ) : (
        <>
          <section>
            <h2 className="mb-3 text-lg font-semibold">Happening soon</h2>
            <div className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4">{soon.map((e) => <EventCardLarge key={e.id} e={e} />)}</div>
          </section>
          {rest.length > 0 && <section className="space-y-2.5"><h2 className="text-lg font-semibold">More events</h2>{rest.map((e) => <EventRowCompact key={e.id} e={e} />)}</section>}
        </>
      )}
    </main>
  );
}
