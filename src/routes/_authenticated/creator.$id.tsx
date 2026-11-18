import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  UserPlus,
  UserCheck,
  MapPin,
  Users,
  Calendar,
  ShieldCheck,
  CheckCircle2,
  ExternalLink,
  Mail,
  Phone,
  BadgeCheck,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  EVENT_SELECT,
  VERIFIABLE_FIELDS,
  errMsg,
  fmtCount,
  type Creator,
  type EventWithCreator,
} from "@/lib/cc";
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
                    {c.verified && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-trust-soft px-2.5 py-0.5 text-xs font-bold text-trust">
                        <BadgeCheck className="size-3.5" /> Verified
                      </span>
                    )}
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
              <div className="px-6 pb-4 pt-2 border-t border-border/60">
                <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">{c.bio}</p>
              </div>
            )}

            {/* Contact & Portfolio Links Bar */}
            {(c.portfolio_links?.length > 0 || c.contact_email || c.contact_phone) && (
              <div className="px-6 py-3 border-t border-border/60 bg-muted/20 flex flex-wrap items-center gap-3 text-xs">
                {c.contact_email && (
                  <a
                    href={`mailto:${c.contact_email}`}
                    className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors font-medium"
                  >
                    <Mail className="size-3.5 text-primary" /> {c.contact_email}
                  </a>
                )}
                {c.contact_phone && (
                  <span className="inline-flex items-center gap-1.5 text-muted-foreground font-medium">
                    <Phone className="size-3.5 text-primary" /> {c.contact_phone}
                  </span>
                )}
                {(c.portfolio_links ?? []).map((link, idx) => (
                  <a
                    key={idx}
                    href={link}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-primary hover:underline font-semibold"
                  >
                    <ExternalLink className="size-3" />
                    {link.replace(/^https?:\/\/(www\.)?/, "").slice(0, 28)}
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Per-Field Verification Status & Trust Badges */}
          <div className="rounded-3xl bg-card border border-border p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-border pb-4">
              <div>
                <h2 className="font-display font-bold text-lg text-foreground flex items-center gap-2">
                  <ShieldCheck className="size-5 text-primary" />
                  Profile Verification & Trust Badges
                </h2>
                <p className="text-xs text-muted-foreground">
                  Individual profile credentials confirmed by CreatorConnect moderation against official documentation.
                </p>
              </div>

              {c.verified ? (
                <span className="self-start sm:self-auto inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-trust-soft text-trust font-bold text-xs">
                  <BadgeCheck className="size-4" /> Official Verified Creator
                </span>
              ) : (
                <span className="self-start sm:self-auto inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted text-muted-foreground font-semibold text-xs">
                  Community Creator (Pending Full Verification)
                </span>
              )}
            </div>

            {/* Verification Badges Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {VERIFIABLE_FIELDS.map((vf) => {
                const isVerified = (c.verified_fields ?? []).includes(vf.key);
                return (
                  <div
                    key={vf.key}
                    className={`rounded-2xl p-4 border transition-all space-y-1.5 ${
                      isVerified
                        ? "bg-trust-soft/20 border-trust/40"
                        : "bg-muted/30 border-border/60"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                        {vf.label}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          isVerified
                            ? "bg-trust-soft text-trust"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {isVerified ? (
                          <>
                            <CheckCircle2 className="size-3 text-trust" /> Confirmed
                          </>
                        ) : (
                          "Self-reported"
                        )}
                      </span>
                    </div>

                    <p className="text-[11px] text-muted-foreground leading-snug">
                      {vf.criteria}
                    </p>

                    <div className="text-[11px] font-semibold text-foreground pt-1.5 border-t border-border/40 truncate">
                      {vf.key === "name" && c.display_name}
                      {vf.key === "niche" && `${c.category} creator`}
                      {vf.key === "audience" && `${fmtCount(c.audience_size)} followers`}
                      {vf.key === "location" && (c.location || "Pune, India")}
                      {vf.key === "portfolio" &&
                        (c.portfolio_links?.length
                          ? `${c.portfolio_links.length} portfolio link(s)`
                          : "No portfolio links")}
                      {vf.key === "contact" &&
                        (c.contact_email || c.contact_phone || "Contact pending")}
                    </div>
                  </div>
                );
              })}
            </div>
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
