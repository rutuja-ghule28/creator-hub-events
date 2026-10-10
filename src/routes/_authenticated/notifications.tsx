import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck, Sparkles, Calendar, Info } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { errMsg, fmtAgo, useMe, type Notification } from "@/lib/cc";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/cc";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({
    meta: [{ title: "Notifications — CreatorConnect" }],
  }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const { data: me } = useMe();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["notifications", me?.id],
    queryFn: async () => {
      if (!me?.id) return [];
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", me.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Notification[];
    },
    enabled: !!me?.id,
  });

  const markAllRead = async () => {
    if (!me?.id) return;
    try {
      await supabase.from("notifications").update({ read: true }).eq("user_id", me.id);
      toast.success("All notifications marked as read");
      qc.invalidateQueries({ queryKey: ["notifications"] });
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  return (
    <main className="px-4 py-5 md:px-6 md:py-8 pb-24">
      {/* Centered Column (max 720px) */}
      <div className="max-w-[720px] mx-auto space-y-6">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight">
              Notifications
            </h1>
            <p className="text-sm text-muted-foreground">
              Updates on registered events, creator posts and reviews.
            </p>
          </div>
          {(query.data ?? []).some((n) => !n.read) && (
            <Button
              variant="outline"
              size="sm"
              onClick={markAllRead}
              className="gap-1.5 rounded-xl text-xs font-semibold"
            >
              <CheckCheck className="size-4 text-primary" /> Mark all as read
            </Button>
          )}
        </div>

        {query.isLoading ? (
          <ListSkeleton rows={4} />
        ) : query.error ? (
          <ErrorState message={errMsg(query.error)} onRetry={() => query.refetch()} />
        ) : (query.data ?? []).length === 0 ? (
          <EmptyState
            title="No notifications yet"
            body="When creators post updates or review status changes, alerts will show up here."
          />
        ) : (
          <div className="space-y-3">
            {query.data?.map((n) => (
              <div
                key={n.id}
                className={`rounded-2xl border p-4 transition-all flex items-start gap-4 ${
                  n.read
                    ? "bg-card/60 border-border"
                    : "bg-card border-primary/40 shadow-xs ring-1 ring-primary/20"
                }`}
              >
                <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-2xl bg-brand/10 text-primary mt-0.5">
                  {n.kind === "event" ? (
                    <Calendar className="size-5" />
                  ) : (
                    <Sparkles className="size-5" />
                  )}
                </span>
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-semibold text-sm text-foreground">{n.title}</h3>
                    <span className="text-[11px] text-muted-foreground shrink-0">
                      {fmtAgo(n.created_at)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{n.body}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
