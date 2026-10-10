import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Users, Search, Send, CalendarDays, MapPin, ChevronLeft, CheckSquare } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { EVENT_SELECT, errMsg, fmtDateTime, type EventWithCreator } from "@/lib/cc";
import { EmptyState, ErrorState, ListSkeleton, StatusTag } from "@/components/cc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/creator/events/$id/manage")({
  head: () => ({
    meta: [{ title: "Manage Event — CreatorConnect" }],
  }),
  component: ManageEventPage,
});

type AttendeeRegistration = {
  id: string;
  full_name: string;
  email: string;
  ticket_code: string;
  attendee_count: number;
  checked_in: boolean;
  created_at: string;
};

function ManageEventPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();

  const [searchQ, setSearchQ] = useState("");
  const [announcementText, setAnnouncementText] = useState("");
  const [publishingAnn, setPublishingAnn] = useState(false);

  // Fetch Event details
  const eventQuery = useQuery({
    queryKey: ["manage-event", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select(EVENT_SELECT)
        .eq("id", id)
        .single();
      if (error) throw error;
      return data as unknown as EventWithCreator;
    },
  });

  // Fetch Attendees / Registrations
  const attendeesQuery = useQuery({
    queryKey: ["event-attendees", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("registrations")
        .select("*")
        .eq("event_id", id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as AttendeeRegistration[];
    },
    enabled: !!id,
  });

  // Fetch Announcements
  const announcementsQuery = useQuery({
    queryKey: ["event-announcements", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("announcements")
        .select("*")
        .eq("event_id", id)
        .order("created_at", { ascending: false });
      if (error && error.code !== "PGRST116") throw error;
      return data ?? [];
    },
    enabled: !!id,
  });

  const toggleCheckIn = async (regId: string, current: boolean) => {
    try {
      const { error } = await supabase
        .from("registrations")
        .update({ checked_in: !current })
        .eq("id", regId);
      if (error) throw error;
      toast.success(current ? "Check-in undone" : "Attendee checked in!");
      qc.invalidateQueries({ queryKey: ["event-attendees", id] });
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  const handlePostAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!announcementText.trim()) return;

    setPublishingAnn(true);
    try {
      const { error } = await supabase.from("announcements").insert({
        event_id: id,
        body: announcementText.trim(),
      });
      if (error) throw error;
      toast.success("Organiser update sent to all registered guests!");
      setAnnouncementText("");
      qc.invalidateQueries({ queryKey: ["event-announcements", id] });
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setPublishingAnn(false);
    }
  };

  const ev = eventQuery.data;
  const attendees = (attendeesQuery.data ?? []).filter((a) => {
    const s = searchQ.trim().toLowerCase();
    return (
      !s ||
      a.full_name.toLowerCase().includes(s) ||
      a.ticket_code.toLowerCase().includes(s) ||
      a.email.toLowerCase().includes(s)
    );
  });

  const checkedInCount = (attendeesQuery.data ?? []).filter((a) => a.checked_in).length;

  return (
    <main className="px-4 py-5 md:px-6 md:py-8 pb-24 space-y-6">
      {/* Top Breadcrumb */}
      <div className="flex items-center justify-between border-b border-border pb-4">
        <Link
          to="/creator/events"
          className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="size-4" />
          Back to Events Table
        </Link>
        {ev && <StatusTag status={ev.status} />}
      </div>

      {/* Header with Stats Row */}
      {ev && (
        <div className="rounded-3xl bg-card border border-border p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h1 className="font-display text-2xl font-bold">{ev.title}</h1>
              <p className="text-xs text-muted-foreground flex items-center gap-3 mt-1">
                <span>
                  <CalendarDays className="inline size-3.5 text-primary" />{" "}
                  {fmtDateTime(ev.starts_at)}
                </span>
                <span>
                  <MapPin className="inline size-3.5 text-primary" /> {ev.venue}
                </span>
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-border">
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground uppercase font-semibold">
                Total Capacity
              </p>
              <p className="font-display text-xl font-bold">{ev.capacity} Seats</p>
            </div>
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground uppercase font-semibold">Registered</p>
              <p className="font-display text-xl font-bold text-primary">{ev.seats_taken} Guests</p>
            </div>
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground uppercase font-semibold">Checked In</p>
              <p className="font-display text-xl font-bold text-trust">
                {checkedInCount} Checked In
              </p>
            </div>
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground uppercase font-semibold">Remaining</p>
              <p className="font-display text-xl font-bold">
                {Math.max(0, ev.capacity - ev.seats_taken)} Seats
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Split View: Attendees Data Table (Left 65%) + Announcements Panel (Right 35%) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Attendees Data Table (lg:col-span-8) */}
        <div className="lg:col-span-8 space-y-4 rounded-3xl bg-card border border-border p-6 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="font-display font-semibold text-lg flex items-center gap-2">
                <Users className="size-4 text-primary" /> Registered Attendees
              </h2>
              <p className="text-xs text-muted-foreground">
                Scan QR codes or manually check in guests upon arrival.
              </p>
            </div>

            <div className="relative w-full sm:w-56">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                placeholder="Search name or ticket code..."
                className="h-9 pl-9 rounded-xl text-xs"
              />
            </div>
          </div>

          {attendeesQuery.isLoading ? (
            <ListSkeleton rows={3} />
          ) : attendeesQuery.error ? (
            <ErrorState
              message={errMsg(attendeesQuery.error)}
              onRetry={() => attendeesQuery.refetch()}
            />
          ) : attendees.length === 0 ? (
            <EmptyState
              title="No attendees found"
              body="No registrations match your search criteria."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border text-xs text-muted-foreground uppercase font-semibold">
                  <tr>
                    <th className="py-3 px-3">Check-in</th>
                    <th className="py-3 px-3">Guest Name</th>
                    <th className="py-3 px-3">Ticket Code</th>
                    <th className="py-3 px-3">Passes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {attendees.map((att) => (
                    <tr key={att.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-3">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={att.checked_in}
                            onChange={() => toggleCheckIn(att.id, att.checked_in)}
                            className="size-4 rounded border-border text-trust focus:ring-trust cursor-pointer"
                          />
                          <span
                            className={`text-xs font-semibold ${att.checked_in ? "text-trust" : "text-muted-foreground"}`}
                          >
                            {att.checked_in ? "Checked in" : "Pending"}
                          </span>
                        </label>
                      </td>
                      <td className="py-3 px-3">
                        <p className="font-semibold text-foreground">{att.full_name}</p>
                        <p className="text-xs text-muted-foreground">{att.email}</p>
                      </td>
                      <td className="py-3 px-3 font-mono text-xs font-bold text-primary">
                        {att.ticket_code}
                      </td>
                      <td className="py-3 px-3 text-xs font-semibold">{att.attendee_count} Pass</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Announcements Panel (lg:col-span-4) */}
        <div className="lg:col-span-4 space-y-6">
          <div className="rounded-3xl bg-card border border-border p-6 shadow-xs space-y-4">
            <h2 className="font-display font-semibold text-lg flex items-center gap-2">
              <CheckSquare className="size-4 text-primary" /> Post Update to Attendees
            </h2>
            <p className="text-xs text-muted-foreground">
              Send an instant notification announcement to all registered guests.
            </p>

            <form onSubmit={handlePostAnnouncement} className="space-y-3">
              <textarea
                value={announcementText}
                onChange={(e) => setAnnouncementText(e.target.value)}
                rows={3}
                placeholder="e.g. Venue doors open at 5:30 PM! Parking available at lot B."
                className="w-full rounded-2xl border border-input bg-background p-3 text-sm focus:ring-2 focus:ring-ring resize-none"
                required
              />
              <Button
                type="submit"
                variant="brand"
                className="w-full rounded-xl gap-2 text-xs font-semibold"
                disabled={publishingAnn}
              >
                <Send className="size-3.5" /> {publishingAnn ? "Sending..." : "Publish Update"}
              </Button>
            </form>
          </div>

          {/* Past Announcements Feed */}
          <div className="rounded-3xl bg-card border border-border p-6 shadow-xs space-y-3">
            <h3 className="font-semibold text-sm text-foreground">Past Updates</h3>
            {(announcementsQuery.data ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground">No updates posted yet.</p>
            ) : (
              <div className="space-y-3">
                {announcementsQuery.data?.map((ann) => (
                  <div
                    key={ann.id}
                    className="rounded-2xl bg-muted/40 p-3 border border-border text-xs space-y-1"
                  >
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(ann.created_at).toLocaleString("en-IN", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                    <p className="text-foreground font-medium">{ann.body}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
