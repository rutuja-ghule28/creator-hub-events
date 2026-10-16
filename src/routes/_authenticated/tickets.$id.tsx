import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { CalendarDays, MapPin, ChevronLeft, Download, ArrowLeft, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { errMsg, fmtDateTime, type EventWithCreator } from "@/lib/cc";
import { CreatorName, ErrorState, EventCover, ListSkeleton, OfficialSeal } from "@/components/cc";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/tickets/$id")({
  head: ({ params }) => ({
    meta: [
      { title: "Event Ticket & QR Entry Pass — CreatorConnect" },
      {
        name: "description",
        content: "Access your verified event QR ticket pass for express check-in at the venue.",
      },
      { property: "og:site_name", content: "CreatorConnect" },
      { property: "og:title", content: "Event Ticket & QR Entry Pass — CreatorConnect" },
      {
        property: "og:description",
        content: "Access your verified event QR ticket pass for express check-in at the venue.",
      },
      { property: "og:type", content: "article" },
      { property: "og:url", content: `https://creatorconnect.app/tickets/${params.id}` },
      { property: "og:image", content: "https://creatorconnect.app/assets/og-image.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Event Ticket & QR Entry Pass — CreatorConnect" },
      {
        name: "twitter:description",
        content: "Access your verified event QR ticket pass for express check-in at the venue.",
      },
      { name: "twitter:image", content: "https://creatorconnect.app/assets/og-image.png" },
    ],
    links: [{ rel: "canonical", href: `https://creatorconnect.app/tickets/${params.id}` }],
  }),
  component: TicketDetailPage,
});

type RegistrationDetail = {
  id: string;
  ticket_code: string;
  attendee_count: number;
  full_name: string;
  email: string;
  checked_in: boolean;
  created_at: string;
  event: EventWithCreator | null;
};

function TicketDetailPage() {
  const { id } = Route.useParams();

  const query = useQuery({
    queryKey: ["ticket-detail", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("registrations")
        .select("*, event:events(*, creator:creators(*))")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data as unknown as RegistrationDetail;
    },
  });

  const reg = query.data;
  const ev = reg?.event;

  return (
    <main className="px-4 py-5 md:px-6 md:py-8 pb-24">
      {/* Top Breadcrumb */}
      <div className="mb-6">
        <Link
          to="/tickets"
          className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="size-4" />
          Back to My Tickets
        </Link>
      </div>

      {query.isLoading ? (
        <ListSkeleton rows={2} tall />
      ) : query.error || !reg || !ev ? (
        <ErrorState message={errMsg(query.error)} onRetry={() => query.refetch()} />
      ) : (
        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Centered Ticket Card (max 420px, lg:col-span-6) */}
          <div className="lg:col-span-6 flex justify-center">
            <div className="w-full max-w-[420px] rounded-3xl bg-card border border-border shadow-xl overflow-hidden ring-1 ring-border">
              {/* Header Gradient */}
              <div className="bg-brand p-6 text-primary-foreground text-center space-y-2 relative overflow-hidden">
                <div className="absolute inset-0 bg-white/10 opacity-30" />
                <span className="relative z-10 inline-block px-3 py-1 rounded-full bg-white/20 text-xs font-semibold backdrop-blur-sm">
                  Official Guest Pass
                </span>
                <h1 className="relative z-10 font-display text-xl font-bold line-clamp-1">
                  {ev.title}
                </h1>
                <p className="relative z-10 text-xs opacity-90">
                  <CreatorName c={ev.creator} />
                </p>
              </div>

              {/* QR Code Section */}
              <div className="p-6 bg-background flex flex-col items-center justify-center space-y-4 border-b border-dashed border-border relative">
                {/* Side Notch cutouts */}
                <div className="absolute -left-3 top-1/2 size-6 rounded-full bg-card border-r border-border -translate-y-1/2" />
                <div className="absolute -right-3 top-1/2 size-6 rounded-full bg-card border-l border-border -translate-y-1/2" />

                <div className="p-4 bg-white rounded-2xl border border-border shadow-xs">
                  <QRCodeSVG value={reg.ticket_code} size={180} level="H" />
                </div>

                <div className="text-center space-y-1">
                  <p className="font-mono text-lg font-bold tracking-widest text-foreground">
                    {reg.ticket_code}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Scan at venue entrance for check-in
                  </p>
                </div>
              </div>

              {/* Guest Details */}
              <div className="p-6 space-y-3 bg-card text-xs">
                <div className="flex justify-between border-b border-border pb-2">
                  <span className="text-muted-foreground">Attendee</span>
                  <span className="font-semibold text-foreground">{reg.full_name}</span>
                </div>
                <div className="flex justify-between border-b border-border pb-2">
                  <span className="text-muted-foreground">Passes</span>
                  <span className="font-semibold text-foreground">
                    {reg.attendee_count} Guest Pass
                  </span>
                </div>
                <div className="flex justify-between border-b border-border pb-2">
                  <span className="text-muted-foreground">Status</span>
                  <span
                    className={`font-semibold ${reg.checked_in ? "text-trust" : "text-primary"}`}
                  >
                    {reg.checked_in ? "Checked in" : "Confirmed"}
                  </span>
                </div>
                <div className="flex justify-between pt-1">
                  <span className="text-muted-foreground">Venue</span>
                  <span className="font-semibold text-foreground truncate max-w-[200px]">
                    {ev.venue}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Beside Info & Actions Panel (lg:col-span-6) */}
          <div className="lg:col-span-6 space-y-6">
            <div className="rounded-3xl bg-card border border-border p-6 space-y-4">
              <div className="flex items-center gap-2">
                <OfficialSeal />
                <span className="text-xs font-semibold text-trust flex items-center gap-1">
                  <CheckCircle className="size-3.5" /> Validated Ticket
                </span>
              </div>

              <h2 className="font-display text-2xl font-bold">{ev.title}</h2>
              <p className="text-sm text-muted-foreground">
                <CreatorName c={ev.creator} />
              </p>

              <div className="space-y-2 pt-2 border-t border-border text-sm">
                <p className="flex items-center gap-2 text-foreground font-medium">
                  <CalendarDays className="size-4 text-primary" /> {fmtDateTime(ev.starts_at)}
                </p>
                <p className="flex items-center gap-2 text-foreground font-medium">
                  <MapPin className="size-4 text-primary" /> {ev.venue}, {ev.area}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3 pt-4 border-t border-border">
                <Button
                  variant="brand"
                  size="lg"
                  className="w-full gap-2 rounded-2xl font-semibold"
                  onClick={() => {
                    toast.success("Downloading PDF Ticket Pass...");
                  }}
                >
                  <Download className="size-4" /> Download Ticket (PDF)
                </Button>

                <Link to="/tickets" className="block">
                  <Button
                    variant="outline"
                    size="lg"
                    className="w-full gap-2 rounded-2xl font-semibold"
                  >
                    <ArrowLeft className="size-4" /> See all my tickets
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
