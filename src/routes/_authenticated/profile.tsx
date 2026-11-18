import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  User,
  Bell,
  Shield,
  LogOut,
  Save,
  Sparkles,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Mail,
  Smartphone,
  RefreshCw,
  BadgeCheck,
  Clock,
  AlertTriangle,
  ExternalLink,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ALERT_KINDS, NICHES, errMsg, fmtCount, useMe } from "@/lib/cc";
import { Avatar } from "@/components/cc";
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

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Your Profile & Settings — CreatorConnect" },
      {
        name: "description",
        content:
          "Manage your CreatorConnect attendee account, notifications preferences, and verification details.",
      },
      { property: "og:site_name", content: "CreatorConnect" },
      { property: "og:title", content: "Your Profile & Settings — CreatorConnect" },
      {
        property: "og:description",
        content:
          "Manage your CreatorConnect attendee account, notifications preferences, and verification details.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://creatorconnect.app/profile" },
      { property: "og:image", content: "https://creatorconnect.app/assets/og-image.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Your Profile & Settings — CreatorConnect" },
      {
        name: "twitter:description",
        content:
          "Manage your CreatorConnect attendee account, notifications preferences, and verification details.",
      },
      { name: "twitter:image", content: "https://creatorconnect.app/assets/og-image.png" },
    ],
    links: [{ rel: "canonical", href: "https://creatorconnect.app/profile" }],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<"account" | "notifications" | "role">("account");

  // Account form
  const [fullName, setFullName] = useState(me?.profile?.full_name ?? "");
  const [phone, setPhone] = useState(me?.profile?.phone ?? "");
  const [city, setCity] = useState(me?.profile?.city ?? "Pune");
  const [saving, setSaving] = useState(false);

  // Sync profile fields when me query resolves
  useEffect(() => {
    if (me?.profile) {
      setFullName(me.profile.full_name ?? "");
      setPhone(me.profile.phone ?? "");
      setCity(me.profile.city ?? "Pune");
    }
  }, [me]);

  // Load persistent notification preferences from Supabase
  const prefsQuery = useQuery({
    queryKey: ["notification_preferences", me?.id],
    enabled: Boolean(me?.id),
    queryFn: async () => {
      if (!me?.id) return [];
      const { data, error } = await supabase
        .from("notification_preferences")
        .select("*")
        .eq("user_id", me.id);
      if (error) throw error;
      return (data ?? []) as {
        user_id: string;
        kind: string;
        in_app: boolean;
        email: boolean;
      }[];
    },
  });

  const [savingChannel, setSavingChannel] = useState<string | null>(null);

  // Derived state for master toggles
  const masterInApp = me?.profile?.notify_enabled ?? true;
  const anyEmailEnabled = (prefsQuery.data ?? []).some((p) => p.email);

  // Save changes immediately for a specific alert kind and channel
  const handleToggleKind = async (
    kind: string,
    channel: "in_app" | "email",
    currentVal: boolean,
  ) => {
    if (!me?.id) {
      toast.error("You must be logged in to update preferences.");
      return;
    }

    const row = prefsQuery.data?.find((p) => p.kind === kind);
    const nextInApp = channel === "in_app" ? !currentVal : (row ? row.in_app : true);
    const nextEmail = channel === "email" ? !currentVal : (row ? row.email : false);
    const key = `${kind}-${channel}`;

    setSavingChannel(key);
    try {
      const { error } = await supabase.from("notification_preferences").upsert(
        {
          user_id: me.id,
          kind,
          in_app: nextInApp,
          email: nextEmail,
        },
        { onConflict: "user_id,kind" },
      );

      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["notification_preferences", me.id] });
      toast.success("Preference updated");
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setSavingChannel(null);
    }
  };

  // Master In-App Toggle (updates profiles.notify_enabled and all kinds)
  const handleToggleMasterInApp = async (current: boolean) => {
    if (!me?.id) {
      toast.error("You must be logged in to update preferences.");
      return;
    }
    const nextVal = !current;
    setSavingChannel("master-inapp");
    try {
      const { error: profileErr } = await supabase
        .from("profiles")
        .update({ notify_enabled: nextVal })
        .eq("id", me.id);
      if (profileErr) throw profileErr;

      const rows = ALERT_KINDS.map((k) => {
        const row = prefsQuery.data?.find((p) => p.kind === k.kind);
        return {
          user_id: me.id,
          kind: k.kind,
          in_app: nextVal,
          email: row ? row.email : false,
        };
      });

      const { error: prefsErr } = await supabase
        .from("notification_preferences")
        .upsert(rows, { onConflict: "user_id,kind" });
      if (prefsErr) throw prefsErr;

      await Promise.all([
        qc.invalidateQueries({ queryKey: ["me"] }),
        qc.invalidateQueries({ queryKey: ["notification_preferences", me.id] }),
      ]);
      toast.success(nextVal ? "In-app notifications enabled" : "In-app notifications muted");
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setSavingChannel(null);
    }
  };

  // Master Email Toggle (updates all alert kinds in notification_preferences)
  const handleToggleMasterEmail = async (current: boolean) => {
    if (!me?.id) {
      toast.error("You must be logged in to update preferences.");
      return;
    }
    const nextVal = !current;
    setSavingChannel("master-email");
    try {
      const rows = ALERT_KINDS.map((k) => {
        const row = prefsQuery.data?.find((p) => p.kind === k.kind);
        return {
          user_id: me.id,
          kind: k.kind,
          in_app: row ? row.in_app : true,
          email: nextVal,
        };
      });

      const { error } = await supabase
        .from("notification_preferences")
        .upsert(rows, { onConflict: "user_id,kind" });
      if (error) throw error;

      await qc.invalidateQueries({ queryKey: ["notification_preferences", me.id] });
      toast.success(nextVal ? "Email notifications enabled" : "Email notifications muted");
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setSavingChannel(null);
    }
  };

  const handleAccountSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!me?.id) return;

    setSaving(true);
    try {
      const { error } = await supabase.from("profiles").upsert({
        id: me.id,
        full_name: fullName.trim(),
        phone: phone.trim() || null,
        city: city.trim() || null,
      });

      if (error) throw error;
      toast.success("Profile updated successfully!");
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setSaving(false);
    }
  };

  // Creator application dialog & form state
  const [isApplyOpen, setIsApplyOpen] = useState(false);
  const [appDisplayName, setAppDisplayName] = useState("");
  const [appCategory, setAppCategory] = useState("Artist");
  const [appLocation, setAppLocation] = useState("Pune");
  const [appBio, setAppBio] = useState("");
  const [appAudienceSize, setAppAudienceSize] = useState("");
  const [appContactEmail, setAppContactEmail] = useState("");
  const [appContactPhone, setAppContactPhone] = useState("");
  const [appPortfolioLinks, setAppPortfolioLinks] = useState("");
  const [appSubmitting, setAppSubmitting] = useState(false);

  const handleOpenApplyModal = () => {
    if (me?.creator) {
      toast.info("You already have an existing creator application or profile.");
      return;
    }
    setAppDisplayName(me?.profile?.full_name ?? "");
    setAppCategory("Artist");
    setAppLocation(me?.profile?.city ?? "Pune");
    setAppBio("");
    setAppAudienceSize("");
    setAppContactEmail(me?.email ?? "");
    setAppContactPhone(me?.profile?.phone ?? "");
    setAppPortfolioLinks("");
    setIsApplyOpen(true);
  };

  const handleApplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!me?.id) {
      toast.error("You must be logged in to apply.");
      return;
    }

    // 1. Prevent duplicate applications
    if (me.creator) {
      toast.error("You already have an active creator application or profile.");
      return;
    }

    // 2. Validate all required fields
    if (appDisplayName.trim().length < 2) {
      toast.error("Creator name must be at least 2 characters.");
      return;
    }
    if (!appCategory) {
      toast.error("Please select a primary niche/category.");
      return;
    }
    if (appLocation.trim().length < 2) {
      toast.error("Please provide your city/location.");
      return;
    }
    if (appBio.trim().length < 10) {
      toast.error("Bio must be at least 10 characters long.");
      return;
    }
    const aud = parseInt(appAudienceSize, 10);
    if (isNaN(aud) || aud < 0) {
      toast.error("Audience size must be a non-negative number.");
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!appContactEmail.trim() || !emailRegex.test(appContactEmail.trim())) {
      toast.error("Please provide a valid contact email.");
      return;
    }

    const rawLinks = appPortfolioLinks
      .split(/[\n,]/)
      .map((l) => l.trim())
      .filter(Boolean);

    const urlRegex = /^https?:\/\/.+/i;
    const validLinks = rawLinks.filter((l) => urlRegex.test(l));
    if (validLinks.length === 0) {
      toast.error("Please provide at least one valid portfolio link (starting with http:// or https://).");
      return;
    }

    setAppSubmitting(true);
    try {
      const { error } = await supabase.from("creators").insert({
        user_id: me.id,
        display_name: appDisplayName.trim(),
        category: appCategory.trim(),
        location: appLocation.trim(),
        bio: appBio.trim(),
        audience_size: aud,
        contact_email: appContactEmail.trim(),
        contact_phone: appContactPhone.trim() || null,
        portfolio_links: validLinks,
        verification_status: "pending",
        verified: false,
        avatar_url: me.profile?.avatar_url ?? null,
      });

      if (error) {
        if (error.code === "23505") {
          throw new Error("A creator application already exists for this account.");
        }
        throw error;
      }

      toast.success("Creator application submitted! It is now pending review.");
      setIsApplyOpen(false);
      await qc.invalidateQueries({ queryKey: ["me"] });
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setAppSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = "/auth";
  };

  return (
    <main className="px-4 py-5 md:px-6 md:py-8 pb-24">
      {/* Page Header */}
      <div className="mb-8 border-b border-border pb-4">
        <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight">
          Account & Settings
        </h1>
        <p className="text-sm text-muted-foreground">
          Manage your personal profile, notifications, and account role.
        </p>
      </div>

      {/* Two-Column Layout on Desktop */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
        {/* Left Settings Nav Sidebar (md:col-span-4) */}
        <div className="md:col-span-4 space-y-4">
          <div className="rounded-3xl bg-card border border-border p-5 space-y-4 shadow-xs">
            <div className="flex items-center gap-4 border-b border-border pb-4">
              <Avatar
                name={me?.profile?.full_name ?? me?.email ?? "User"}
                src={me?.profile?.avatar_url}
                size={48}
              />
              <div className="min-w-0">
                <p className="font-semibold text-base truncate">
                  {me?.profile?.full_name || me?.email}
                </p>
                <p className="text-xs text-muted-foreground truncate">{me?.email}</p>
                <span className="mt-1 inline-block rounded-full bg-brand/10 border border-brand/20 px-2 py-0.5 text-[10px] font-bold text-primary capitalize">
                  {me?.roles?.[0] || "Attendee"}
                </span>
              </div>
            </div>

            <nav className="space-y-1">
              <button
                type="button"
                onClick={() => setActiveTab("account")}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  activeTab === "account"
                    ? "bg-brand text-primary-foreground shadow-brand"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                <User className="size-4 shrink-0" />
                <span>Personal Profile</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("notifications")}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  activeTab === "notifications"
                    ? "bg-brand text-primary-foreground shadow-brand"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                <Bell className="size-4 shrink-0" />
                <span>Notification Preferences</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("role")}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  activeTab === "role"
                    ? "bg-brand text-primary-foreground shadow-brand"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                <Shield className="size-4 shrink-0" />
                <span>Account Role & Access</span>
              </button>
            </nav>

            <div className="pt-2 border-t border-border">
              <Button
                variant="outline"
                onClick={handleSignOut}
                className="w-full gap-2 text-destructive border-destructive/30 hover:bg-destructive/10 rounded-xl"
              >
                <LogOut className="size-4" /> Sign out
              </Button>
            </div>
          </div>
        </div>

        {/* Right Settings Form Area (md:col-span-8) */}
        <div className="md:col-span-8">
          <div className="rounded-3xl bg-card border border-border p-6 shadow-xs space-y-6">
            {activeTab === "account" && (
              <form onSubmit={handleAccountSave} className="space-y-6">
                <div>
                  <h2 className="font-display text-xl font-bold">Personal Profile</h2>
                  <p className="text-xs text-muted-foreground">
                    Update your public display details.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="prof-name">Full Name</Label>
                    <Input
                      id="prof-name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="prof-email">Email Address</Label>
                    <Input
                      id="prof-email"
                      type="email"
                      value={me?.email ?? ""}
                      disabled
                      className="bg-muted opacity-70"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="prof-phone">Phone Number</Label>
                      <Input
                        id="prof-phone"
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+91 98765 43210"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="prof-city">City / Region</Label>
                      <Input
                        id="prof-city"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-4 border-t border-border">
                  <Button
                    type="submit"
                    variant="brand"
                    className="gap-2 rounded-xl"
                    disabled={saving}
                  >
                    <Save className="size-4" /> {saving ? "Saving..." : "Save changes"}
                  </Button>
                </div>
              </form>
            )}

            {activeTab === "notifications" && (
              <div className="space-y-6">
                <div>
                  <h2 className="font-display text-xl font-bold">Notification Settings</h2>
                  <p className="text-xs text-muted-foreground">
                    Manage how you receive alerts and reminders. Changes are saved immediately.
                  </p>
                </div>

                {/* Loading State */}
                {prefsQuery.isLoading && (
                  <div className="space-y-4">
                    <div className="h-20 rounded-2xl bg-muted/60 animate-pulse" />
                    <div className="h-20 rounded-2xl bg-muted/60 animate-pulse" />
                    <div className="h-64 rounded-2xl bg-muted/60 animate-pulse" />
                  </div>
                )}

                {/* Error State */}
                {prefsQuery.isError && (
                  <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-5 text-center space-y-3">
                    <AlertCircle className="size-6 text-destructive mx-auto" />
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-destructive">
                        Failed to load your notification preferences
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {errMsg(prefsQuery.error)}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => prefsQuery.refetch()}
                      className="gap-2 rounded-xl"
                    >
                      <RefreshCw className="size-3.5" /> Retry
                    </Button>
                  </div>
                )}

                {/* Preferences Form (Loaded) */}
                {!prefsQuery.isLoading && !prefsQuery.isError && (
                  <>
                    {/* Top-Level Master Channels */}
                    <div className="space-y-4">
                      <label className="flex items-center justify-between p-4 rounded-2xl border border-border bg-muted/40 cursor-pointer hover:bg-muted/60 transition-colors">
                        <div className="space-y-0.5 pr-4">
                          <div className="flex items-center gap-2">
                            <Mail className="size-4 text-primary" />
                            <p className="font-semibold text-sm">Email Notifications</p>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Receive ticket confirmations, event reminders, and campaign updates via email.
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {savingChannel === "master-email" && (
                            <Loader2 className="size-4 animate-spin text-primary" />
                          )}
                          <input
                            type="checkbox"
                            checked={anyEmailEnabled}
                            disabled={savingChannel === "master-email"}
                            onChange={() => handleToggleMasterEmail(anyEmailEnabled)}
                            className="size-5 rounded text-primary focus:ring-primary cursor-pointer disabled:opacity-50"
                          />
                        </div>
                      </label>

                      <label className="flex items-center justify-between p-4 rounded-2xl border border-border bg-muted/40 cursor-pointer hover:bg-muted/60 transition-colors">
                        <div className="space-y-0.5 pr-4">
                          <div className="flex items-center gap-2">
                            <Smartphone className="size-4 text-primary" />
                            <p className="font-semibold text-sm">In-App Push Alerts</p>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Get real-time updates when creators post new announcements or review applications.
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {savingChannel === "master-inapp" && (
                            <Loader2 className="size-4 animate-spin text-primary" />
                          )}
                          <input
                            type="checkbox"
                            checked={masterInApp}
                            disabled={savingChannel === "master-inapp"}
                            onChange={() => handleToggleMasterInApp(masterInApp)}
                            className="size-5 rounded text-primary focus:ring-primary cursor-pointer disabled:opacity-50"
                          />
                        </div>
                      </label>
                    </div>

                    {/* Per-Category Preferences */}
                    <div className="space-y-3 pt-4 border-t border-border">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-semibold">Alert Preferences by Activity</h3>
                          <p className="text-xs text-muted-foreground">
                            Customize in-app and email delivery for each alert category.
                          </p>
                        </div>
                        <div className="hidden sm:flex items-center gap-6 text-xs font-semibold text-muted-foreground pr-3">
                          <span className="w-12 text-center">In-App</span>
                          <span className="w-12 text-center">Email</span>
                        </div>
                      </div>

                      <div className="divide-y divide-border rounded-2xl border border-border overflow-hidden bg-card">
                        {ALERT_KINDS.map((ak) => {
                          const row = prefsQuery.data?.find((p) => p.kind === ak.kind);
                          const inApp = row ? row.in_app : true;
                          const email = row ? row.email : false;
                          const isSavingInApp = savingChannel === `${ak.kind}-in_app`;
                          const isSavingEmail = savingChannel === `${ak.kind}-email`;

                          return (
                            <div
                              key={ak.kind}
                              className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/30 transition-colors"
                            >
                              <div className="space-y-0.5 min-w-0 pr-2">
                                <p className="text-sm font-medium">{ak.label}</p>
                                <p className="text-xs text-muted-foreground">{ak.hint}</p>
                              </div>

                              <div className="flex items-center justify-end gap-6 shrink-0 pt-2 sm:pt-0 border-t sm:border-0 border-border/60">
                                {/* In-App Toggle */}
                                <label className="flex items-center gap-2 cursor-pointer sm:w-12 sm:justify-center">
                                  <span className="sm:hidden text-xs text-muted-foreground font-medium">
                                    In-App:
                                  </span>
                                  {isSavingInApp ? (
                                    <Loader2 className="size-4 animate-spin text-primary" />
                                  ) : (
                                    <input
                                      type="checkbox"
                                      checked={inApp}
                                      onChange={() => handleToggleKind(ak.kind, "in_app", inApp)}
                                      className="size-4 rounded text-primary focus:ring-primary cursor-pointer"
                                    />
                                  )}
                                </label>

                                {/* Email Toggle */}
                                <label className="flex items-center gap-2 cursor-pointer sm:w-12 sm:justify-center">
                                  <span className="sm:hidden text-xs text-muted-foreground font-medium">
                                    Email:
                                  </span>
                                  {isSavingEmail ? (
                                    <Loader2 className="size-4 animate-spin text-primary" />
                                  ) : (
                                    <input
                                      type="checkbox"
                                      checked={email}
                                      onChange={() => handleToggleKind(ak.kind, "email", email)}
                                      className="size-4 rounded text-primary focus:ring-primary cursor-pointer"
                                    />
                                  )}
                                </label>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Footer Persistence Status & Refresh */}
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-border">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {savingChannel ? (
                          <>
                            <Loader2 className="size-3.5 animate-spin text-primary" />
                            <span>Saving changes to Supabase...</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="size-3.5 text-trust" />
                            <span>Preferences synchronized automatically</span>
                          </>
                        )}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          prefsQuery.refetch();
                          toast.success("Preferences refreshed from Supabase!");
                        }}
                        className="rounded-xl gap-2 text-xs"
                      >
                        <RefreshCw className="size-3" /> Refresh
                      </Button>
                    </div>
                  </>
                )}
              </div>
            )}

            {activeTab === "role" && (
              <div className="space-y-6">
                <div>
                  <h2 className="font-display text-xl font-bold">Account Role & Verification</h2>
                  <p className="text-xs text-muted-foreground">
                    Your permissions across CreatorConnect.
                  </p>
                </div>

                <div className="rounded-2xl bg-muted/50 border border-border p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-sm">Current Active Role</p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {me?.roles?.join(", ") || "Attendee"}
                      </p>
                    </div>
                    <span className="px-3 py-1 rounded-full bg-trust-soft text-trust font-semibold text-xs">
                      Active
                    </span>
                  </div>
                </div>

                {/* Creator Application & Status Card */}
                {me?.creator ? (
                  me.creator.verification_status === "pending" ? (
                    <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Clock className="size-5 text-amber-500" />
                          <h3 className="font-semibold text-base">Application Under Review</h3>
                        </div>
                        <span className="px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold text-xs border border-amber-500/20">
                          Pending Verification
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Your creator application has been received and is waiting for review by platform administrators. Once reviewed, you will be notified and your creator role will be activated.
                      </p>

                      <div className="rounded-xl bg-card/70 border border-border p-4 space-y-2.5 text-xs">
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Creator Name:</span>
                          <span className="font-semibold text-foreground">{me.creator.display_name}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Primary Niche:</span>
                          <span className="font-medium text-foreground">{me.creator.category}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Base Location:</span>
                          <span className="font-medium text-foreground">{me.creator.location}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Audience Reach:</span>
                          <span className="font-medium text-foreground">{fmtCount(me.creator.audience_size)} followers</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Contact Email:</span>
                          <span className="font-medium text-foreground">{me.creator.contact_email || me.email}</span>
                        </div>
                        {me.creator.portfolio_links?.length > 0 && (
                          <div className="pt-2 border-t border-border/60">
                            <span className="text-muted-foreground block mb-1.5 font-medium">Submitted Portfolio Links:</span>
                            <div className="flex flex-wrap gap-2">
                              {me.creator.portfolio_links.map((link, idx) => (
                                <a
                                  key={idx}
                                  href={link}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline bg-muted/60 px-2.5 py-1 rounded-md"
                                >
                                  <ExternalLink className="size-3" />
                                  <span className="max-w-[220px] truncate">{link.replace(/^https?:\/\//i, "")}</span>
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 pt-1">
                        <Shield className="size-3.5 text-amber-500" />
                        <span>Duplicate applications are prevented while your application is under review.</span>
                      </div>
                    </div>
                  ) : me.creator.verification_status === "verified" ? (
                    <div className="rounded-2xl border border-trust/30 bg-trust/5 p-5 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <BadgeCheck className="size-5 text-trust" />
                          <h3 className="font-semibold text-base">Verified Creator Account</h3>
                        </div>
                        <span className="px-2.5 py-1 rounded-full bg-trust/10 text-trust font-semibold text-xs border border-trust/20">
                          Verified
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        You are an approved creator on CreatorConnect! You can publish meetups, host ticketed workshops, run campaigns, and view attendee analytics.
                      </p>

                      <div className="flex flex-wrap items-center gap-2.5 pt-2">
                        <Link
                          to="/creator/$id"
                          params={{ id: me.creator.id }}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-card border border-border hover:bg-muted transition-colors"
                        >
                          <User className="size-3.5" /> View Public Profile
                        </Link>
                        <Link
                          to="/creator/events"
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-card border border-border hover:bg-muted transition-colors"
                        >
                          <Sparkles className="size-3.5" /> Events Studio
                        </Link>
                        <Link
                          to="/creator/events/create"
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-brand text-primary-foreground hover:opacity-90 transition-opacity"
                        >
                          + Create Event
                        </Link>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="size-5 text-destructive" />
                          <h3 className="font-semibold text-base">Application Not Approved</h3>
                        </div>
                        <span className="px-2.5 py-1 rounded-full bg-destructive/10 text-destructive font-semibold text-xs border border-destructive/20">
                          Rejected
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Your previous creator application was not approved during review. You may re-apply with updated links and credentials.
                      </p>
                      <Button
                        variant="brand"
                        size="sm"
                        onClick={handleOpenApplyModal}
                        className="rounded-xl gap-2"
                      >
                        <Sparkles className="size-3.5" /> Re-Apply for Creator Status
                      </Button>
                    </div>
                  )
                ) : (
                  <div className="rounded-2xl border border-brand/30 bg-brand/5 p-5 space-y-3">
                    <h3 className="font-semibold text-sm flex items-center gap-2">
                      <Sparkles className="size-4 text-primary" /> Want to host events as a Creator?
                    </h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Apply for creator verification to publish meetups, workshops, and manage
                      attendee check-ins.
                    </p>
                    <Button
                      variant="brand"
                      size="sm"
                      onClick={handleOpenApplyModal}
                      className="rounded-xl gap-2"
                    >
                      <Sparkles className="size-3.5" /> Apply for Creator Status
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Creator Application Modal Dialog */}
      <Dialog open={isApplyOpen} onOpenChange={setIsApplyOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold font-display">
              Apply for Creator Status
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Submit your creator details for review. Once verified, you will be able to publish public events, collaborate with event organizers, and issue tickets.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleApplySubmit} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="app-name">
                Creator / Stage Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="app-name"
                value={appDisplayName}
                onChange={(e) => setAppDisplayName(e.target.value)}
                placeholder="e.g. Maya Lin, TechWithRohan"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="app-niche">
                  Primary Niche <span className="text-destructive">*</span>
                </Label>
                <select
                  id="app-niche"
                  value={appCategory}
                  onChange={(e) => setAppCategory(e.target.value)}
                  className="w-full bg-card border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  required
                >
                  {["Artist", "Musician", "Tech reviewer", "Fitness", "Food", "Comedian", "Actor", "Influencer", "Gaming", "Education", "Design", "Business"].map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="app-loc">
                  City / Location <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="app-loc"
                  value={appLocation}
                  onChange={(e) => setAppLocation(e.target.value)}
                  placeholder="Pune, MH"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="app-bio">
                Creator Bio <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="app-bio"
                value={appBio}
                onChange={(e) => setAppBio(e.target.value)}
                placeholder="Describe your craft, content focus, and the events you want to organize (min 10 characters)..."
                rows={3}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="app-audience">
                Total Audience Reach (Followers) <span className="text-destructive">*</span>
              </Label>
              <Input
                id="app-audience"
                type="number"
                min="0"
                value={appAudienceSize}
                onChange={(e) => setAppAudienceSize(e.target.value)}
                placeholder="e.g. 15000"
                required
              />
              <p className="text-[11px] text-muted-foreground">
                Total combined followers or subscribers across your channels.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="app-email">
                  Contact Email <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="app-email"
                  type="email"
                  value={appContactEmail}
                  onChange={(e) => setAppContactEmail(e.target.value)}
                  placeholder="collab@example.com"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="app-phone">Contact Phone</Label>
                <Input
                  id="app-phone"
                  type="tel"
                  value={appContactPhone}
                  onChange={(e) => setAppContactPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="app-portfolio">
                Portfolio & Social Links <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="app-portfolio"
                value={appPortfolioLinks}
                onChange={(e) => setAppPortfolioLinks(e.target.value)}
                placeholder="https://youtube.com/@channel&#10;https://instagram.com/handle&#10;https://myportfolio.com"
                rows={3}
                required
              />
              <p className="text-[11px] text-muted-foreground">
                Enter at least 1 valid URL starting with http:// or https:// (one per line or comma-separated).
              </p>
            </div>

            <DialogFooter className="pt-3 border-t border-border flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsApplyOpen(false)}
                disabled={appSubmitting}
                className="rounded-xl"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="brand"
                disabled={appSubmitting}
                className="rounded-xl gap-2"
              >
                {appSubmitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Submitting...
                  </>
                ) : (
                  <>
                    <Sparkles className="size-4" /> Submit Application
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </main>
  );
}
