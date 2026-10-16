import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { User, Bell, Shield, LogOut, Save, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { errMsg, useMe } from "@/lib/cc";
import { Avatar } from "@/components/cc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
  const [activeTab, setActiveTab] = useState<"account" | "notifications" | "role">("account");

  // Account form
  const [fullName, setFullName] = useState(me?.profile?.full_name ?? "");
  const [phone, setPhone] = useState(me?.profile?.phone ?? "");
  const [city, setCity] = useState(me?.profile?.city ?? "Pune");
  const [saving, setSaving] = useState(false);

  // Notifications toggles
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [inAppAlerts, setInAppAlerts] = useState(true);

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
                    Manage how you receive alerts and reminders.
                  </p>
                </div>

                <div className="space-y-4">
                  <label className="flex items-center justify-between p-4 rounded-2xl border border-border bg-muted/40 cursor-pointer hover:bg-muted/60 transition-colors">
                    <div className="space-y-0.5">
                      <p className="font-semibold text-sm">Email Notifications</p>
                      <p className="text-xs text-muted-foreground">
                        Receive ticket confirmations and event reminders via email.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={emailAlerts}
                      onChange={(e) => setEmailAlerts(e.target.checked)}
                      className="size-5 rounded text-primary focus:ring-primary"
                    />
                  </label>

                  <label className="flex items-center justify-between p-4 rounded-2xl border border-border bg-muted/40 cursor-pointer hover:bg-muted/60 transition-colors">
                    <div className="space-y-0.5">
                      <p className="font-semibold text-sm">In-App Push Alerts</p>
                      <p className="text-xs text-muted-foreground">
                        Get real-time updates when creators post new announcements.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={inAppAlerts}
                      onChange={(e) => setInAppAlerts(e.target.checked)}
                      className="size-5 rounded text-primary focus:ring-primary"
                    />
                  </label>
                </div>

                <div className="flex justify-end pt-4 border-t border-border">
                  <Button
                    variant="brand"
                    onClick={() => toast.success("Preferences saved!")}
                    className="rounded-xl"
                  >
                    Save Preferences
                  </Button>
                </div>
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

                {!me?.roles?.includes("creator") && (
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
                      onClick={() => toast.info("Creator application submitted for review!")}
                    >
                      Apply for Creator Status
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
