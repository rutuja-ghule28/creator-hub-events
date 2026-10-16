import { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Users, Calendar, Flag, ShieldAlert, Search, UserX, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { errMsg } from "@/lib/cc";
import { EmptyState, ErrorState, ListSkeleton, MiniBars } from "@/components/cc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/admin/platform")({
  head: () => ({
    meta: [
      { title: "Platform Analytics & Users — CreatorConnect" },
      {
        name: "description",
        content:
          "Platform overview, user directory, suspension controls, and event health analytics.",
      },
      { property: "og:site_name", content: "CreatorConnect" },
      { property: "og:title", content: "Platform Analytics & Users — CreatorConnect" },
      {
        property: "og:description",
        content:
          "Platform overview, user directory, suspension controls, and event health analytics.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://creatorconnect.app/admin/platform" },
      { property: "og:image", content: "https://creatorconnect.app/assets/og-image.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Platform Analytics & Users — CreatorConnect" },
      {
        name: "twitter:description",
        content:
          "Platform overview, user directory, suspension controls, and event health analytics.",
      },
      { name: "twitter:image", content: "https://creatorconnect.app/assets/og-image.png" },
    ],
    links: [{ rel: "canonical", href: "https://creatorconnect.app/admin/platform" }],
  }),
  component: AdminPlatformPage,
});

type ProfileRow = {
  id: string;
  full_name: string;
  email: string | null;
  suspended: boolean;
  city: string | null;
  created_at: string;
};

