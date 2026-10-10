import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { EVENT_SELECT, errMsg, fmtDateTime, type EventWithCreator } from "@/lib/cc";
import { CreatorName, ErrorState, EventCover, ListSkeleton, OfficialSeal, PageHeader, SeatsBar } from "@/components/cc";

export const Route = createFileRoute("/_authenticated/events/$id")({
  head: () => ({
    meta: [
      { title: "Event details — CreatorConnect" },
      { name: "description", content: "See date, venue, seats left and organiser updates." },
      { property: "og:title", content: "Event details — CreatorConnect" },
      { property: "og:description", content: "See date, venue, seats left and organiser updates." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: EventPage,
});

function EventPage() {
  const { id } = Route.useParams();
  const q = useQuery({
    queryKey: ["event", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("events").select(EVENT_SELECT).eq("id", id).single();
      if (error) throw error;
      return data as unknown as EventWithCreator;
    },
  });
  const e = q.data;
  return (
    <main className="pb-24">
      <PageHeader title={e?.title ?? "Event"} back />
      {q.isLoading ? <div className="p-4"><ListSkeleton rows={2} tall /></div> : q.error || !e ? <div className="p-4"><ErrorState message={errMsg(q.error)} /></div> : (
        <div className="space-y-4 px-4">
          <div className="relative aspect-[5/3] overflow-hidden rounded-3xl"><EventCover id={e.id} src={e.cover_url} alt="" className="absolute inset-0 h-full w-full" /></div>
          {e.status === "live" && <OfficialSeal />}
          <h2 className="text-2xl font-bold">{e.title}</h2>
          <p className="text-muted-foreground"><CreatorName c={e.creator} /></p>
          <p>{fmtDateTime(e.starts_at)} · {e.venue}</p>
          <SeatsBar taken={e.seats_taken} capacity={e.capacity} />
          <p className="text-sm leading-relaxed">{e.description}</p>
        </div>
      )}
    </main>
  );
}
