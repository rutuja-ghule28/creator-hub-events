import { describe, expect, it } from "vitest";

interface CampaignReportInput {
  application_id: string;
  reach: number;
  engagement: number;
  deliverable_status: string;
  notes?: string | null;
}

const VALID_STATUSES = ["not_started", "in_progress", "delivered"] as const;

function validateCampaignReport(input: CampaignReportInput) {
  if (!input.application_id || input.application_id.trim() === "") {
    return { valid: false, error: "Application ID is required." };
  }

  if (typeof input.reach !== "number" || isNaN(input.reach) || input.reach < 0) {
    return { valid: false, error: "Reach must be a non-negative integer." };
  }

  if (typeof input.engagement !== "number" || isNaN(input.engagement) || input.engagement < 0) {
    return { valid: false, error: "Engagement must be a non-negative integer." };
  }

  if (!VALID_STATUSES.includes(input.deliverable_status as typeof VALID_STATUSES[number])) {
    return { valid: false, error: "Invalid deliverable status." };
  }

  return {
    valid: true,
    data: {
      application_id: input.application_id,
      reach: Math.floor(input.reach),
      engagement: Math.floor(input.engagement),
      deliverable_status: input.deliverable_status,
      notes: input.notes?.trim() || null,
    },
  };
}

function computeCampaignMetrics(
  reports: Array<{ reach: number; engagement: number; deliverable_status: string }>,
) {
  const totalReach = reports.reduce((acc, r) => acc + r.reach, 0);
  const totalEngagement = reports.reduce((acc, r) => acc + r.engagement, 0);
  const engagementRate = totalReach > 0 ? ((totalEngagement / totalReach) * 100).toFixed(2) : "0.00";
  const deliveredCount = reports.filter((r) => r.deliverable_status === "delivered").length;
  const inProgressCount = reports.filter((r) => r.deliverable_status === "in_progress").length;

  return {
    totalReach,
    totalEngagement,
    engagementRate: `${engagementRate}%`,
    deliveredCount,
    inProgressCount,
  };
}

function escapeCsvCell(val: string | number | null | undefined): string {
  const str = String(val ?? "").replace(/"/g, '""');
  return `"${str}"`;
}

function generateCsvRows(
  eventTitle: string,
  records: Array<{
    creatorName: string;
    category: string;
    reach: number;
    engagement: number;
    status: string;
    notes: string;
  }>,
): string {
  const headers = [
    "Event Title",
    "Creator Name",
    "Category",
    "Reach",
    "Engagement",
    "Engagement Rate",
    "Deliverable Status",
    "Deliverable Notes",
  ];

  const dataRows = records.map((r) => {
    const rate = r.reach > 0 ? `${((r.engagement / r.reach) * 100).toFixed(2)}%` : "0.00%";
    return [
      escapeCsvCell(eventTitle),
      escapeCsvCell(r.creatorName),
      escapeCsvCell(r.category),
      escapeCsvCell(r.reach),
      escapeCsvCell(r.engagement),
      escapeCsvCell(rate),
      escapeCsvCell(r.status),
      escapeCsvCell(r.notes),
    ].join(",");
  });

  return [headers.join(","), ...dataRows].join("\r\n");
}

describe("Campaign Reporting Workflow", () => {
  it("validates successful post-event report input", () => {
    const res = validateCampaignReport({
      application_id: "app-101",
      reach: 45000,
      engagement: 3200,
      deliverable_status: "delivered",
      notes: "Dedicated YouTube reel + 2 Instagram stories posted with event link.",
    });

    expect(res.valid).toBe(true);
    expect(res.data?.reach).toBe(45000);
    expect(res.data?.engagement).toBe(3200);
    expect(res.data?.deliverable_status).toBe("delivered");
  });

  it("rejects negative reach or engagement", () => {
    const res1 = validateCampaignReport({
      application_id: "app-102",
      reach: -10,
      engagement: 50,
      deliverable_status: "in_progress",
    });
    expect(res1.valid).toBe(false);
    expect(res1.error).toMatch(/Reach must be a non-negative integer/i);

    const res2 = validateCampaignReport({
      application_id: "app-103",
      reach: 1000,
      engagement: -5,
      deliverable_status: "in_progress",
    });
    expect(res2.valid).toBe(false);
    expect(res2.error).toMatch(/Engagement must be a non-negative integer/i);
  });

  it("rejects invalid deliverable status", () => {
    const res = validateCampaignReport({
      application_id: "app-104",
      reach: 100,
      engagement: 10,
      deliverable_status: "unknown_status",
    });
    expect(res.valid).toBe(false);
    expect(res.error).toMatch(/Invalid deliverable status/i);
  });

  it("computes aggregate campaign metrics accurately", () => {
    const sampleReports = [
      { reach: 50000, engagement: 2500, deliverable_status: "delivered" },
      { reach: 30000, engagement: 1500, deliverable_status: "in_progress" },
      { reach: 20000, engagement: 800, deliverable_status: "not_started" },
    ];

    const metrics = computeCampaignMetrics(sampleReports);
    expect(metrics.totalReach).toBe(100000);
    expect(metrics.totalEngagement).toBe(4800);
    expect(metrics.engagementRate).toBe("4.80%");
    expect(metrics.deliveredCount).toBe(1);
    expect(metrics.inProgressCount).toBe(1);
  });

  it("handles zero reach without dividing by zero", () => {
    const metrics = computeCampaignMetrics([{ reach: 0, engagement: 0, deliverable_status: "not_started" }]);
    expect(metrics.totalReach).toBe(0);
    expect(metrics.engagementRate).toBe("0.00%");
  });

  it("formats CSV rows with proper quote escaping", () => {
    const csv = generateCsvRows("Tech \"Unplugged\" 2026", [
      {
        creatorName: "Maya Lin, Tech",
        category: "Tech reviewer",
        reach: 25000,
        engagement: 1250,
        status: "delivered",
        notes: "Posted video: \"Must attend!\", high traffic.",
      },
    ]);

    expect(csv).toContain('"Tech ""Unplugged"" 2026"');
    expect(csv).toContain('"Maya Lin, Tech"');
    expect(csv).toContain('"5.00%"');
    expect(csv).toContain('"Posted video: ""Must attend!"", high traffic."');
  });
});
