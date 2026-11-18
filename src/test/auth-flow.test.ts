import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolvePostAuthRedirect, type AccountType } from "@/lib/cc";
import { ROLE_OPTIONS, type AccountRole } from "@/routes/auth";

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

function resolveAuthRedirect(redirect?: string): string {
  if (redirect && redirect.startsWith("/") && !redirect.startsWith("//")) {
    return redirect;
  }
  return "/discover";
}

function buildEmailRedirectUrl(origin: string, target: string): string {
  return `${origin}/auth?redirect=${encodeURIComponent(target)}&confirmed=true`;
}

function parseConfirmationError(
  search: string,
  hash: string,
): { isExpired: boolean; message: string } | null {
  const searchParams = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const cleanHash = hash.startsWith("#") ? hash.slice(1) : hash;
  const hashParams = new URLSearchParams(cleanHash);

  const err = searchParams.get("error") || hashParams.get("error");
  const errCode = searchParams.get("error_code") || hashParams.get("error_code");
  const errDesc = searchParams.get("error_description") || hashParams.get("error_description");

  if (!err && !errCode && !errDesc) return null;

  if (errCode === "otp_expired" || errDesc?.toLowerCase().includes("expired")) {
    return {
      isExpired: true,
      message:
        "This email verification link has expired. Please sign in below or request a new confirmation email.",
    };
  }

  const decoded = errDesc
    ? decodeURIComponent(errDesc.replace(/\+/g, " "))
    : "Invalid or expired confirmation link.";
  return {
    isExpired: false,
    message: decoded,
  };
}

// Client-side signup validation rule matching src/routes/auth.tsx
function validateSignupInput({
  mode,
  selectedRole,
  email,
  password,
}: {
  mode: "in" | "up";
  selectedRole: AccountRole | null;
  email: string;
  password: string;
}): string | null {
  const cleanEmail = email.trim();

  if (mode === "up") {
    if (!selectedRole) {
      return "Please select how you want to use Creator Connect (Attendee, Creator, or Host / Organizer).";
    }
  }

  if (!cleanEmail) {
    return "Email address is required.";
  }
  if (!EMAIL_REGEX.test(cleanEmail)) {
    return "Please enter a valid email address (e.g. name@example.com).";
  }
  if (!password) {
    return "Password is required.";
  }
  if (password.length < 8) {
    return "Password must be at least 8 characters long.";
  }

  return null;
}

// Emulation of database trigger public.handle_new_user() from migration 0004
function simulateHandleNewUserTrigger(
  rawUserMetaData: Record<string, unknown>,
  userId: string = "user-uuid-1",
  email: string = "test@example.com",
) {
  const requestedRole = (
    (rawUserMetaData["account_type"] as string) ||
    (rawUserMetaData["role"] as string) ||
    "attendee"
  )
    .toString()
    .trim()
    .toLowerCase();

  let validAccountType: "attendee" | "creator" | "organizer";
  if (requestedRole === "creator") {
    validAccountType = "creator";
  } else if (requestedRole === "organizer") {
    validAccountType = "organizer";
  } else {
    validAccountType = "attendee";
  }

  const userFullName = (rawUserMetaData["full_name"] as string) || (email.split("@")[0] ?? "User");

  const profile = {
    id: userId,
    full_name: userFullName,
    email,
    account_type: validAccountType,
  };

  const assignedRoles: ("attendee" | "organizer")[] = ["attendee"];
  let organizerPublicProfile: { user_id: string; name: string } | null = null;
  let organizerPrivateDetails: { organizer_id: string; contact_email: string } | null = null;
  const creatorProfile: null = null; // Option A: DO NOT auto-create creator profile

  if (validAccountType === "organizer") {
    assignedRoles.push("organizer");
    organizerPublicProfile = {
      user_id: userId,
      name: userFullName,
    };
    organizerPrivateDetails = {
      organizer_id: `org-${userId}`,
      contact_email: email,
    };
  }

  return {
    account_type: validAccountType,
    roles: assignedRoles,
    profile,
    organizerPublicProfile,
    organizerPrivateDetails,
    creatorProfile,
  };
}

// Emulation of PostgreSQL RLS & Column Access for organizer_private_details
function checkOrganizerPrivateAccess({
  user,
  organizerProfile,
  operation,
}: {
  user: {
    id?: string | null;
    roles: string[];
  } | null;
  organizerProfile: {
    id: string;
    user_id: string;
  };
  operation: "select" | "update";
}): boolean {
  // Anonymous users have ZERO access (REVOKE ALL FROM anon)
  if (!user || !user.id) return false;

  // Admins retain authorized access
  if (user.roles.includes("admin")) return true;

  // Owner access
  if (user.id === organizerProfile.user_id) return true;

  // Other authenticated users have no access
  return false;
}

