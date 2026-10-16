import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { UserPlus, UserCheck, MapPin, Users, Calendar } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { EVENT_SELECT, errMsg, fmtCount, type Creator, type EventWithCreator } from "@/lib/cc";
import {
  Avatar,
  CreatorName,
  EmptyState,
  ErrorState,
  EventCardLarge,
  ListSkeleton,
} from "@/components/cc";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/creator/$id")({
  head: ({ params }) => ({
    meta: [
      { title: "Creator Profile & Events — CreatorConnect" },
      {
        name: "description",
        content:
          "Discover creator bio, upcoming official meetups, community events, and verified details.",
      },
      { property: "og:site_name", content: "CreatorConnect" },
      { property: "og:title", content: "Creator Profile & Events — CreatorConnect" },
      {
        property: "og:description",
        content:
          "Discover creator bio, upcoming official meetups, community events, and verified details.",
      },
      { property: "og:type", content: "profile" },
      { property: "og:url", content: `https://creatorconnect.app/creator/${params.id}` },
      { property: "og:image", content: "https://creatorconnect.app/assets/og-image.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Creator Profile & Events — CreatorConnect" },
      {
        name: "twitter:description",
        content:
          "Discover creator bio, upcoming official meetups, community events, and verified details.",
      },
      { name: "twitter:image", content: "https://creatorconnect.app/assets/og-image.png" },
    ],
    links: [{ rel: "canonical", href: `https://creatorconnect.app/creator/${params.id}` }],
  }),
  component: CreatorProfilePage,
});

function CreatorProfilePage() {
  const { id } = Route.useParams();
  const [following, setFollowing] = useState(false);

  const creatorQuery = useQuery({
    queryKey: ["creator-profile", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("creators").select("*").eq("id", id).single();
      if (error) throw error;
      return data as Creator;
    },
  });

  const eventsQuery = useQuery({
    queryKey: ["creator-public-events", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select(EVENT_SELECT)
        .eq("creator_id", id)
        .eq("status", "live")
        .order("starts_at", { ascending: true });
      if (error) throw error;
      return data as unknown as EventWithCreator[];
    },
    enabled: !!id,
  });

  const c = creatorQuery.data;

  return (
    <main className="px-4 py-5 md:px-6 md:py-8 pb-24 space-y-8">
      {creatorQuery.isLoading ? (
        <ListSkeleton rows={3} tall />
      ) : creatorQuery.error || !c ? (
        <ErrorState message={errMsg(creatorQuery.error)} onRetry={() => creatorQuery.refetch()} />
      ) : (
        <>
          {/* Creator Profile Hero Banner Header */}
          <div className="rounded-3xl bg-card border border-border overflow-hidden shadow-xs">
            {/* Banner Background */}
            <div className="h-44 sm:h-56 bg-gradient-to-r from-brand via-primary to-purple-600 relative p-6 flex items-end">
              <span className="absolute top-4 right-4 bg-black/20 backdrop-blur-md text-white text-xs font-semibold px-3 py-1 rounded-full border border-white/20">
                {c.category} Creator
              </span>
            </div>

            {/* Profile Detail Row */}
            <div className="p-6 pt-0 relative flex flex-col sm:flex-row sm:items-end justify-between gap-6 -mt-12 sm:-mt-16">
              <div className="flex flex-col sm:flex-row sm:items-end gap-4">
                <div className="ring-4 ring-card rounded-full overflow-hidden shrink-0 shadow-lg bg-card">
                  <Avatar name={c.display_name} src={c.avatar_url} size={96} />
                </div>

                <div className="space-y-1">
                  <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
                    <CreatorName c={c} />
                  </h1>
                  <p className="text-xs sm:text-sm text-muted-foreground flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <MapPin className="size-3.5 text-primary" /> {c.location || "Pune, India"}
                    </span>
                    <span className="flex items-center gap-1 font-semibold text-foreground">
                      <Users className="size-3.5 text-primary" />{" "}
                      {fmtCount(c.audience_size || 1200)} followers
                    </span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Button
                  variant={following ? "outline" : "brand"}
                  size="lg"
                  className="rounded-2xl font-semibold gap-2 shadow-brand"
                  onClick={() => {
                    setFollowing(!following);
                    toast.success(
                      following ? `Unfollowed ${c.display_name}` : `Following ${c.display_name}!`,
                    );
                  }}
                >
                  {following ? (
                    <UserCheck className="size-4 text-trust" />
                  ) : (
                    <UserPlus className="size-4" />
                  )}
                  <span>{following ? "Following" : "Follow Creator"}</span>
                </Button>
              </div>
            </div>

            {/* Bio Section */}
            {c.bio && (
              <div className="px-6 pb-6 pt-2 border-t border-border/60">
                <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">{c.bio}</p>
              </div>
            )}
          </div>

          {/* Creator Events Grid */}
          <div className="space-y-4">
            <h2 className="font-display font-bold text-xl flex items-center gap-2">
              <Calendar className="size-5 text-primary" /> Upcoming Events by {c.display_name}
            </h2>

            {eventsQuery.isLoading ? (
              <ListSkeleton rows={2} tall />
            ) : eventsQuery.error ? (
              <ErrorState
                message={errMsg(eventsQuery.error)}
                onRetry={() => eventsQuery.refetch()}
              />
            ) : (eventsQuery.data ?? []).length === 0 ? (
              <EmptyState
                title="No active events"
                body="This creator has no upcoming events scheduled at the moment."
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {eventsQuery.data?.map((e) => (
                  <EventCardLarge key={e.id} e={e} />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </main>
  );
}
