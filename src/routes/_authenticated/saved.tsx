import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bookmark, Compass } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { EVENT_SELECT, type EventWithCreator } from "@/lib/cc";
import { EmptyState, EventRowCompact, ListSkeleton, PageHeader } from "@/components/cc";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/saved")({
  head: () => ({
    meta: [
      { title: "Saved Events & Bookmarks — CreatorConnect" },
      {
        name: "description",
        content:
          "Quickly access and register for the creator meetups and workshops you bookmarked.",
      },
      { property: "og:site_name", content: "CreatorConnect" },
      { property: "og:title", content: "Saved Events & Bookmarks — CreatorConnect" },
      {
        property: "og:description",
        content:
          "Quickly access and register for the creator meetups and workshops you bookmarked.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://creatorconnect.app/saved" },
      { property: "og:image", content: "https://creatorconnect.app/assets/og-image.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Saved Events & Bookmarks — CreatorConnect" },
      {
        name: "twitter:description",
        content:
          "Quickly access and register for the creator meetups and workshops you bookmarked.",
      },
      { name: "twitter:image", content: "https://creatorconnect.app/assets/og-image.png" },
    ],
    links: [{ rel: "canonical", href: "https://creatorconnect.app/saved" }],
  }),
  component: SavedEventsPage,
});

function SavedEventsPage() {
  const query = useQuery({
    queryKey: ["saved-events"],
    queryFn: async () => {
      // Fetch upcoming live events that attendee can register for
      const { data, error } = await supabase
        .from("events")
        .select(EVENT_SELECT)
        .eq("status", "live")
        .gte("starts_at", new Date().toISOString())
        .order("starts_at")
        .limit(10);

      if (error) throw error;
      return data as unknown as EventWithCreator[];
    },
  });

  return (
    <main className="min-h-screen px-4 py-5 md:px-6 md:py-8 pb-24">
      <div className="md:hidden">
        <PageHeader title="Saved Events" />
      </div>

      <div className="mb-6 hidden md:block">
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
          Saved Events
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Events and workshops you have bookmarked for quick registration.
        </p>
      </div>

      {query.isLoading ? (
        <ListSkeleton rows={4} />
      ) : query.data && query.data.length > 0 ? (
        <section aria-label="Bookmarked events list" className="space-y-3">
          {query.data.map((event) => (
            <EventRowCompact key={event.id} e={event} />
          ))}
        </section>
      ) : (
        <EmptyState
          title="No saved events yet"
          body="Explore upcoming creator meetups and tap the bookmark icon to save them for later."
          action={
            <Button asChild variant="brand">
              <Link to="/discover">
                <Compass className="mr-2 size-4" /> Discover Events
              </Link>
            </Button>
          }
        />
      )}
    </main>
  );
}