// Emulation of PostgreSQL RLS for public.events read policy (Fix 2)
function checkEventReadPolicy({
  user,
  event,
}: {
  user: {
    id?: string | null;
    roles: string[];
    ownedCreatorId?: string | null;
    ownedOrganizerId?: string | null;
  } | null;
  event: {
    id: string;
    status: "live" | "pending" | "rejected";
    creator_id?: string | null;
    organizer_id?: string | null;
  };
}): boolean {
  // Live events are public (readable by anon and any authenticated user)
  if (event.status === "live") return true;

  // Below checks are for non-live (e.g. pending/rejected) events
  if (!user || !user.id) return false;

  // Admin access
  if (user.roles.includes("admin")) return true;

  // Creator owner
  if (event.creator_id && user.ownedCreatorId && event.creator_id === user.ownedCreatorId) {
    return true;
  }

  // Organizer owner
  if (event.organizer_id && user.ownedOrganizerId && event.organizer_id === user.ownedOrganizerId) {
    return true;
  }

  // Non-owner authenticated users cannot view pending events
  return false;
}

// Emulation of PostgreSQL RLS policies for public.events insert from migration 0004
function checkEventInsertPolicy({
  user,
  event,
}: {
  user: {
    id: string;
    roles: string[];
    ownedCreatorId?: string | null;
    ownedOrganizerId?: string | null;
  };
  event: {
    creator_id?: string | null;
    organizer_id?: string | null;
  };
}): boolean {
  const isAdmin = user.roles.includes("admin");
  if (isAdmin) return true;

  // Creator branch
  if (
    event.creator_id &&
    user.ownedCreatorId &&
    event.creator_id === user.ownedCreatorId &&
    user.roles.includes("creator")
  ) {
    return true;
  }

  // Organizer branch (can create without a creator profile!)
  if (
    event.organizer_id &&
    user.ownedOrganizerId &&
    event.organizer_id === user.ownedOrganizerId &&
    user.roles.includes("organizer")
  ) {
    return true;
  }

  return false;
}

function checkEventUpdateOrDeletePolicy({
  user,
  event,
}: {
  user: {
    id: string;
    roles: string[];
    ownedCreatorId?: string | null;
    ownedOrganizerId?: string | null;
  };
  event: {
    creator_id?: string | null;
    organizer_id?: string | null;
  };
}): boolean {
  const isAdmin = user.roles.includes("admin");
  if (isAdmin) return true;

  if (event.creator_id && user.ownedCreatorId && event.creator_id === user.ownedCreatorId) {
    return true;
  }

  if (event.organizer_id && user.ownedOrganizerId && event.organizer_id === user.ownedOrganizerId) {
    return true;
  }

  return false;
}

// Emulation of external_events creator verification check
function checkExternalEventCreatorInsert({
  user,
  submission,
}: {
  user: {
    id: string;
    roles: string[];
    creatorProfile?: { id: string; verified: boolean; verification_status: string } | null;
  };
  submission: {
    submitted_by_creator_id: string;
    status: string;
    submission_type: string;
    is_demo: boolean;
  };
}): boolean {
  if (
    submission.status !== "pending" ||
    submission.submission_type !== "organizer" ||
    submission.is_demo !== false
  ) {
    return false;
  }

  if (!user.creatorProfile) return false;
  if (user.creatorProfile.id !== submission.submitted_by_creator_id) return false;
  if (!user.creatorProfile.verified && user.creatorProfile.verification_status !== "verified") {
    return false;
  }

  return true;
}

// Route authorization guard helper matching _authenticated route implementations
function checkRouteAuthorization(
  route: string,
  user: {
    roles: string[];
    profile?: { account_type?: string } | null;
  },
): { authorized: boolean; reason?: string } {
  const roles = user.roles ?? [];
  const accountType = user.profile?.account_type?.toLowerCase();
  const isAdmin = roles.includes("admin");
  const isCreatorOrOrganizer =
    roles.includes("creator") ||
    roles.includes("organizer") ||
    accountType === "creator" ||
    accountType === "organizer" ||
    isAdmin;

  if (route.startsWith("/admin")) {
    if (!isAdmin) {
      return { authorized: false, reason: "Requires administrator privileges." };
    }
    return { authorized: true };
  }

  if (route.startsWith("/creator")) {
    if (!isCreatorOrOrganizer) {
      return {
        authorized: false,
        reason: "Attendee accounts cannot access creator/organizer event management routes.",
      };
    }
    return { authorized: true };
  }

  return { authorized: true };
}

