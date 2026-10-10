import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Flag, Trash2, CheckCircle, Clock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { errMsg, fmtAgo, fmtDateTime, type EventWithCreator } from "@/lib/cc";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/cc";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/admin/reports")({
  head: () => ({
    meta: [{ title: "Admin Reports Table — CreatorConnect" }],
  }),
  component: AdminReportsPage,
});

type ReportRow = {
  id: string;
  reason: string;
  note: string | null;
  status: string;
  created_at: string;
  event: EventWithCreator | null;
};

function AdminReportsPage() {
  const qc = useQueryClient();
  const [selectedReport, setSelectedReport] = useState<ReportRow | null>(null);

  const reportsQuery = useQuery({
    queryKey: ["admin-reports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reports")
        .select("*, event:events(*, creator:creators(*))")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as ReportRow[];
    },
  });

  const reports = reportsQuery.data ?? [];

  const handleDismissReport = async (reportId: string) => {
    try {
      const { error } = await supabase
        .from("reports")
        .update({ status: "dismissed" })
        .eq("id", reportId);
      if (error) throw error;
      toast.success("Report dismissed.");
      setSelectedReport(null);
      qc.invalidateQueries({ queryKey: ["admin-reports"] });
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  const handleRemoveEventListing = async (report: ReportRow) => {
    if (!report.event?.id) return;
    try {
      await supabase.from("events").update({ status: "removed" }).eq("id", report.event.id);
      await supabase.from("reports").update({ status: "actioned" }).eq("id", report.id);

      toast.success("Event listing removed and report actioned.");
      setSelectedReport(null);
      qc.invalidateQueries({ queryKey: ["admin-reports"] });
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  return (
    <main className="px-4 py-5 md:px-6 md:py-8 pb-24 space-y-6">
      {/* Top Header */}
      <div className="border-b border-border pb-4">
        <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
          <Flag className="size-6 text-destructive" /> Event Reports
        </h1>
        <p className="text-sm text-muted-foreground">
          Review user flags and moderate reported event listings.
        </p>
      </div>

      {/* Reports Desktop Data Table */}
      <div className="rounded-3xl bg-card border border-border overflow-hidden shadow-xs">
        {reportsQuery.isLoading ? (
          <div className="p-6">
            <ListSkeleton rows={4} />
          </div>
        ) : reportsQuery.error ? (
          <div className="p-6">
            <ErrorState
              message={errMsg(reportsQuery.error)}
              onRetry={() => reportsQuery.refetch()}
            />
          </div>
        ) : reports.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title="No active reports"
              body="No event listings have been reported by users."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/40 border-b border-border text-xs text-muted-foreground uppercase font-semibold">
                <tr>
                  <th className="py-3.5 px-4">Reason</th>
                  <th className="py-3.5 px-4">Event Title</th>
                  <th className="py-3.5 px-4">Reporter ID</th>
                  <th className="py-3.5 px-4">Time Flagged</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {reports.map((rep) => (
                  <tr key={rep.id} className="hover:bg-muted/30 transition-colors">
                    <td className="py-3.5 px-4 font-semibold capitalize text-destructive">
                      {rep.reason}
                    </td>
                    <td className="py-3.5 px-4 font-medium text-foreground">
                      {rep.event?.title || "Deleted / Unknown Event"}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs text-muted-foreground">
                      {rep.id.slice(0, 8)}...
                    </td>
                    <td className="py-3.5 px-4 text-xs text-muted-foreground">
                      {fmtAgo(rep.created_at)}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${
                          rep.status === "pending"
                            ? "bg-warn-soft text-warn-foreground"
                            : rep.status === "dismissed"
                              ? "bg-muted text-muted-foreground"
                              : "bg-destructive/10 text-destructive"
                        }`}
                      >
                        {rep.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedReport(rep)}
                        className="rounded-xl text-xs font-semibold"
                      >
                        Review
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail Dialog / Drawer */}
      <Dialog open={!!selectedReport} onOpenChange={() => setSelectedReport(null)}>
        {selectedReport && (
          <DialogContent className="sm:max-w-lg rounded-3xl p-6">
            <DialogHeader>
              <DialogTitle className="font-display text-xl font-bold flex items-center gap-2 text-destructive">
                <Flag className="size-5" /> Report Details
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Flagged {fmtAgo(selectedReport.created_at)}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 pt-2 text-sm">
              <div className="p-4 rounded-2xl bg-muted/40 border border-border space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase">
                  Reason for Report
                </p>
                <p className="font-bold text-destructive text-base capitalize">
                  {selectedReport.reason}
                </p>
                {selectedReport.note && (
                  <p className="text-xs text-foreground leading-relaxed pt-1 border-t border-border/60">
                    "{selectedReport.note}"
                  </p>
                )}
              </div>

              {selectedReport.event && (
                <div className="space-y-1 p-4 rounded-2xl bg-card border border-border">
                  <p className="text-xs font-semibold text-muted-foreground uppercase">
                    Target Event
                  </p>
                  <p className="font-bold text-foreground text-base">
                    {selectedReport.event.title}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Date: {fmtDateTime(selectedReport.event.starts_at)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Venue: {selectedReport.event.venue}
                  </p>
                </div>
              )}

              <div className="pt-4 border-t border-border flex items-center justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => handleDismissReport(selectedReport.id)}
                  className="rounded-xl text-xs font-semibold gap-1.5"
                >
                  <CheckCircle className="size-4" /> Dismiss Report
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => handleRemoveEventListing(selectedReport)}
                  className="rounded-xl text-xs font-semibold gap-1.5"
                >
                  <Trash2 className="size-4" /> Remove Event Listing
                </Button>
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </main>
  );
}