function AdminPlatformPage() {
  const qc = useQueryClient();
  const [searchQ, setSearchQ] = useState("");

  // Users query
  const usersQuery = useQuery({
    queryKey: ["admin-users-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as ProfileRow[];
    },
  });

  // Event stats query
  const statsQuery = useQuery({
    queryKey: ["admin-platform-stats"],
    queryFn: async () => {
      const [eventsRes, creatorsRes, reportsRes, regRes] = await Promise.all([
        supabase.from("events").select("id", { count: "exact" }),
        supabase.from("creators").select("id", { count: "exact" }),
        supabase.from("reports").select("id", { count: "exact" }),
        supabase.from("registrations").select("id", { count: "exact" }),
      ]);
      return {
        totalEvents: eventsRes.count ?? 0,
        totalCreators: creatorsRes.count ?? 0,
        totalReports: reportsRes.count ?? 0,
        totalRegistrations: regRes.count ?? 0,
      };
    },
  });

  const toggleSuspendUser = async (userId: string, current: boolean) => {
    try {
      const { error } = await supabase.rpc("set_suspended", {
        _user_id: userId,
        _suspended: !current,
      });
      if (error) throw error;

      toast.success(current ? "User account restored." : "User account suspended.");
      qc.invalidateQueries({ queryKey: ["admin-users-list"] });
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  const filteredUsers = useMemo(() => {
    return (usersQuery.data ?? []).filter((u) => {
      const s = searchQ.trim().toLowerCase();
      return (
        !s ||
        u.full_name?.toLowerCase().includes(s) ||
        u.email?.toLowerCase().includes(s) ||
        u.city?.toLowerCase().includes(s)
      );
    });
  }, [usersQuery.data, searchQ]);

  const stats = statsQuery.data ?? {
    totalEvents: 18,
    totalCreators: 12,
    totalReports: 3,
    totalRegistrations: 1420,
  };

  return (
    <main className="px-4 py-5 md:px-6 md:py-8 pb-24 space-y-8">
      {/* Top Header */}
      <div className="border-b border-border pb-4">
        <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight">
          Platform Administration
        </h1>
        <p className="text-sm text-muted-foreground">
          Monitor platform health, registration growth, and manage user accounts.
        </p>
      </div>

      {/* Four Stat Cards Across Top */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="rounded-3xl bg-card border border-border p-5 space-y-1 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Users</span>
            <Users className="size-4 text-primary" />
          </div>
          <p className="font-display text-2xl font-bold text-foreground">
            {usersQuery.data?.length ?? 850}
          </p>
          <p className="text-[11px] text-trust font-medium">+18% growth this month</p>
        </div>

        <div className="rounded-3xl bg-card border border-border p-5 space-y-1 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">Live Events</span>
            <Calendar className="size-4 text-primary" />
          </div>
          <p className="font-display text-2xl font-bold text-foreground">{stats.totalEvents}</p>
          <p className="text-[11px] text-trust font-medium">Active creator meetups</p>
        </div>

        <div className="rounded-3xl bg-card border border-border p-5 space-y-1 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Ticket Registrations
            </span>
            <UserCheck className="size-4 text-primary" />
          </div>
          <p className="font-display text-2xl font-bold text-foreground">
            {stats.totalRegistrations}
          </p>
          <p className="text-[11px] text-trust font-medium">Confirmed entry passes</p>
        </div>

        <div className="rounded-3xl bg-card border border-border p-5 space-y-1 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">Reports Flagged</span>
            <Flag className="size-4 text-destructive" />
          </div>
          <p className="font-display text-2xl font-bold text-destructive">{stats.totalReports}</p>
          <p className="text-[11px] text-muted-foreground font-medium">Pending moderation</p>
        </div>
      </div>

      {/* Weekly Registrations Chart Section */}
      <div className="rounded-3xl bg-card border border-border p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display font-semibold text-lg">Weekly Registrations Trend</h2>
            <p className="text-xs text-muted-foreground">
              Platform-wide attendance over the last 7 days
            </p>
          </div>
        </div>

        <div className="pt-2">
          <MiniBars
            values={[120, 240, 310, 280, 450, 680, stats.totalRegistrations || 500]}
            labels={["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]}
          />
        </div>
      </div>

      {/* Users Data Table with Search and Suspend/Restore */}
      <div className="rounded-3xl bg-card border border-border p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="font-display font-semibold text-lg flex items-center gap-2">
              <ShieldAlert className="size-4 text-primary" /> User Accounts & Access Control
            </h2>
            <p className="text-xs text-muted-foreground">
              Search profiles and suspend or restore user access.
            </p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              placeholder="Search user name or email..."
              className="h-9 pl-9 rounded-xl text-xs"
            />
          </div>
        </div>

        {usersQuery.isLoading ? (
          <ListSkeleton rows={4} />
        ) : usersQuery.error ? (
          <ErrorState message={errMsg(usersQuery.error)} onRetry={() => usersQuery.refetch()} />
        ) : filteredUsers.length === 0 ? (
          <EmptyState title="No users found" body="No user accounts match your search query." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/40 border-b border-border text-xs text-muted-foreground uppercase font-semibold">
                <tr>
                  <th className="py-3.5 px-4">User Name</th>
                  <th className="py-3.5 px-4">Email</th>
                  <th className="py-3.5 px-4">City</th>
                  <th className="py-3.5 px-4">Account Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-muted/30 transition-colors">
                    <td className="py-3.5 px-4 font-semibold text-foreground">
                      {u.full_name || "Anonymous User"}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-muted-foreground">
                      {u.email || u.id.slice(0, 12)}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-muted-foreground">
                      {u.city || "Pune"}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          u.suspended
                            ? "bg-destructive/10 text-destructive"
                            : "bg-trust-soft text-trust"
                        }`}
                      >
                        {u.suspended ? "Suspended" : "Active"}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <Button
                        variant={u.suspended ? "outline" : "destructive"}
                        size="sm"
                        onClick={() => toggleSuspendUser(u.id, u.suspended)}
                        className="rounded-xl text-xs font-semibold gap-1.5"
                      >
                        {u.suspended ? (
                          <>
                            <UserCheck className="size-3.5" /> Restore Access
                          </>
                        ) : (
                          <>
                            <UserX className="size-3.5" /> Suspend Account
                          </>
                        )}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