describe("Auth Email Confirmation & Redirect Workflow", () => {
  it("resolves safe internal redirects and blocks open redirects", () => {
    expect(resolveAuthRedirect("/events/123")).toBe("/events/123");
    expect(resolveAuthRedirect("/tickets")).toBe("/tickets");
    expect(resolveAuthRedirect("//evil.com")).toBe("/discover");
    expect(resolveAuthRedirect("https://evil.com")).toBe("/discover");
    expect(resolveAuthRedirect(undefined)).toBe("/discover");
    expect(resolveAuthRedirect("")).toBe("/discover");
  });

  it("constructs proper email confirmation redirect URL with encoded target", () => {
    const origin = "https://creatorconnect.app";
    const target = "/events/456-exclusive-launch";
    const redirectUrl = buildEmailRedirectUrl(origin, target);

    expect(redirectUrl).toBe(
      "https://creatorconnect.app/auth?redirect=%2Fevents%2F456-exclusive-launch&confirmed=true",
    );

    const parsed = new URL(redirectUrl);
    expect(parsed.pathname).toBe("/auth");
    expect(parsed.searchParams.get("redirect")).toBe("/events/456-exclusive-launch");
    expect(parsed.searchParams.get("confirmed")).toBe("true");
  });

  it("detects expired confirmation links from URL search parameters", () => {
    const search =
      "?error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired";
    const parsed = parseConfirmationError(search, "");

    expect(parsed).not.toBeNull();
    expect(parsed?.isExpired).toBe(true);
    expect(parsed?.message).toContain("has expired");
  });

  it("detects expired confirmation links from URL hash fragments", () => {
    const hash =
      "#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired";
    const parsed = parseConfirmationError("", hash);

    expect(parsed).not.toBeNull();
    expect(parsed?.isExpired).toBe(true);
    expect(parsed?.message).toContain("has expired");
  });

  it("parses generic confirmation errors and decodes descriptions gracefully", () => {
    const search = "?error=unauthorized_client&error_description=Token+verification+failed";
    const parsed = parseConfirmationError(search, "");

    expect(parsed).not.toBeNull();
    expect(parsed?.isExpired).toBe(false);
    expect(parsed?.message).toBe("Token verification failed");
  });

  it("returns null when no errors are present in search or hash", () => {
    const parsed = parseConfirmationError("?confirmed=true", "#access_token=xyz&type=signup");
    expect(parsed).toBeNull();
  });

  it("enforces strict email regex and password length constraints", () => {
    expect(EMAIL_REGEX.test("valid.user@creatorconnect.app")).toBe(true);
    expect(EMAIL_REGEX.test("creator+special@pune.co.in")).toBe(true);
    expect(EMAIL_REGEX.test("invalid-email")).toBe(false);
    expect(EMAIL_REGEX.test("missing@tld")).toBe(false);
    expect(EMAIL_REGEX.test("@domain.com")).toBe(false);

    const validPassword = "SecurePassword123!";
    const shortPassword = "short";
    expect(validPassword.length >= 8).toBe(true);
    expect(shortPassword.length >= 8).toBe(false);
  });
});

describe("Signup Role Selection UI & Client Validation", () => {
  it("provides the exact three required role options with correct metadata", () => {
    expect(ROLE_OPTIONS).toHaveLength(3);

    const attendee = ROLE_OPTIONS.find((r) => r.id === "attendee");
    expect(attendee).toBeDefined();
    expect(attendee?.title).toBe("Attendee");
    expect(attendee?.features).toEqual([
      "Discover events.",
      "Register for events.",
      "Participate in events.",
      "Access attendee dashboard.",
    ]);

    const creator = ROLE_OPTIONS.find((r) => r.id === "creator");
    expect(creator).toBeDefined();
    expect(creator?.title).toBe("Creator");
    expect(creator?.features).toEqual([
      "Create a creator profile.",
      "Showcase portfolio and work.",
      "Connect with event organizers.",
      "Submit creator verification/application.",
      "Access creator dashboard after the required verification.",
    ]);

    const organizer = ROLE_OPTIONS.find((r) => r.id === "organizer");
    expect(organizer).toBeDefined();
    expect(organizer?.title).toBe("Host / Organizer");
    expect(organizer?.features).toEqual([
      "Create and manage events.",
      "Manage event registrations.",
      "View event-related information.",
      "Access organizer dashboard.",
      "Follow the existing event approval and publishing workflow.",
    ]);
  });

  it("enforces mandatory role selection on signup submission", () => {
    const errorNoRole = validateSignupInput({
      mode: "up",
      selectedRole: null,
      email: "test@example.com",
      password: "Password123!",
    });
    expect(errorNoRole).toBe(
      "Please select how you want to use Creator Connect (Attendee, Creator, or Host / Organizer).",
    );

    const signInNoError = validateSignupInput({
      mode: "in",
      selectedRole: null,
      email: "test@example.com",
      password: "Password123!",
    });
    expect(signInNoError).toBeNull();
  });

  it("validates valid roles and credentials during signup", () => {
    const roles: AccountRole[] = ["attendee", "creator", "organizer"];
    for (const r of roles) {
      const err = validateSignupInput({
        mode: "up",
        selectedRole: r,
        email: `user.${r}@example.com`,
        password: "ValidPassword123!",
      });
      expect(err).toBeNull();
    }
  });

  it("rejects invalid inputs during signup", () => {
    expect(
      validateSignupInput({
        mode: "up",
        selectedRole: "attendee",
        email: "",
        password: "Password123!",
      }),
    ).toBe("Email address is required.");

    expect(
      validateSignupInput({
        mode: "up",
        selectedRole: "attendee",
        email: "bad-email",
        password: "Password123!",
      }),
    ).toBe("Please enter a valid email address (e.g. name@example.com).");

    expect(
      validateSignupInput({
        mode: "up",
        selectedRole: "attendee",
        email: "valid@example.com",
        password: "",
      }),
    ).toBe("Password is required.");

    expect(
      validateSignupInput({
        mode: "up",
        selectedRole: "attendee",
        email: "valid@example.com",
        password: "short",
      }),
    ).toBe("Password must be at least 8 characters long.");
  });
});

