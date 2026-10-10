import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/cc";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw redirect({ to: "/auth", search: { redirect: location.href } });
  },
  component: AuthedLayout,
});

function AuthedLayout() {
  const { data: me } = useMe();
  const qc = useQueryClient();

  useEffect(() => {
    if (!me?.id) return;
    const ch = supabase
      .channel(`notif-${me.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${me.id}` }, (payload) => {
        qc.invalidateQueries({ queryKey: ["notifications"] });
        const n = payload.new as { title?: string };
        if (n.title) toast(n.title);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [me?.id, qc]);

  if (me?.profile?.suspended) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-2xl font-bold">Your account is suspended</h1>
        <p className="text-muted-foreground">An admin paused this account. Contact support to restore access.</p>
        <Button variant="outline" onClick={() => supabase.auth.signOut().then(() => (window.location.href = "/auth"))}>Sign out</Button>
      </main>
    );
  }
  return <Outlet />;
}
