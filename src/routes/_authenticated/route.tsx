import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/cc";
import { Button } from "@/components/ui/button";

import { Compass, Ticket, Bookmark, Bell, User } from "lucide-react";
import { DesktopHeader, DesktopSidebar, TabBar } from "@/components/cc";

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
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${me.id}`,
        },
        (payload) => {
          qc.invalidateQueries({ queryKey: ["notifications"] });
          const n = payload.new as { title?: string };
          if (n.title) toast(n.title);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [me?.id, qc]);

  if (me?.profile?.suspended) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-2xl font-bold">Your account is suspended</h1>
        <p className="text-muted-foreground">
          An admin paused this account. Contact support to restore access.
        </p>
        <Button
          variant="outline"
          onClick={() => supabase.auth.signOut().then(() => (window.location.href = "/auth"))}
        >
          Sign out
        </Button>
      </main>
    );
  }

  const mobileTabs = [
    { to: "/discover", label: "Discover", icon: Compass, exact: true },
    { to: "/tickets", label: "Tickets", icon: Ticket },
    { to: "/saved", label: "Saved", icon: Bookmark },
    { to: "/notifications", label: "Notifs", icon: Bell },
    { to: "/profile", label: "Profile", icon: User },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Sidebar for Desktop / Tablet */}
      <DesktopSidebar me={me} />

      {/* Main Content Area */}
      <div className="flex flex-col min-h-screen md:pl-16 lg:pl-64 transition-all duration-200">
        <DesktopHeader me={me} />
        <div className="flex-1 w-full max-w-7xl mx-auto px-0 md:px-6 lg:px-8 py-0 md:py-6">
          <Outlet />
        </div>
      </div>

      {/* Bottom Tab Bar for Mobile (< 768px) */}
      <TabBar tabs={mobileTabs} />
    </div>
  );
}