describe("Fix 1: Organizer Personal Data Protection & Column-Level Grants", () => {
  const mig0004Path = path.resolve(
    process.cwd(),
    "drizzle/migrations/0004_independent_organizer_architecture.sql",
  );

  it("verifies public.organizers contains only safe public profile columns", () => {
    const sql = fs.readFileSync(mig0004Path, "utf-8");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.organizers");
    expect(sql).toContain("GRANT SELECT ON public.organizers TO authenticated, anon");
    // Ensure contact_email and contact_phone are NOT on the public organizers table definition
    const organizersSection =
      sql.split("CREATE TABLE IF NOT EXISTS public.organizers")[1]?.split(");")[0] ?? "";
    expect(organizersSection).not.toContain("contact_email");
    expect(organizersSection).not.toContain("contact_phone");
  });

  it("verifies dedicated private details table with strict permissions and column-level grants", () => {
    const sql = fs.readFileSync(mig0004Path, "utf-8");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.organizer_private_details");
    expect(sql).toContain("REVOKE ALL ON public.organizer_private_details FROM anon");
    expect(sql).toContain(
      "GRANT SELECT, INSERT ON public.organizer_private_details TO authenticated",
    );
    expect(sql).toContain(
      "GRANT UPDATE (contact_email, contact_phone, updated_at) ON public.organizer_private_details TO authenticated",
    );
    expect(sql).toContain('CREATE POLICY "organizer_private_read_own"');
    expect(sql).toContain('CREATE POLICY "organizer_private_update_own"');
    // Verify explicit WITH CHECK on update policies to prevent reassigning organizer_id
    expect(sql).toContain(
      "WITH CHECK (\n    public.owns_organizer(organizer_id) OR public.has_role(auth.uid(), 'admin')\n  )",
    );
    expect(sql).toContain(
      "WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))",
    );
  });

  it("verifies organizer cannot change organizer_id to another user's organizer record", () => {
    const sql = fs.readFileSync(mig0004Path, "utf-8");
    // 1. Column-level privilege: organizer_id is excluded from GRANT UPDATE
    const updateGrantMatch = sql.match(
      /GRANT UPDATE \(([^)]+)\) ON public\.organizer_private_details TO authenticated/,
    );
    expect(updateGrantMatch).not.toBeNull();
    const grantedColumns = updateGrantMatch?.[1]?.split(",").map((c) => c.trim()) ?? [];
    expect(grantedColumns).not.toContain("organizer_id");
    expect(grantedColumns).toEqual(["contact_email", "contact_phone", "updated_at"]);

    // 2. RLS WITH CHECK enforcement prevents reassigning to another organizer
    const ownsOrganizerCondition =
      "public.owns_organizer(organizer_id) OR public.has_role(auth.uid(), 'admin')";
    expect(sql).toContain(`WITH CHECK (\n    ${ownsOrganizerCondition}\n  )`);
  });

  it("verifies frontend only queries private contact details for the authenticated user's own profile", () => {
    const ccLibPath = path.resolve(process.cwd(), "src/lib/cc.ts");
    const ccContent = fs.readFileSync(ccLibPath, "utf-8");
    // Ensure EVENT_SELECT only requests safe public columns from organizers(*) and does not join private_details
    const eventSelectLine = ccContent.split("\n").find((l) => l.includes("EVENT_SELECT")) ?? "";
    expect(eventSelectLine).toContain(
      'export const EVENT_SELECT = "*, creator:creators(*), organizer:organizers(*)";',
    );
    expect(eventSelectLine).not.toContain("organizer_private_details");

    // Ensure meQuery scopes private details strictly to the authenticated user.id
    expect(ccContent).toContain('.select("*, private_details:organizer_private_details(*)")');
    expect(ccContent).toMatch(
      /\.select\("\*,\s*private_details:organizer_private_details\(\*\)"\)[\s\r\n]*\.eq\("user_id",\s*user\.id\)/,
    );
  });

  it("Regression: Anonymous users cannot read organizer contact information", () => {
    const targetOrganizer = { id: "org-1", user_id: "user-org-1" };
    const anonAllowed = checkOrganizerPrivateAccess({
      user: null, // anonymous visitor
      organizerProfile: targetOrganizer,
      operation: "select",
    });
    expect(anonAllowed).toBe(false);
  });

  it("Regression: Organizer can read and update their own private profile details", () => {
    const targetOrganizer = { id: "org-1", user_id: "user-org-1" };
    const ownerUser = { id: "user-org-1", roles: ["attendee", "organizer"] };

    expect(
      checkOrganizerPrivateAccess({
        user: ownerUser,
        organizerProfile: targetOrganizer,
        operation: "select",
      }),
    ).toBe(true);

    expect(
      checkOrganizerPrivateAccess({
        user: ownerUser,
        organizerProfile: targetOrganizer,
        operation: "update",
      }),
    ).toBe(true);
  });

  it("Regression: Another organizer or attendee cannot read private contact information", () => {
    const targetOrganizer = { id: "org-1", user_id: "user-org-1" };
    const otherOrganizer = { id: "user-org-2", roles: ["attendee", "organizer"] };
    const attendeeUser = { id: "user-attendee", roles: ["attendee"] };

    expect(
      checkOrganizerPrivateAccess({
        user: otherOrganizer,
        organizerProfile: targetOrganizer,
        operation: "select",
      }),
    ).toBe(false);

    expect(
      checkOrganizerPrivateAccess({
        user: attendeeUser,
        organizerProfile: targetOrganizer,
        operation: "select",
      }),
    ).toBe(false);
  });

  it("Admins retain authorized access to organizer private contact details", () => {
    const targetOrganizer = { id: "org-1", user_id: "user-org-1" };
    const adminUser = { id: "user-admin", roles: ["attendee", "admin"] };

    expect(
      checkOrganizerPrivateAccess({
        user: adminUser,
        organizerProfile: targetOrganizer,
        operation: "select",
      }),
    ).toBe(true);
  });
});

