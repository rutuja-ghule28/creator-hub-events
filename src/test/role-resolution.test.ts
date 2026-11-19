import { describe, it, expect } from "vitest";
import { resolveUserRole, type Me } from "@/lib/cc";

describe("Role Resolution & Priority Hierarchy (resolveUserRole)", () => {
  it("resolves Attendee role correctly for attendee users", () => {
    const attendeeUser: Me = {
      id: "att-1",
      email: "attendee@example.com",
      profile: {
        id: "att-1",
        account_type: "attendee",
        full_name: "Jane Attendee",
        avatar_url: null,
        city: "Pune",
        email: "attendee@example.com",
        phone: null,
        notify_enabled: true,
        suspended: false,
        created_at: new Date().toISOString(),
      },
      roles: ["attendee"],
      creator: null,
      organizer: null,
    };

    const resolved = resolveUserRole(attendeeUser);
    expect(resolved.primaryRole).toBe("attendee");
    expect(resolved.badgeLabel).toBe("Attendee");
    expect(resolved.displayTitle).toBe("Attendee");
    expect(resolved.badgeClass).toContain("bg-brand/10");
  });

  it("resolves Pending Creator for users whose application is under review", () => {
    const pendingCreatorUser: Me = {
      id: "creator-pending-1",
      email: "pending@creator.com",
      profile: {
        id: "creator-pending-1",
        account_type: "creator",
        full_name: "Sam Artist",
        avatar_url: null,
        city: "Pune",
        email: "pending@creator.com",
        phone: null,
        notify_enabled: true,
        suspended: false,
        created_at: new Date().toISOString(),
      },
      // Note: During signup or while under review, public.user_roles only has 'attendee'
      roles: ["attendee"],
      creator: {
        id: "c-rec-1",
        user_id: "creator-pending-1",
        display_name: "Sam Artist",
        avatar_url: null,
        bio: "Sketch artist",
        category: "Artist",
        location: "Pune",
        verified: false,
        verification_status: "pending",
        audience_size: 1500,
        contact_email: "pending@creator.com",
        contact_phone: null,
        portfolio_links: ["https://instagram.com/samart"],
        verification_docs: [],
        verified_fields: [],
        page_views: 0,
        is_demo: false,
        created_at: new Date().toISOString(),
      },
      organizer: null,
    };

    const resolved = resolveUserRole(pendingCreatorUser);
    expect(resolved.primaryRole).toBe("creator");
    expect(resolved.badgeLabel).toBe("Creator (Pending)");
    expect(resolved.displayTitle).toBe("Creator (Under Review)");
    expect(resolved.badgeClass).toContain("bg-amber-500/10");
  });

  it("resolves Creator (Pending) when signed up as creator but creator profile is not yet initialized", () => {
    const freshCreatorSignup: Me = {
      id: "fresh-creator-1",
      email: "fresh@creator.com",
      profile: {
        id: "fresh-creator-1",
        account_type: "creator",
        full_name: "Fresh Creator",
        avatar_url: null,
        city: "Pune",
        email: "fresh@creator.com",
        phone: null,
        notify_enabled: true,
        suspended: false,
        created_at: new Date().toISOString(),
      },
      roles: ["attendee"],
      creator: null,
      organizer: null,
    };

    const resolved = resolveUserRole(freshCreatorSignup);
    expect(resolved.primaryRole).toBe("creator");
    expect(resolved.badgeLabel).toBe("Creator (Pending)");
    expect(resolved.displayTitle).toBe("Creator (Under Review)");
  });

  it("resolves Verified Creator for approved creators", () => {
    const verifiedCreatorUser: Me = {
      id: "creator-verified-1",
      email: "verified@creator.com",
      profile: {
        id: "creator-verified-1",
        account_type: "creator",
        full_name: "Elena Musician",
        avatar_url: null,
        city: "Pune",
        email: "verified@creator.com",
        phone: null,
        notify_enabled: true,
        suspended: false,
        created_at: new Date().toISOString(),
      },
      roles: ["attendee", "creator"],
      creator: {
        id: "c-rec-2",
        user_id: "creator-verified-1",
        display_name: "Elena",
        avatar_url: null,
        bio: "Singer-songwriter",
        category: "Musician",
        location: "Pune",
        verified: true,
        verification_status: "verified",
        audience_size: 25000,
        contact_email: "elena@music.com",
        contact_phone: null,
        portfolio_links: ["https://youtube.com/elena"],
        verification_docs: [],
        verified_fields: ["name", "portfolio"],
        page_views: 120,
        is_demo: false,
        created_at: new Date().toISOString(),
      },
      organizer: null,
    };

    const resolved = resolveUserRole(verifiedCreatorUser);
    expect(resolved.primaryRole).toBe("creator");
    expect(resolved.badgeLabel).toBe("Creator");
    expect(resolved.displayTitle).toBe("Verified Creator");
    expect(resolved.badgeClass).toContain("bg-trust-soft");
  });

  it("resolves Organizer for organizer accounts despite attendee being in roles[0]", () => {
    const organizerUser: Me = {
      id: "org-user-1",
      email: "host@eventpro.in",
      profile: {
        id: "org-user-1",
        account_type: "organizer",
        full_name: "Event Pro Host",
        avatar_url: null,
        city: "Pune",
        email: "host@eventpro.in",
        phone: null,
        notify_enabled: true,
        suspended: false,
        created_at: new Date().toISOString(),
      },
      // In PostgreSQL, attendee is inserted first, so roles is ['attendee', 'organizer']
      roles: ["attendee", "organizer"],
      creator: null,
      organizer: {
        id: "org-rec-1",
        user_id: "org-user-1",
        name: "Event Pro",
        bio: "Curating premier tech meetups in Pune",
        website_url: "https://eventpro.in",
        location: "Pune",
        avatar_url: null,
        created_at: new Date().toISOString(),
        private_details: {
          id: "priv-1",
          organizer_id: "org-rec-1",
          contact_email: "host@eventpro.in",
          contact_phone: "+91 9876543210",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      },
    };

    const resolved = resolveUserRole(organizerUser);
    expect(resolved.primaryRole).toBe("organizer");
    expect(resolved.badgeLabel).toBe("Organizer");
    expect(resolved.displayTitle).toBe("Event Organizer & Host");
    expect(resolved.badgeClass).toContain("bg-blue-500/10");
  });

  it("resolves Admin for administrators with multiple roles", () => {
    const adminUser: Me = {
      id: "admin-user-1",
      email: "admin@creatorconnect.app",
      profile: {
        id: "admin-user-1",
        account_type: "attendee",
        full_name: "Platform Admin",
        avatar_url: null,
        city: "Pune",
        email: "admin@creatorconnect.app",
        phone: null,
        notify_enabled: true,
        suspended: false,
        created_at: new Date().toISOString(),
      },
      roles: ["attendee", "admin"],
      creator: null,
      organizer: null,
    };

    const resolved = resolveUserRole(adminUser);
    expect(resolved.primaryRole).toBe("admin");
    expect(resolved.badgeLabel).toBe("Admin");
    expect(resolved.displayTitle).toBe("Platform Administrator");
    expect(resolved.badgeClass).toContain("bg-purple-500/10");
  });

  it("enforces Priority 1: Admin > Organizer > Verified Creator", () => {
    // Edge case: User who has admin, organizer, and creator roles
    const multiRoleUser: Me = {
      id: "multi-role-1",
      email: "multi@example.com",
      profile: {
        id: "multi-role-1",
        account_type: "organizer",
        full_name: "Super User",
        avatar_url: null,
        city: "Pune",
        email: "multi@example.com",
        phone: null,
        notify_enabled: true,
        suspended: false,
        created_at: new Date().toISOString(),
      },
      roles: ["attendee", "creator", "organizer", "admin"],
      creator: {
        id: "c-multi",
        user_id: "multi-role-1",
        display_name: "Super",
        avatar_url: null,
        bio: "",
        category: "Tech reviewer",
        location: "Pune",
        verified: true,
        verification_status: "verified",
        audience_size: 5000,
        contact_email: "multi@example.com",
        contact_phone: null,
        portfolio_links: [],
        verification_docs: [],
        verified_fields: [],
        page_views: 0,
        is_demo: false,
        created_at: new Date().toISOString(),
      },
      organizer: {
        id: "o-multi",
        user_id: "multi-role-1",
        name: "Super Org",
        bio: "",
        website_url: null,
        location: "Pune",
        avatar_url: null,
        created_at: new Date().toISOString(),
      },
    };

    const resolvedAdmin = resolveUserRole(multiRoleUser);
    expect(resolvedAdmin.primaryRole).toBe("admin");
    expect(resolvedAdmin.badgeLabel).toBe("Admin");

    // Remove admin: should now resolve to Organizer (Priority 2 over Creator)
    const orgAndCreatorUser: Me = {
      ...multiRoleUser,
      roles: ["attendee", "creator", "organizer"],
    };
    const resolvedOrg = resolveUserRole(orgAndCreatorUser);
    expect(resolvedOrg.primaryRole).toBe("organizer");
    expect(resolvedOrg.badgeLabel).toBe("Organizer");
  });

  it("handles null and undefined gracefully with attendee fallback", () => {
    expect(resolveUserRole(null)).toEqual({
      primaryRole: "attendee",
      badgeLabel: "Attendee",
      displayTitle: "Attendee",
      badgeClass: "bg-brand/10 text-primary border-brand/20",
      description: "Explore upcoming events, reserve tickets, and follow favorite creators.",
    });

    expect(resolveUserRole(undefined)).toEqual({
      primaryRole: "attendee",
      badgeLabel: "Attendee",
      displayTitle: "Attendee",
      badgeClass: "bg-brand/10 text-primary border-brand/20",
      description: "Explore upcoming events, reserve tickets, and follow favorite creators.",
    });
  });
});
