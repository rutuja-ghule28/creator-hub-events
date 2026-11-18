import { describe, expect, it } from "vitest";
import { ALERT_KINDS } from "@/lib/cc";

interface NotificationPref {
  user_id: string;
  kind: string;
  in_app: boolean;
  email: boolean;
}

function resolvePreferences(userId: string, savedPrefs: NotificationPref[]) {
  const map = new Map<string, { in_app: boolean; email: boolean }>();

  // Default values: in_app = true, email = false
  for (const { kind } of ALERT_KINDS) {
    map.set(kind, { in_app: true, email: false });
  }

  // Overlay saved preferences for this user
  for (const pref of savedPrefs) {
    if (pref.user_id === userId && map.has(pref.kind)) {
      map.set(pref.kind, { in_app: pref.in_app, email: pref.email });
    }
  }

  return map;
}

function shouldDeliverInApp(
  kind: string,
  userPrefs: Map<string, { in_app: boolean; email: boolean }>,
  masterNotifyEnabled = true,
) {
  if (!masterNotifyEnabled && kind !== "ticket") {
    return false;
  }
  const pref = userPrefs.get(kind);
  if (pref && !pref.in_app) {
    return false;
  }
  return true;
}

describe("Notification Preferences Workflow", () => {
  const testUserId = "usr-1234-abcd";

  it("includes all standard alert kinds", () => {
    const kinds = ALERT_KINDS.map((k) => k.kind);
    expect(kinds).toContain("application");
    expect(kinds).toContain("campaign");
    expect(kinds).toContain("deadline");
    expect(kinds).toContain("event");
    expect(kinds).toContain("announcement");
    expect(kinds).toContain("verification");
  });

  it("defaults to in_app=true and email=false when no saved prefs exist", () => {
    const prefs = resolvePreferences(testUserId, []);
    for (const { kind } of ALERT_KINDS) {
      expect(prefs.get(kind)?.in_app).toBe(true);
      expect(prefs.get(kind)?.email).toBe(false);
    }
  });

  it("applies saved preferences from database over defaults", () => {
    const saved: NotificationPref[] = [
      { user_id: testUserId, kind: "application", in_app: false, email: true },
      { user_id: testUserId, kind: "announcement", in_app: false, email: false },
    ];

    const prefs = resolvePreferences(testUserId, saved);

    expect(prefs.get("application")?.in_app).toBe(false);
    expect(prefs.get("application")?.email).toBe(true);

    expect(prefs.get("announcement")?.in_app).toBe(false);
    expect(prefs.get("announcement")?.email).toBe(false);

    // Other kinds should remain default
    expect(prefs.get("deadline")?.in_app).toBe(true);
    expect(prefs.get("deadline")?.email).toBe(false);
  });

  it("isolates preferences so other users cannot affect current user", () => {
    const saved: NotificationPref[] = [
      { user_id: "other-user-999", kind: "application", in_app: false, email: false },
    ];

    const prefs = resolvePreferences(testUserId, saved);
    // Should NOT be affected by other-user-999's settings
    expect(prefs.get("application")?.in_app).toBe(true);
  });

  it("simulates the respect_in_app_pref trigger behavior", () => {
    const saved: NotificationPref[] = [
      { user_id: testUserId, kind: "campaign", in_app: false, email: true },
    ];
    const prefs = resolvePreferences(testUserId, saved);

    // Campaign in_app disabled -> should not deliver in_app
    expect(shouldDeliverInApp("campaign", prefs, true)).toBe(false);

    // Deadline in_app enabled -> should deliver in_app
    expect(shouldDeliverInApp("deadline", prefs, true)).toBe(true);

    // Master notification switch disabled -> suppresses all except ticket
    expect(shouldDeliverInApp("deadline", prefs, false)).toBe(false);
    expect(shouldDeliverInApp("ticket", prefs, false)).toBe(true);
  });
});