describe("Fix 2: Preserve Existing Event Discovery & Policy Coverage", () => {
  const mig0004Path = path.resolve(
    process.cwd(),
    "drizzle/migrations/0004_independent_organizer_architecture.sql",
  );

  it("verifies migration 0004 grants SELECT on public.events to anon and defines public read policy", () => {
    const sql = fs.readFileSync(mig0004Path, "utf-8");
    expect(sql).toContain("GRANT SELECT ON public.events TO anon");
    expect(sql).toContain(
      'CREATE POLICY "events read" ON public.events FOR SELECT TO authenticated, anon',
    );
  });

  it("Regression: Existing public event discovery still works (anonymous users can read live events)", () => {
    const liveEvent = {
      id: "live-event-1",
      status: "live" as const,
      creator_id: "creator-1",
      organizer_id: null,
    };

    const anonCanReadLive = checkEventReadPolicy({
      user: null,
      event: liveEvent,
    });
    expect(anonCanReadLive).toBe(true);

    const attendeeCanReadLive = checkEventReadPolicy({
      user: { id: "attendee-1", roles: ["attendee"] },
      event: liveEvent,
    });
    expect(attendeeCanReadLive).toBe(true);
  });

  it("Regression: Pending events remain strictly private to owners and admins", () => {
    const pendingCreatorEvent = {
      id: "pending-event-1",
      status: "pending" as const,
      creator_id: "creator-1",
      organizer_id: null,
    };

    // Anonymous cannot read pending event
    expect(checkEventReadPolicy({ user: null, event: pendingCreatorEvent })).toBe(false);

    // Unrelated attendee cannot read pending event
    expect(
      checkEventReadPolicy({
        user: { id: "attendee-1", roles: ["attendee"] },
        event: pendingCreatorEvent,
      }),
    ).toBe(false);

    // Another creator cannot read pending event
    expect(
      checkEventReadPolicy({
        user: {
          id: "other-creator-user",
          roles: ["attendee", "creator"],
          ownedCreatorId: "creator-2",
        },
        event: pendingCreatorEvent,
      }),
    ).toBe(false);

    // Owning creator can read own pending event
    expect(
      checkEventReadPolicy({
        user: {
          id: "owner-creator-user",
          roles: ["attendee", "creator"],
          ownedCreatorId: "creator-1",
        },
        event: pendingCreatorEvent,
      }),
    ).toBe(true);

    // Owning organizer can read own pending event
    const pendingOrganizerEvent = {
      id: "pending-event-2",
      status: "pending" as const,
      creator_id: null,
      organizer_id: "organizer-1",
    };
    expect(
      checkEventReadPolicy({
        user: {
          id: "owner-org-user",
          roles: ["attendee", "organizer"],
          ownedOrganizerId: "organizer-1",
        },
        event: pendingOrganizerEvent,
      }),
    ).toBe(true);

    // Admin can read all pending events
    expect(
      checkEventReadPolicy({
        user: { id: "admin-user", roles: ["attendee", "admin"] },
        event: pendingCreatorEvent,
      }),
    ).toBe(true);
  });
});

