import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Users,
  Search,
  Send,
  CalendarDays,
  MapPin,
  ChevronLeft,
  CheckSquare,
  Sparkles,
  Megaphone,
  Check,
  X,
  ExternalLink,
  BadgeCheck,
  Clock,
  UserCheck,
  BarChart3,
  FileSpreadsheet,
  Printer,
  CheckCircle2,
  AlertCircle,
  FileText,
  Loader2,
  TrendingUp,
  Target,
  ChevronDown,
  ChevronUp,
  Copy,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { rankCreatorsForEvent, type CreatorMatchResult } from "@/lib/matching";
import {
  EVENT_SELECT,
  errMsg,
  fmtAgo,
  fmtCount,
  fmtDateTime,
  useMe,
  type Creator,
  type EventWithCreator,
} from "@/lib/cc";
import { Avatar, EmptyState, ErrorState, ListSkeleton, StatusTag } from "@/components/cc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/creator/events/$id/manage")({
  head: ({ params }) => ({
    meta: [
      { title: "Event Attendee Management — CreatorConnect" },
      {
        name: "description",
        content:
          "Scan QR passes, verify attendee check-ins, and broadcast announcements for your event.",
      },
      { property: "og:site_name", content: "CreatorConnect" },
      { property: "og:title", content: "Event Attendee Management — CreatorConnect" },
      {
        property: "og:description",
        content:
          "Scan QR passes, verify attendee check-ins, and broadcast announcements for your event.",
      },
      { property: "og:type", content: "website" },
      {
        property: "og:url",
        content: `https://creatorconnect.app/creator/events/${params.id}/manage`,
      },
      { property: "og:image", content: "https://creatorconnect.app/assets/og-image.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Event Attendee Management — CreatorConnect" },
      {
        name: "twitter:description",
        content:
          "Scan QR passes, verify attendee check-ins, and broadcast announcements for your event.",
      },
      { name: "twitter:image", content: "https://creatorconnect.app/assets/og-image.png" },
    ],
    links: [
      { rel: "canonical", href: `https://creatorconnect.app/creator/events/${params.id}/manage` },
    ],
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

type CampaignReport = {
  id: string;
  application_id: string;
  reach: number;
  engagement: number;
  deliverable_status: "not_started" | "in_progress" | "delivered";
  notes: string | null;
  updated_at: string;
};

type CampaignApplicationWithCreator = {
  id: string;
  event_id: string;
  creator_id: string;
  pitch: string;
  status: "pending" | "accepted" | "rejected";
  created_at: string;
  creator: Creator | null;
  report: CampaignReport | null;
};

function ManageEventPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const { data: me } = useMe();

  const [activeTab, setActiveTab] = useState<"attendees" | "applications" | "reports">("attendees");
  const [appFilter, setAppFilter] = useState<"all" | "pending" | "accepted" | "rejected">("all");

  const [searchQ, setSearchQ] = useState("");
  const [announcementText, setAnnouncementText] = useState("");
  const [publishingAnn, setPublishingAnn] = useState(false);
  const [processingAppId, setProcessingAppId] = useState<string | null>(null);

  // Campaign Report modal state
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [selectedAppForReport, setSelectedAppForReport] = useState<CampaignApplicationWithCreator | null>(null);
  const [reportReach, setReportReach] = useState("");
  const [reportEngagement, setReportEngagement] = useState("");
  const [reportDeliverableStatus, setReportDeliverableStatus] = useState<"not_started" | "in_progress" | "delivered">("delivered");
  const [reportNotes, setReportNotes] = useState("");
  const [savingReport, setSavingReport] = useState(false);

  // AI Matching Engine State
  const [matchModalOpen, setMatchModalOpen] = useState(false);
  const [matchingLoading, setMatchingLoading] = useState(false);
  const [recommendedMatches, setRecommendedMatches] = useState<CreatorMatchResult[]>([]);
  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null);

  const handleOpenMatchModal = async () => {
    if (!eventQuery.data) return;
    setMatchModalOpen(true);
    setMatchingLoading(true);

    try {
      const { data: allCreators, error } = await supabase
        .from("creators")
        .select("*")
        .order("audience_size", { ascending: false });

      if (error) throw error;

      const ranked = rankCreatorsForEvent(eventQuery.data, (allCreators ?? []) as Creator[], 5);
      setRecommendedMatches(ranked);
      if (ranked.length > 0) {
        setExpandedMatchId(ranked[0].creator.id);
      }
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setMatchingLoading(false);
    }
  };

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

  // Fetch Campaign Applications with applicant Creator profile and Campaign Report
  const applicationsQuery = useQuery({
    queryKey: ["event-campaign-applications", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaign_applications")
        .select("*, creator:creators(*), report:campaign_reports(*)")
        .eq("event_id", id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as CampaignApplicationWithCreator[];
    },
    enabled: !!id,
  });

  const handleOpenReportModal = (app: CampaignApplicationWithCreator) => {
    setSelectedAppForReport(app);
    if (app.report) {
      setReportReach(String(app.report.reach));
      setReportEngagement(String(app.report.engagement));
      setReportDeliverableStatus(app.report.deliverable_status);
      setReportNotes(app.report.notes ?? "");
    } else {
      setReportReach("");
      setReportEngagement("");
      setReportDeliverableStatus("delivered");
      setReportNotes("");
    }
    setReportModalOpen(true);
  };

  const handleSaveReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAppForReport) return;

    const r = parseInt(reportReach, 10);
    const eng = parseInt(reportEngagement, 10);
    if (isNaN(r) || r < 0) {
      toast.error("Please enter a valid reach count (0 or greater).");
      return;
    }
    if (isNaN(eng) || eng < 0) {
      toast.error("Please enter a valid engagement count (0 or greater).");
      return;
    }

    setSavingReport(true);
    try {
      const { error } = await supabase.from("campaign_reports").upsert(
        {
          application_id: selectedAppForReport.id,
          reach: r,
          engagement: eng,
          deliverable_status: reportDeliverableStatus,
          notes: reportNotes.trim() || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "application_id" },
      );

      if (error) throw error;
      toast.success("Campaign report saved successfully!");
      setReportModalOpen(false);
      await qc.invalidateQueries({ queryKey: ["event-campaign-applications", id] });
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setSavingReport(false);
    }
  };

  const handleExportCSV = () => {
    const acceptedApps = (applicationsQuery.data ?? []).filter((a) => a.status === "accepted");
    if (acceptedApps.length === 0) {
      toast.info("No accepted campaign applications found to export.");
      return;
    }

    const headers = [
      "Event Title",
      "Creator Name",
      "Niche / Category",
      "Audience Size",
      "Reach (Views/Impressions)",
      "Engagement (Interactions)",
      "Engagement Rate (%)",
      "Deliverable Status",
      "Deliverable Notes",
      "Pitch",
      "Report Date",
    ];

    const escapeCsv = (val: string | number | null | undefined) => {
      const str = String(val ?? "").replace(/"/g, '""');
      return `"${str}"`;
    };

    const rows = acceptedApps.map((app) => {
      const rep = app.report;
      const reach = rep?.reach ?? 0;
      const eng = rep?.engagement ?? 0;
      const rate = reach > 0 ? ((eng / reach) * 100).toFixed(2) : "0.00";

      return [
        escapeCsv(ev?.title),
        escapeCsv(app.creator?.display_name ?? "Unknown"),
        escapeCsv(app.creator?.category ?? "General"),
        escapeCsv(app.creator?.audience_size ?? 0),
        escapeCsv(reach),
        escapeCsv(eng),
        escapeCsv(`${rate}%`),
        escapeCsv(rep?.deliverable_status ?? "not_started"),
        escapeCsv(rep?.notes ?? ""),
        escapeCsv(app.pitch),
        escapeCsv(rep?.updated_at ?? app.created_at),
      ].join(",");
    });

    const csvContent = [headers.join(","), ...rows].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const slug = ev?.title.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "event";
    link.setAttribute("href", url);
    link.setAttribute("download", `${slug}-campaign-report.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("Campaign CSV report downloaded!");
  };

  const handlePrintPDF = () => {
    window.print();
  };

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

  const handleUpdateAppStatus = async (appId: string, newStatus: "accepted" | "rejected") => {
    setProcessingAppId(appId);
    try {
      const { error } = await supabase
        .from("campaign_applications")
        .update({ status: newStatus })
        .eq("id", appId);
      if (error) throw error;

      toast.success(
        newStatus === "accepted"
          ? "Creator application accepted! Partner notified."
          : "Application rejected.",
      );
      qc.invalidateQueries({ queryKey: ["event-campaign-applications", id] });
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setProcessingAppId(null);
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

  const allApps = applicationsQuery.data ?? [];
  const pendingAppsCount = allApps.filter((a) => a.status === "pending").length;
  const filteredApps = allApps.filter((a) => (appFilter === "all" ? true : a.status === appFilter));

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
            <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
              {ev.promotion_brief && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand/10 text-primary text-xs font-bold border border-brand/20">
                  <Megaphone className="size-3.5" /> Collab Campaign Active
                </span>
              )}
              <Button
                variant="brand"
                size="sm"
                onClick={handleOpenMatchModal}
                className="rounded-full text-xs font-semibold gap-1.5 shadow-brand print:hidden"
              >
                <Sparkles className="size-3.5" /> Match Creators
              </Button>
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
              <p className="text-xs text-muted-foreground uppercase font-semibold">
                Applications
              </p>
              <p className="font-display text-xl font-bold text-foreground">
                {allApps.length} Pitches
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Main Mode Tabs: Attendees Check-In vs Creator Campaign Applications vs Campaign Reports */}
      <div className="flex flex-wrap bg-muted/60 p-1 rounded-2xl border border-border self-start gap-1 print:hidden">
        <button
          type="button"
          onClick={() => setActiveTab("attendees")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
            activeTab === "attendees"
              ? "bg-card text-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Users className="size-4 text-primary" />
          <span>Attendees Check-in</span>
          <span className="min-w-5 rounded-full bg-primary/10 px-1.5 py-0.2 text-[10px] font-bold text-primary">
            {attendeesQuery.data?.length ?? 0}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("applications")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
            activeTab === "applications"
              ? "bg-card text-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Megaphone className="size-4 text-primary" />
          <span>Creator Pitches</span>
          {pendingAppsCount > 0 && (
            <span className="min-w-5 rounded-full bg-brand px-1.5 py-0.2 text-[10px] font-bold text-primary-foreground">
              {pendingAppsCount} pending
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("reports")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
            activeTab === "reports"
              ? "bg-card text-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <BarChart3 className="size-4 text-primary" />
          <span>Campaign Reports</span>
          {acceptedApps.length > 0 && (
            <span className="min-w-5 rounded-full bg-trust/10 text-trust px-1.5 py-0.2 text-[10px] font-bold">
              {acceptedApps.length}
            </span>
          )}
        </button>
      </div>

      {/* Active Tab 1: Attendees Check-in Split View */}
      {activeTab === "attendees" && (
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
                        <td className="py-3 px-3 text-xs font-semibold">
                          {att.attendee_count} Pass
                        </td>
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
      )}

      {/* Active Tab 2: Creator Campaign Applications View */}
      {activeTab === "applications" && (
        <div className="space-y-6">
          {/* Campaign Brief Banner for the Organizer */}
          {ev?.promotion_brief && (
            <div className="rounded-3xl bg-brand/5 border border-brand/20 p-5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-primary uppercase tracking-wider flex items-center gap-1.5">
                  <Megaphone className="size-3.5" /> Promotion Brief for this Event
                </span>
                <span className="text-xs text-muted-foreground">
                  Target Niche: <strong className="text-foreground">{ev.target_niche || "All Categories"}</strong>
                </span>
              </div>
              <p className="text-sm text-foreground leading-relaxed">{ev.promotion_brief}</p>
            </div>
          )}

          {/* Sub-Filter Tabs */}
          <div className="flex items-center justify-between gap-4 border-b border-border pb-3">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground font-semibold">Filter:</span>
              {(["all", "pending", "accepted", "rejected"] as const).map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setAppFilter(filter)}
                  className={`px-3 py-1.5 rounded-full capitalize font-semibold transition-all ${
                    appFilter === filter
                      ? "bg-brand text-primary-foreground shadow-brand"
                      : "bg-muted/70 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2.5">
              <Button
                variant="brand"
                size="sm"
                onClick={handleOpenMatchModal}
                className="rounded-full text-xs font-semibold gap-1.5 shadow-brand"
              >
                <Sparkles className="size-3.5" /> Match Creators
              </Button>
              <p className="text-xs text-muted-foreground hidden sm:block">
                Showing <strong className="text-foreground">{filteredApps.length}</strong> of{" "}
                {allApps.length} applications
              </p>
            </div>
          </div>

          {/* Applications Feed */}
          {applicationsQuery.isLoading ? (
            <ListSkeleton rows={3} />
          ) : applicationsQuery.error ? (
            <ErrorState
              message={errMsg(applicationsQuery.error)}
              onRetry={() => applicationsQuery.refetch()}
            />
          ) : filteredApps.length === 0 ? (
            <EmptyState
              title={
                appFilter === "all"
                  ? "No creator applications received yet"
                  : `No ${appFilter} applications`
              }
              body={
                appFilter === "all"
                  ? "When creators in your niche discover this event and submit promotional pitches, their proposals will show up here."
                  : "Try switching filter views."
              }
            />
          ) : (
            <div className="space-y-4">
              {filteredApps.map((app) => (
                <div
                  key={app.id}
                  className={`rounded-3xl border p-6 transition-all space-y-4 ${
                    app.status === "accepted"
                      ? "bg-trust-soft/10 border-trust/40"
                      : app.status === "rejected"
                        ? "bg-card/50 border-border opacity-75"
                        : "bg-card border-border shadow-xs"
                  }`}
                >
                  {/* Creator Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border/70 pb-4">
                    <div className="flex items-center gap-3">
                      <Avatar
                        name={app.creator?.display_name || "Creator"}
                        src={app.creator?.avatar_url}
                        size={48}
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <Link
                            to="/creator/$id"
                            params={{ id: app.creator_id }}
                            className="font-bold text-base text-foreground hover:text-primary transition-colors flex items-center gap-1.5"
                          >
                            {app.creator?.display_name || "Creator"}
                            {app.creator?.verified && (
                              <BadgeCheck className="size-4 fill-primary text-primary-foreground" />
                            )}
                          </Link>
                          <span className="text-xs text-muted-foreground">
                            · {app.creator?.category} creator
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                          <span>{app.creator?.location || "Pune, India"}</span>
                          <span>·</span>
                          <span className="font-semibold text-foreground">
                            {fmtCount(app.creator?.audience_size || 0)} followers
                          </span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 self-start sm:self-auto">
                      <span
                        className={`text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider ${
                          app.status === "accepted"
                            ? "bg-trust-soft text-trust"
                            : app.status === "rejected"
                              ? "bg-destructive/10 text-destructive"
                              : "bg-warn-soft text-warn"
                        }`}
                      >
                        {app.status}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {fmtAgo(app.created_at)}
                      </span>
                    </div>
                  </div>

                  {/* Pitch Proposal */}
                  <div className="space-y-1.5">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">
                      Creator's Pitch Proposal
                    </span>
                    <p className="text-sm text-foreground bg-muted/20 p-4 rounded-2xl border border-border/60 leading-relaxed whitespace-pre-line">
                      {app.pitch}
                    </p>
                  </div>

                  {/* Portfolio Links */}
                  {(app.creator?.portfolio_links ?? []).length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="text-muted-foreground font-semibold">Portfolio:</span>
                      {app.creator?.portfolio_links.map((link, idx) => (
                        <a
                          key={idx}
                          href={link}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-primary hover:underline bg-muted/40 px-2.5 py-1 rounded-lg border border-border/50"
                        >
                          <ExternalLink className="size-3" />
                          {link.replace(/^https?:\/\/(www\.)?/, "").slice(0, 25)}
                        </a>
                      ))}
                    </div>
                  )}

                  {/* Action Buttons for Organizer */}
                  <div className="pt-2 flex items-center justify-end gap-3 border-t border-border/70">
                    {app.status === "pending" ? (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleUpdateAppStatus(app.id, "rejected")}
                          disabled={processingAppId === app.id}
                          className="rounded-xl border-destructive/40 text-destructive hover:bg-destructive/10 text-xs font-semibold gap-1.5"
                        >
                          <X className="size-3.5" /> Reject Pitch
                        </Button>
                        <Button
                          variant="brand"
                          size="sm"
                          onClick={() => handleUpdateAppStatus(app.id, "accepted")}
                          disabled={processingAppId === app.id}
                          className="rounded-xl text-xs font-semibold gap-1.5 shadow-brand"
                        >
                          <Check className="size-3.5" /> Accept & Collaborate
                        </Button>
                      </>
                    ) : app.status === "accepted" ? (
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="text-xs font-semibold text-trust flex items-center gap-1">
                          <Check className="size-4" /> Partner Confirmed
                        </span>
                        {app.report && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-trust/10 text-trust text-[11px] font-semibold border border-trust/20">
                            <TrendingUp className="size-3" />
                            {fmtCount(app.report.reach)} reach · {app.report.deliverable_status.replace("_", " ")}
                          </span>
                        )}
                        <Button
                          variant="brand"
                          size="sm"
                          onClick={() => handleOpenReportModal(app)}
                          className="rounded-xl text-xs font-semibold gap-1.5"
                        >
                          <BarChart3 className="size-3.5" />
                          {app.report ? "Edit Metrics" : "Log Report"}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleUpdateAppStatus(app.id, "rejected")}
                          disabled={processingAppId === app.id}
                          className="rounded-xl text-[11px] text-muted-foreground hover:text-destructive"
                        >
                          Change to Rejected
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-semibold text-muted-foreground">
                          Application Declined
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleUpdateAppStatus(app.id, "accepted")}
                          disabled={processingAppId === app.id}
                          className="rounded-xl text-[11px] text-primary"
                        >
                          Reconsider & Accept
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Active Tab 3: Post-Event Campaign Reports View */}
      {activeTab === "reports" && (
        <div className="space-y-6">
          {/* Top Controls: Title, KPI overview, CSV and Print PDF buttons */}
          <div className="rounded-3xl bg-card border border-border p-6 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4">
              <div>
                <h2 className="font-display font-bold text-xl flex items-center gap-2">
                  <BarChart3 className="size-5 text-primary" /> Post-Event Campaign Reports
                </h2>
                <p className="text-xs text-muted-foreground">
                  Track audience reach, guest engagement, and confirmed deliverables across collaborating creators.
                </p>
              </div>

              <div className="flex items-center gap-2.5 self-start sm:self-auto print:hidden">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportCSV}
                  disabled={acceptedApps.length === 0}
                  className="rounded-xl gap-2 text-xs font-semibold"
                >
                  <FileSpreadsheet className="size-4 text-emerald-600" /> Export CSV
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrintPDF}
                  disabled={acceptedApps.length === 0}
                  className="rounded-xl gap-2 text-xs font-semibold"
                >
                  <Printer className="size-4 text-primary" /> Export PDF (Print)
                </Button>
              </div>
            </div>

            {/* Aggregate Metrics Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-2xl bg-muted/40 border border-border/80 space-y-1">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Total Audience Reach
                </span>
                <p className="font-display text-2xl font-bold text-foreground">
                  {fmtCount(totalReach)}
                </p>
                <p className="text-[11px] text-muted-foreground">Aggregated impressions / views</p>
              </div>

              <div className="p-4 rounded-2xl bg-muted/40 border border-border/80 space-y-1">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Total Engagements
                </span>
                <p className="font-display text-2xl font-bold text-primary">
                  {fmtCount(totalEngagement)}
                </p>
                <p className="text-[11px] text-muted-foreground">Clicks, likes, shares & comments</p>
              </div>

              <div className="p-4 rounded-2xl bg-muted/40 border border-border/80 space-y-1">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Avg Engagement Rate
                </span>
                <p className="font-display text-2xl font-bold text-trust">
                  {avgEngagementRate}%
                </p>
                <p className="text-[11px] text-muted-foreground">Interactions over total reach</p>
              </div>

              <div className="p-4 rounded-2xl bg-muted/40 border border-border/80 space-y-1">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Deliverables Completed
                </span>
                <p className="font-display text-2xl font-bold text-foreground">
                  {deliveredCount} / {acceptedApps.length}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {acceptedApps.length - deliveredCount} remaining or in progress
                </p>
              </div>
            </div>
          </div>

          {/* Accepted Creators & Reports Feed */}
          {acceptedApps.length === 0 ? (
            <EmptyState
              title="No campaign partners accepted yet"
              body="Accept creator pitches in the Creator Pitches tab to begin logging post-event metrics and deliverables."
              action={
                <Button
                  variant="brand"
                  size="sm"
                  onClick={() => setActiveTab("applications")}
                  className="rounded-xl"
                >
                  View Creator Pitches
                </Button>
              }
            />
          ) : (
            <div className="space-y-4">
              {acceptedApps.map((app) => {
                const rep = app.report;
                const reach = rep?.reach ?? 0;
                const eng = rep?.engagement ?? 0;
                const rate = reach > 0 ? ((eng / reach) * 100).toFixed(1) : "0.0";
                const isDelivered = rep?.deliverable_status === "delivered";
                const isInProgress = rep?.deliverable_status === "in_progress";

                return (
                  <div
                    key={app.id}
                    className="rounded-3xl bg-card border border-border p-6 shadow-xs space-y-4"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border pb-4">
                      <div className="flex items-center gap-3">
                        <Avatar
                          name={app.creator?.display_name || "Creator"}
                          src={app.creator?.avatar_url}
                          size={44}
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-base text-foreground">
                              {app.creator?.display_name || "Creator"}
                            </span>
                            {app.creator?.verified && (
                              <BadgeCheck className="size-4 fill-primary text-primary-foreground" />
                            )}
                            <span className="text-xs text-muted-foreground">
                              · {app.creator?.category}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Audience base: {fmtCount(app.creator?.audience_size || 0)} followers · {app.creator?.location}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                            isDelivered
                              ? "bg-trust-soft text-trust"
                              : isInProgress
                                ? "bg-warn-soft text-warn"
                                : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {isDelivered ? (
                            <CheckCircle2 className="size-3.5" />
                          ) : isInProgress ? (
                            <Clock className="size-3.5" />
                          ) : (
                            <AlertCircle className="size-3.5" />
                          )}
                          {rep?.deliverable_status?.replace("_", " ") ?? "not started"}
                        </span>
                        <Button
                          variant="brand"
                          size="sm"
                          onClick={() => handleOpenReportModal(app)}
                          className="rounded-xl text-xs font-semibold gap-1.5"
                        >
                          <BarChart3 className="size-3.5" />
                          {rep ? "Update Metrics" : "Log Metrics"}
                        </Button>
                      </div>
                    </div>

                    {/* Stats for this specific creator */}
                    <div className="grid grid-cols-3 gap-3 bg-muted/30 p-4 rounded-2xl border border-border/60">
                      <div>
                        <span className="text-[11px] text-muted-foreground uppercase font-semibold">
                          Recorded Reach
                        </span>
                        <p className="text-lg font-bold font-display">
                          {rep ? fmtCount(reach) : "—"}
                        </p>
                      </div>
                      <div>
                        <span className="text-[11px] text-muted-foreground uppercase font-semibold">
                          Engagements
                        </span>
                        <p className="text-lg font-bold font-display text-primary">
                          {rep ? fmtCount(eng) : "—"}
                        </p>
                      </div>
                      <div>
                        <span className="text-[11px] text-muted-foreground uppercase font-semibold">
                          Engagement Rate
                        </span>
                        <p className="text-lg font-bold font-display text-trust">
                          {rep ? `${rate}%` : "—"}
                        </p>
                      </div>
                    </div>

                    {/* Deliverable Notes */}
                    {rep?.notes && (
                      <div className="text-xs space-y-1">
                        <span className="font-semibold text-muted-foreground">Deliverable Notes & Proof URLs:</span>
                        <p className="p-3 bg-muted/20 rounded-xl border border-border/50 text-foreground whitespace-pre-line">
                          {rep.notes}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Campaign Report Edit/Submit Modal */}
      <Dialog open={reportModalOpen} onOpenChange={setReportModalOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold font-display">
              {selectedAppForReport?.report ? "Update Campaign Report" : "Log Post-Event Campaign Metrics"}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Record verified reach, audience interactions, and deliverable status for{" "}
              <strong className="text-foreground">{selectedAppForReport?.creator?.display_name}</strong>.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveReport} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="rep-reach">
                Total Reach (Impressions / Views) <span className="text-destructive">*</span>
              </Label>
              <Input
                id="rep-reach"
                type="number"
                min="0"
                value={reportReach}
                onChange={(e) => setReportReach(e.target.value)}
                placeholder="e.g. 45000"
                required
              />
              <p className="text-[11px] text-muted-foreground">
                Total unique accounts reached across all deliverables.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="rep-eng">
                Total Engagement (Clicks, Likes, Comments) <span className="text-destructive">*</span>
              </Label>
              <Input
                id="rep-eng"
                type="number"
                min="0"
                value={reportEngagement}
                onChange={(e) => setReportEngagement(e.target.value)}
                placeholder="e.g. 3200"
                required
              />
              <p className="text-[11px] text-muted-foreground">
                Total interactions generated on promotional posts.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="rep-status">
                Deliverable Status <span className="text-destructive">*</span>
              </Label>
              <select
                id="rep-status"
                value={reportDeliverableStatus}
                onChange={(e) =>
                  setReportDeliverableStatus(e.target.value as "not_started" | "in_progress" | "delivered")
                }
                className="w-full bg-card border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="not_started">Not Started</option>
                <option value="in_progress">In Progress</option>
                <option value="delivered">Delivered (Complete)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="rep-notes">Deliverable Notes & Proof URLs</Label>
              <Textarea
                id="rep-notes"
                value={reportNotes}
                onChange={(e) => setReportNotes(e.target.value)}
                placeholder="Include links to published reels, videos, stories, or analytics screenshots..."
                rows={3}
              />
            </div>

            <DialogFooter className="pt-3 border-t border-border flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setReportModalOpen(false)}
                disabled={savingReport}
                className="rounded-xl"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="brand"
                disabled={savingReport}
                className="rounded-xl gap-2"
              >
                {savingReport ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Saving...
                  </>
                ) : (
                  <>
                    <Check className="size-4" /> Save Report
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Print-Only Executive Summary Sheet */}
      <div className="hidden print:block space-y-6 p-6 text-black bg-white">
        <div className="border-b-2 border-black pb-4">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">CreatorConnect</h1>
              <p className="text-xs uppercase tracking-widest text-neutral-600 font-semibold mt-0.5">
                Official Event Campaign Performance Report
              </p>
            </div>
            <div className="text-right text-xs text-neutral-600">
              <p>Generated: {new Date().toLocaleDateString("en-IN", { dateStyle: "long" })}</p>
              <p>Status: {ev?.status?.toUpperCase()}</p>
            </div>
          </div>
          <div className="mt-4">
            <h2 className="text-xl font-bold">{ev?.title}</h2>
            <p className="text-sm text-neutral-700">
              {ev?.venue} · {ev?.starts_at ? fmtDateTime(ev.starts_at) : ""}
            </p>
          </div>
        </div>

        {/* Executive KPI Summary */}
        <div className="grid grid-cols-4 gap-4 p-4 border border-neutral-300 rounded-lg">
          <div>
            <p className="text-xs text-neutral-500 font-semibold uppercase">Total Reach</p>
            <p className="text-xl font-bold">{fmtCount(totalReach)}</p>
          </div>
          <div>
            <p className="text-xs text-neutral-500 font-semibold uppercase">Total Engagement</p>
            <p className="text-xl font-bold">{fmtCount(totalEngagement)}</p>
          </div>
          <div>
            <p className="text-xs text-neutral-500 font-semibold uppercase">Avg Engagement Rate</p>
            <p className="text-xl font-bold">{avgEngagementRate}%</p>
          </div>
          <div>
            <p className="text-xs text-neutral-500 font-semibold uppercase">Deliverables</p>
            <p className="text-xl font-bold">{deliveredCount} / {acceptedApps.length} Delivered</p>
          </div>
        </div>

        {/* Deliverables Table */}
        <div className="space-y-2">
          <h3 className="text-sm font-bold uppercase tracking-wider">Creator Deliverable Breakdown</h3>
          <table className="w-full border-collapse border border-neutral-300 text-xs">
            <thead>
              <tr className="bg-neutral-100">
                <th className="border border-neutral-300 p-2 text-left">Creator</th>
                <th className="border border-neutral-300 p-2 text-left">Category</th>
                <th className="border border-neutral-300 p-2 text-right">Reach</th>
                <th className="border border-neutral-300 p-2 text-right">Engagement</th>
                <th className="border border-neutral-300 p-2 text-right">Rate</th>
                <th className="border border-neutral-300 p-2 text-center">Status</th>
                <th className="border border-neutral-300 p-2 text-left">Deliverable Notes</th>
              </tr>
            </thead>
            <tbody>
              {acceptedApps.map((a) => {
                const rep = a.report;
                const r = rep?.reach ?? 0;
                const eng = rep?.engagement ?? 0;
                const rate = r > 0 ? ((eng / r) * 100).toFixed(1) : "0.0";
                return (
                  <tr key={a.id}>
                    <td className="border border-neutral-300 p-2 font-semibold">{a.creator?.display_name || "Unknown"}</td>
                    <td className="border border-neutral-300 p-2">{a.creator?.category}</td>
                    <td className="border border-neutral-300 p-2 text-right font-medium">{fmtCount(r)}</td>
                    <td className="border border-neutral-300 p-2 text-right font-medium">{fmtCount(eng)}</td>
                    <td className="border border-neutral-300 p-2 text-right font-medium">{rate}%</td>
                    <td className="border border-neutral-300 p-2 text-center uppercase font-bold text-[10px]">
                      {rep?.deliverable_status ?? "not_started"}
                    </td>
                    <td className="border border-neutral-300 p-2 text-neutral-700">{rep?.notes || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="text-[10px] text-neutral-400 pt-4 border-t border-neutral-200">
          CreatorConnect Events Platform · Official Verification Document
        </div>
      </div>

      {/* AI Creator Matching Engine Dialog */}
      <Dialog open={matchModalOpen} onOpenChange={setMatchModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl p-6">
          <DialogHeader>
            <div className="flex items-center gap-2 text-primary">
              <Sparkles className="size-5" />
              <DialogTitle className="text-xl font-bold font-display text-foreground">
                AI-Assisted Creator Matching
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-muted-foreground">
              Top 5 creator recommendations for <strong className="text-foreground">{ev?.title}</strong> based on target niche, geographic proximity, capacity ratio, and trust verification.
            </DialogDescription>
          </DialogHeader>

          {matchingLoading ? (
            <div className="py-12 text-center space-y-3">
              <Loader2 className="size-8 animate-spin text-primary mx-auto" />
              <p className="text-sm font-semibold">Analyzing creator profiles against event criteria...</p>
              <p className="text-xs text-muted-foreground">Evaluating niche alignment, location proximity, and audience fit.</p>
            </div>
          ) : recommendedMatches.length === 0 ? (
            <div className="py-8 text-center space-y-2">
              <AlertCircle className="size-8 text-muted-foreground mx-auto" />
              <p className="text-sm font-semibold">No creators found to match</p>
              <p className="text-xs text-muted-foreground">Check back when more creators join CreatorConnect.</p>
            </div>
          ) : (
            <div className="space-y-4 pt-2">
              <div className="rounded-2xl bg-brand/5 border border-brand/20 p-3.5 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Target className="size-4 text-primary shrink-0" />
                  <span>
                    Matching Event: <strong className="text-foreground">{ev?.target_niche || "All Niches"}</strong> · {ev?.venue} · {ev?.capacity} Seats
                  </span>
                </div>
                <span className="text-[11px] font-semibold text-primary px-2 py-0.5 rounded-full bg-brand/10">
                  MVP Recommendation Engine
                </span>
              </div>

              {/* Creator Recommendations List */}
              <div className="space-y-3">
                {recommendedMatches.map((match, idx) => {
                  const { creator, totalScore, matchLevel, breakdown } = match;
                  const isExpanded = expandedMatchId === creator.id;

                  return (
                    <div
                      key={creator.id}
                      className={`rounded-2xl border transition-all ${
                        idx === 0
                          ? "border-primary/40 bg-card shadow-xs ring-1 ring-primary/20"
                          : "border-border bg-card hover:border-border/80"
                      }`}
                    >
                      <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted font-display text-xs font-bold text-muted-foreground">
                            #{idx + 1}
                          </span>
                          <Avatar name={creator.display_name} src={creator.avatar_url} size={42} />
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-sm text-foreground">{creator.display_name}</span>
                              {creator.verified && (
                                <BadgeCheck className="size-4 fill-primary text-primary-foreground" />
                              )}
                              <span className="text-xs text-muted-foreground">· {creator.category}</span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {creator.location || "Location not stated"} · {fmtCount(creator.audience_size || 0)} followers
                            </p>
                          </div>
                        </div>

                        {/* Match Score Badge & Details Toggle */}
                        <div className="flex items-center gap-3 self-end sm:self-auto">
                          <div className="text-right">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                totalScore >= 75
                                  ? "bg-trust-soft text-trust"
                                  : totalScore >= 55
                                    ? "bg-warn-soft text-warn"
                                    : "bg-muted text-muted-foreground"
                              }`}
                            >
                              {totalScore}/100 · {matchLevel}
                            </span>
                          </div>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setExpandedMatchId(isExpanded ? null : creator.id)}
                            className="h-8 px-2 text-xs rounded-xl text-muted-foreground hover:text-foreground"
                          >
                            <span>Breakdown</span>
                            {isExpanded ? <ChevronUp className="size-3.5 ml-1" /> : <ChevronDown className="size-3.5 ml-1" />}
                          </Button>
                        </div>
                      </div>

                      {/* Expandable Transparent Score Breakdown */}
                      {isExpanded && (
                        <div className="px-4 pb-4 pt-1 border-t border-border/60 space-y-3 text-xs bg-muted/20 rounded-b-2xl">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                            {/* Niche */}
                            <div className="p-2.5 rounded-xl bg-card border border-border/60 space-y-1">
                              <div className="flex justify-between items-center font-semibold">
                                <span className="text-muted-foreground">Niche Alignment</span>
                                <span className="text-primary font-bold">
                                  {breakdown.nicheScore} / {breakdown.nicheMax} pts
                                </span>
                              </div>
                              <p className="text-[11px] text-muted-foreground">{breakdown.nicheReason}</p>
                            </div>

                            {/* Location */}
                            <div className="p-2.5 rounded-xl bg-card border border-border/60 space-y-1">
                              <div className="flex justify-between items-center font-semibold">
                                <span className="text-muted-foreground">Location Proximity</span>
                                <span className="text-primary font-bold">
                                  {breakdown.locationScore} / {breakdown.locationMax} pts
                                </span>
                              </div>
                              <p className="text-[11px] text-muted-foreground">{breakdown.locationReason}</p>
                            </div>

                            {/* Audience */}
                            <div className="p-2.5 rounded-xl bg-card border border-border/60 space-y-1">
                              <div className="flex justify-between items-center font-semibold">
                                <span className="text-muted-foreground">Audience Suitability</span>
                                <span className="text-primary font-bold">
                                  {breakdown.audienceScore} / {breakdown.audienceMax} pts
                                </span>
                              </div>
                              <p className="text-[11px] text-muted-foreground">{breakdown.audienceReason}</p>
                            </div>

                            {/* Trust */}
                            <div className="p-2.5 rounded-xl bg-card border border-border/60 space-y-1">
                              <div className="flex justify-between items-center font-semibold">
                                <span className="text-muted-foreground">Trust & Verification</span>
                                <span className="text-primary font-bold">
                                  {breakdown.trustScore} / {breakdown.trustMax} pts
                                </span>
                              </div>
                              <p className="text-[11px] text-muted-foreground">{breakdown.trustReason}</p>
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-2">
                            <p className="text-[11px] text-muted-foreground italic">
                              Bio: {creator.bio ? `"${creator.bio.slice(0, 90)}..."` : "No bio provided"}
                            </p>
                            <Link
                              to="/creator/$id"
                              params={{ id: creator.id }}
                              target="_blank"
                              className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline shrink-0"
                            >
                              <span>View Profile</span>
                              <ExternalLink className="size-3" />
                            </Link>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="rounded-xl border border-border/70 p-3 bg-muted/40 text-[11px] text-muted-foreground space-y-0.5">
                <p className="font-semibold text-foreground">AI-Assisted Recommendation MVP</p>
                <p>
                  Compatibility scores are computed using a transparent weighted scoring algorithm evaluating target niche affinity (40%), location proximity (25%), capacity-to-reach ratio (20%), and trust verification (15%). No trained ML model is utilized.
                </p>
              </div>
            </div>
          )}

          <DialogFooter className="pt-3 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={() => setMatchModalOpen(false)}
              className="rounded-xl"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