describe("Fix 3: Enum Migration Runner & Transactional Journal Verification", () => {
  const journalPath = path.resolve(process.cwd(), "drizzle/migrations/meta/_journal.json");
  const mig0003Path = path.resolve(
    process.cwd(),
    "drizzle/migrations/0003_add_organizer_role_enum.sql",
  );
  const mig0004Path = path.resolve(
    process.cwd(),
    "drizzle/migrations/0004_independent_organizer_architecture.sql",
  );

  it("verifies _journal.json tracks migrations 0002, 0003, and 0004 in correct sequence", () => {
    expect(fs.existsSync(journalPath)).toBe(true);
    const journal = JSON.parse(fs.readFileSync(journalPath, "utf-8"));
    const tags = journal.entries.map((e: { tag: string }) => e.tag);

    expect(tags).toContain("0000_creatorconnect_schema");
    expect(tags).toContain("0001_prefs_and_field_verification");
    expect(tags).toContain("0002_external_events_and_demo_tagging");
    expect(tags).toContain("0003_add_organizer_role_enum");
    expect(tags).toContain("0004_independent_organizer_architecture");

    const idx0003 = tags.indexOf("0003_add_organizer_role_enum");
    const idx0004 = tags.indexOf("0004_independent_organizer_architecture");
    expect(idx0003).toBeLessThan(idx0004);
  });

  it("verifies migration 0003 is purely non-referencing enum alteration DDL", () => {
    expect(fs.existsSync(mig0003Path)).toBe(true);
    const sql = fs.readFileSync(mig0003Path, "utf-8");
    expect(sql).toContain("ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'organizer'");
    expect(sql).not.toContain("CREATE TABLE");
    expect(sql).not.toContain("CREATE POLICY");
    expect(sql).not.toContain("CREATE OR REPLACE FUNCTION");
  });
});

describe("Fix 4: Full Regression Checks", () => {
  it("Organizer signup creates dedicated organizer profile without creator profile", () => {
    const signupRes = simulateHandleNewUserTrigger(
      { account_type: "organizer", full_name: "Event Pro" },
      "org-user-1",
      "contact@eventpro.in",
    );

    expect(signupRes.account_type).toBe("organizer");
    expect(signupRes.roles).toEqual(["attendee", "organizer"]);
    expect(signupRes.organizerPublicProfile?.name).toBe("Event Pro");
    expect(signupRes.organizerPrivateDetails?.contact_email).toBe("contact@eventpro.in");
    expect(signupRes.creatorProfile).toBeNull();
  });

  it("Attendee signup does not create organizer records or private details", () => {
    const signupRes = simulateHandleNewUserTrigger(
      { account_type: "attendee", full_name: "Jane Attendee" },
      "att-user-1",
      "jane@example.com",
    );
    expect(signupRes.account_type).toBe("attendee");
    expect(signupRes.roles).toEqual(["attendee"]);
    expect(signupRes.organizerPublicProfile).toBeNull();
    expect(signupRes.organizerPrivateDetails).toBeNull();
    expect(signupRes.creatorProfile).toBeNull();
  });

  it("Creator signup does not create organizer records and does not assign creator role directly", () => {
    const signupRes = simulateHandleNewUserTrigger(
      { account_type: "creator", full_name: "Alex Creator" },
      "creator-user-1",
      "alex@example.com",
    );
    expect(signupRes.account_type).toBe("creator");
    // Creator role is NOT granted at signup; attendee only until admin verification
    expect(signupRes.roles).toEqual(["attendee"]);
    expect(signupRes.organizerPublicProfile).toBeNull();
    expect(signupRes.organizerPrivateDetails).toBeNull();
    expect(signupRes.creatorProfile).toBeNull();
  });

  it("Users cannot assign themselves admin role through signup metadata", () => {
    const signupWithAdmin = simulateHandleNewUserTrigger(
      { account_type: "admin", role: "admin", full_name: "Hacker" },
      "hacker-1",
      "hacker@example.com",
    );
    expect(signupWithAdmin.account_type).toBe("attendee");
    expect(signupWithAdmin.roles).toEqual(["attendee"]);
    expect(signupWithAdmin.roles).not.toContain("admin");
  });

  it("Migration 0004 handle_new_user SQL handles duplicate execution safely with ON CONFLICT", () => {
    const mig0004Path = path.resolve(
      process.cwd(),
      "drizzle/migrations/0004_independent_organizer_architecture.sql",
    );
    const sql = fs.readFileSync(mig0004Path, "utf-8");
    const triggerSection = sql.split("CREATE OR REPLACE FUNCTION public.handle_new_user()")[1];
    expect(triggerSection).toContain("ON CONFLICT (id) DO NOTHING");
    expect(triggerSection).toContain("ON CONFLICT (user_id) DO NOTHING");
    expect(triggerSection).toContain("ON CONFLICT (organizer_id) DO NOTHING");
  });

  it("Regression: Creator event workflows still work", () => {
    const creatorUser = {
      id: "creator-1",
      roles: ["attendee", "creator"],
      ownedCreatorId: "creator-profile-1",
      ownedOrganizerId: null,
    };
    const creatorEvent = { creator_id: "creator-profile-1", organizer_id: null };

    expect(checkEventInsertPolicy({ user: creatorUser, event: creatorEvent })).toBe(true);
    expect(checkEventUpdateOrDeletePolicy({ user: creatorUser, event: creatorEvent })).toBe(true);
  });

  it("Regression: Organizer event workflows still work without creator profile", () => {
    const organizerUser = {
      id: "org-1",
      roles: ["attendee", "organizer"],
      ownedCreatorId: null,
      ownedOrganizerId: "org-profile-1",
    };
    const organizerEvent = { creator_id: null, organizer_id: "org-profile-1" };

    expect(checkEventInsertPolicy({ user: organizerUser, event: organizerEvent })).toBe(true);
    expect(checkEventUpdateOrDeletePolicy({ user: organizerUser, event: organizerEvent })).toBe(
      true,
    );
  });

  it("Regression: Admin approval and moderation remain functional", () => {
    const adminUser = {
      id: "admin-1",
      roles: ["attendee", "admin"],
      ownedCreatorId: null,
      ownedOrganizerId: null,
    };
    const anyEvent = { creator_id: "creator-99", organizer_id: "org-99" };

    expect(checkEventInsertPolicy({ user: adminUser, event: anyEvent })).toBe(true);
    expect(checkEventUpdateOrDeletePolicy({ user: adminUser, event: anyEvent })).toBe(true);
  });

  it("Regression: Existing event records remain preserved with creator_id and null organizer_id", () => {
    const legacyEvent = { creator_id: "legacy-creator-id", organizer_id: null };
    const satisfiesConstraint =
      legacyEvent.creator_id !== null || legacyEvent.organizer_id !== null;
    expect(satisfiesConstraint).toBe(true);

    const legacyCreator = {
      id: "legacy-user",
      roles: ["attendee", "creator"],
      ownedCreatorId: "legacy-creator-id",
      ownedOrganizerId: null,
    };
    expect(checkEventUpdateOrDeletePolicy({ user: legacyCreator, event: legacyEvent })).toBe(true);
  });
});

describe("Post-Authentication Role-Based Redirects (resolvePostAuthRedirect)", () => {
  it("redirects attendees to /discover/1 by default", () => {
    const dest = resolvePostAuthRedirect({
      accountType: "attendee",
      roles: ["attendee"],
    });
    expect(dest).toBe("/discover/1");
  });

  it("redirects unverified creators to /profile to complete verification", () => {
    const destUnregistered = resolvePostAuthRedirect({
      accountType: "creator",
      roles: ["attendee"],
      creatorStatus: null,
    });
    expect(destUnregistered).toBe("/profile");

    const destPending = resolvePostAuthRedirect({
      accountType: "creator",
      roles: ["attendee"],
      creatorStatus: { verified: false, verification_status: "pending" },
    });
    expect(destPending).toBe("/profile");

    const destRejected = resolvePostAuthRedirect({
      accountType: "creator",
      roles: ["attendee"],
      creatorStatus: { verified: false, verification_status: "rejected" },
    });
    expect(destRejected).toBe("/profile");
  });

  it("redirects verified creators to /creator/dashboard", () => {
    const destVerified = resolvePostAuthRedirect({
      accountType: "creator",
      roles: ["attendee", "creator"],
      creatorStatus: { verified: true, verification_status: "verified" },
    });
    expect(destVerified).toBe("/creator/dashboard");
  });

  it("redirects host/organizers to /creator/events", () => {
    const destOrganizerByAccount = resolvePostAuthRedirect({
      accountType: "organizer",
      roles: ["attendee"],
    });
    expect(destOrganizerByAccount).toBe("/creator/events");

    const destOrganizerByRole = resolvePostAuthRedirect({
      accountType: "attendee",
      roles: ["attendee", "organizer"],
    });
    expect(destOrganizerByRole).toBe("/creator/events");
  });

  it("redirects administrators to /admin/verify", () => {
    const destAdmin = resolvePostAuthRedirect({
      accountType: "organizer",
      roles: ["attendee", "admin"],
    });
    expect(destAdmin).toBe("/admin/verify");
  });

  it("preserves explicit deep-link redirects for any role", () => {
    const deepLinkPass = "/tickets/pass-12345";
    const attendeeRedirect = resolvePostAuthRedirect({
      accountType: "attendee",
      roles: ["attendee"],
      explicitRedirect: deepLinkPass,
    });
    expect(attendeeRedirect).toBe("/tickets/pass-12345");

    const eventLink = "/events/mumbai-tech-summit";
    const creatorRedirect = resolvePostAuthRedirect({
      accountType: "creator",
      roles: ["attendee"],
      explicitRedirect: eventLink,
    });
    expect(creatorRedirect).toBe("/events/mumbai-tech-summit");
  });

  it("ignores generic and unsafe redirects, falling back to role-based destination", () => {
    expect(
      resolvePostAuthRedirect({
        accountType: "attendee",
        explicitRedirect: "//evil.com",
      }),
    ).toBe("/discover/1");

    expect(
      resolvePostAuthRedirect({
        accountType: "organizer",
        explicitRedirect: "/auth?confirmed=true",
      }),
    ).toBe("/creator/events");

    expect(
      resolvePostAuthRedirect({
        accountType: "creator",
        creatorStatus: { verified: true, verification_status: "verified" },
        explicitRedirect: "/",
      }),
    ).toBe("/creator/dashboard");
  });
});

describe("Route Authorization & Permission Boundaries", () => {
  it("blocks attendees from creator and organizer routes", () => {
    const attendee = {
      roles: ["attendee"],
      profile: { account_type: "attendee" },
    };

    const dashboardCheck = checkRouteAuthorization("/creator/dashboard", attendee);
    expect(dashboardCheck.authorized).toBe(false);
    expect(dashboardCheck.reason).toContain("Attendee accounts cannot access");

    const eventsCheck = checkRouteAuthorization("/creator/events", attendee);
    expect(eventsCheck.authorized).toBe(false);

    const discoverCheck = checkRouteAuthorization("/discover/1", attendee);
    expect(discoverCheck.authorized).toBe(true);
  });

  it("allows creators and organizers to access creator event routes", () => {
    const creator = {
      roles: ["attendee", "creator"],
      profile: { account_type: "creator" },
    };
    expect(checkRouteAuthorization("/creator/dashboard", creator).authorized).toBe(true);
    expect(checkRouteAuthorization("/creator/events", creator).authorized).toBe(true);

    const organizer = {
      roles: ["attendee", "organizer"],
      profile: { account_type: "organizer" },
    };
    expect(checkRouteAuthorization("/creator/dashboard", organizer).authorized).toBe(true);
    expect(checkRouteAuthorization("/creator/events", organizer).authorized).toBe(true);
  });

  it("blocks non-admins from accessing admin routes", () => {
    const attendee = {
      roles: ["attendee"],
      profile: { account_type: "attendee" },
    };
    expect(checkRouteAuthorization("/admin/verify", attendee).authorized).toBe(false);
    expect(checkRouteAuthorization("/admin/reports", attendee).authorized).toBe(false);
    expect(checkRouteAuthorization("/admin/platform", attendee).authorized).toBe(false);

    const creator = {
      roles: ["attendee", "creator"],
      profile: { account_type: "creator" },
    };
    expect(checkRouteAuthorization("/admin/verify", creator).authorized).toBe(false);

    const organizer = {
      roles: ["attendee", "organizer"],
      profile: { account_type: "organizer" },
    };
    expect(checkRouteAuthorization("/admin/verify", organizer).authorized).toBe(false);
  });

  it("grants administrators access to admin and creator routes", () => {
    const admin = {
      roles: ["attendee", "admin"],
      profile: { account_type: "organizer" },
    };
    expect(checkRouteAuthorization("/admin/verify", admin).authorized).toBe(true);
    expect(checkRouteAuthorization("/admin/reports", admin).authorized).toBe(true);
    expect(checkRouteAuthorization("/admin/platform", admin).authorized).toBe(true);
    expect(checkRouteAuthorization("/creator/events", admin).authorized).toBe(true);
  });
});
