import { Link, useRouter } from "@tanstack/react-router";
import {
  BadgeCheck,
  ShieldCheck,
  ChevronLeft,
  CalendarDays,
  MapPin,
  Sparkles,
  Compass,
  Ticket,
  Bookmark,
  Bell,
  User,
  LayoutDashboard,
  PlusCircle,
  Flag,
  BarChart3,
  Search,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { fmtDateTime, seatsLeft, type Creator, type EventWithCreator, type Me } from "@/lib/cc";

/* ---------- Generated SVG cover ---------- */
const PALETTES = [
  ["#1E6BFF", "#5B3CFF", "#D63CF2"],
  ["#FF6B3D", "#D63CF2", "#5B3CFF"],
  ["#0A8F6E", "#1E6BFF", "#5B3CFF"],
  ["#F2B33C", "#FF4D6D", "#5B3CFF"],
  ["#13C2C2", "#1E6BFF", "#0F1433"],
  ["#D63CF2", "#FF4D6D", "#F2B33C"],
];
function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export function EventCover({
  id,
  src,
  className,
  alt,
}: {
  id: string;
  src?: string | null;
  className?: string;
  alt: string;
}) {
  if (src)
    return (
      <img
        src={src}
        alt={alt || "Event cover image"}
        width={400}
        height={240}
        loading="lazy"
        decoding="async"
        className={cn("object-cover", className)}
      />
    );
  const h = hash(id);
  const [a, b, c] = PALETTES[h % PALETTES.length] ?? PALETTES[0]!;
  const tilt = (h % 30) - 15;
  const gid = `g${h}`;
  const heads = Array.from({ length: 14 }, (_, i) => ({
    x: i * 30 + ((h >> i) % 12),
    r: 11 + ((h >> (i + 2)) % 6),
  }));
  return (
    <svg
      viewBox="0 0 400 240"
      preserveAspectRatio="xMidYMid slice"
      role="img"
      aria-label={alt}
      className={className}
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={a} />
          <stop offset="0.55" stopColor={b} />
          <stop offset="1" stopColor={c} />
        </linearGradient>
        <linearGradient id={`${gid}b`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.55" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="400" height="240" fill={`url(#${gid})`} />
      <g opacity="0.7" transform={`rotate(${tilt} 200 0)`}>
        <polygon points="120,-10 150,-10 260,240 60,240" fill={`url(#${gid}b)`} />
        <polygon points="260,-10 285,-10 380,240 220,240" fill={`url(#${gid}b)`} opacity="0.7" />
      </g>
      <circle cx={80 + (h % 240)} cy="40" r="26" fill="#fff" opacity="0.18" />
      <g fill="#0F1433" opacity="0.85">
        {heads.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={205 - p.r} r={p.r} />
            <rect x={p.x - p.r - 6} y={205} width={p.r * 2 + 12} height="40" rx={p.r} />
          </g>
        ))}
      </g>
    </svg>
  );
}

/* ---------- Trust badges ---------- */
export function OfficialSeal({ className, small }: { className?: string; small?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-trust text-trust-foreground font-semibold",
        small ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs",
        className,
      )}
    >
      <ShieldCheck className={small ? "size-3" : "size-3.5"} aria-hidden /> Official event
    </span>
  );
}
export function VerifiedTick({
  show = true,
  className,
}: {
  show?: boolean | null;
  className?: string;
}) {
  if (!show) return null;
  return (
    <BadgeCheck
      className={cn("inline size-4 shrink-0 fill-primary text-primary-foreground", className)}
      aria-label="Verified creator"
    />
  );
}
export function CreatorName({
  c,
  className,
}: {
  c: Pick<Creator, "display_name" | "verified"> | null;
  className?: string;
}) {
  if (!c) return null;
  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      {c.display_name}
      <VerifiedTick show={c.verified} />
    </span>
  );
}

export function Avatar({
  name,
  src,
  size = 40,
}: {
  name: string;
  src?: string | null | undefined;
  size?: number;
}) {
  const initials = name
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("");
  if (src)
    return (
      <img
        src={src}
        alt={name ? `${name}'s profile avatar` : "Creator profile avatar"}
        width={size}
        height={size}
        loading="lazy"
        decoding="async"
        className="rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-brand font-display font-semibold text-primary-foreground"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
      aria-hidden
    >
      {initials}
    </span>
  );
}

/* ---------- Event cards ---------- */
export function EventCardLarge({ e }: { e: EventWithCreator }) {
  return (
    <Link
      to="/events/$id"
      params={{ id: e.id }}
      className="block w-[78%] shrink-0 snap-start overflow-hidden rounded-3xl bg-card shadow-sm ring-1 ring-border"
    >
      <div className="relative aspect-[5/3]">
        <EventCover id={e.id} src={e.cover_url} alt="" className="absolute inset-0 h-full w-full" />
        {e.status === "live" && <OfficialSeal small className="absolute left-3 top-3" />}
        <span className="absolute bottom-3 left-3 rounded-full bg-card/90 px-2.5 py-1 text-xs font-semibold text-foreground">
          {e.type}
        </span>
      </div>
      <div className="space-y-1 p-4">
        <h3 className="line-clamp-1 text-lg font-semibold">{e.title}</h3>
        <p className="text-sm text-muted-foreground">
          <CreatorName c={e.creator} />
        </p>
        <p className="flex items-center gap-1.5 text-sm">
          <CalendarDays className="size-4 text-primary" aria-hidden />
          {fmtDateTime(e.starts_at)}
        </p>
      </div>
    </Link>
  );
}

export function EventRowCompact({ e, right }: { e: EventWithCreator; right?: ReactNode }) {
  const left = seatsLeft(e);
  return (
    <Link
      to="/events/$id"
      params={{ id: e.id }}
      className="flex items-center gap-3 rounded-2xl bg-card p-2.5 ring-1 ring-border transition hover:ring-primary/40"
    >
      <div className="relative size-20 shrink-0 overflow-hidden rounded-xl">
        <EventCover id={e.id} src={e.cover_url} alt="" className="absolute inset-0 h-full w-full" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-0.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-primary">
          {e.type}
          {e.status === "live" && (
            <ShieldCheck className="size-3.5 text-trust" aria-label="Official event" />
          )}
        </div>
        <h3 className="line-clamp-1 font-semibold">{e.title}</h3>
        <p className="line-clamp-1 text-xs text-muted-foreground">
          <CreatorName c={e.creator} /> · {fmtDateTime(e.starts_at)}
        </p>
        <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="size-3" aria-hidden />
          {e.area}
          <span className={cn("ml-auto font-medium", left <= 20 ? "text-warn-foreground" : "")}>
            {left === 0 ? "Sold out" : `${left} left`}
          </span>
        </p>
      </div>
      {right}
    </Link>
  );
}

/* ---------- States ---------- */
export function ListSkeleton({ rows = 4, tall }: { rows?: number; tall?: boolean }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className={cn("w-full rounded-2xl", tall ? "h-40" : "h-24")} />
      ))}
    </div>
  );
}
export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-dashed bg-card/60 px-6 py-10 text-center">
      <p className="font-display text-lg font-semibold">{title}</p>
      <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">{body}</p>
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="rounded-2xl bg-destructive/10 p-4 text-sm text-destructive">
      <p className="font-semibold">Couldn't load this.</p>
      <p>{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="mt-2 min-h-11 font-semibold underline">
          Try again
        </button>
      )}
    </div>
  );
}

export function PageHeader({
  title,
  back,
  right,
}: {
  title: string;
  back?: boolean;
  right?: ReactNode;
}) {
  const router = useRouter();
  return (
    <header className="sticky top-0 z-20 flex min-h-14 items-center gap-2 bg-background/90 px-4 py-2 backdrop-blur">
      {back && (
        <button
          onClick={() => router.history.back()}
          aria-label="Go back"
          className="-ml-2 inline-flex size-11 items-center justify-center rounded-full hover:bg-muted"
        >
          <ChevronLeft className="size-5" />
        </button>
      )}
      <h1 className="flex-1 truncate text-lg font-semibold">{title}</h1>
      {right}
    </header>
  );
}

export function StatusTag({ status }: { status: string }) {
  const map: Record<string, [string, string]> = {
    live: ["Official", "bg-trust-soft text-trust"],
    pending: ["Awaiting review", "bg-warn-soft text-warn-foreground"],
    rejected: ["Rejected", "bg-destructive/10 text-destructive"],
    removed: ["Removed", "bg-destructive/10 text-destructive"],
    accepted: ["Accepted", "bg-trust-soft text-trust"],
  };
  const [label, cls] = map[status] ?? [status, "bg-muted text-muted-foreground"];
  return <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", cls)}>{label}</span>;
}

export function SeatsBar({ taken, capacity }: { taken: number; capacity: number }) {
  const left = Math.max(0, capacity - taken);
  const pct = Math.min(100, (taken / capacity) * 100);
  const warn = left <= 20;
  return (
    <div>
      <div className="mb-1.5 flex justify-between text-sm">
        <span className={cn("font-semibold", warn && "text-warn-foreground")}>
          {left === 0 ? "Sold out" : `${left} seats left`}
        </span>
        <span className="text-muted-foreground">
          {taken}/{capacity}
        </span>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={cn("h-full rounded-full", warn ? "bg-warn" : "bg-brand")}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export type Tab = {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
  highlight?: boolean;
  exact?: boolean;
};
export function TabBar({ tabs }: { tabs: Tab[] }) {
  return (
    <nav
      aria-label="Main navigation"
      className="no-print fixed inset-x-0 bottom-0 z-30 mx-auto max-w-[440px] md:hidden border-t bg-card/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <ul className="flex">
        {tabs.map((t) => (
          <li key={t.to} className="flex-1">
            <Link
              to={t.to}
              activeOptions={{ exact: !!t.exact }}
              className="group flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
              activeProps={{ className: "is-active text-foreground font-semibold" }}
            >
              <span
                className={cn(
                  "relative inline-flex h-8 w-12 items-center justify-center rounded-full transition group-[.is-active]:bg-brand group-[.is-active]:text-primary-foreground",
                  t.highlight && "bg-brand text-primary-foreground shadow-brand",
                )}
              >
                <t.icon className="size-5" />
                {!!t.badge && (
                  <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-destructive px-1 text-center text-[10px] font-bold leading-5 text-destructive-foreground">
                    {t.badge}
                  </span>
                )}
              </span>
              {t.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/* ---------- Desktop Navigation & Header Components ---------- */
export function DesktopSidebar({ me }: { me?: Me | null | undefined }) {
  const router = useRouter();
  const currentPath = router.state.location.pathname;

  const isCreator = me?.roles?.includes("creator");
  const isAdmin = me?.roles?.includes("admin");

  const attendeeNav = [
    { to: "/discover", label: "Discover", icon: Compass },
    { to: "/tickets", label: "My Tickets", icon: Ticket },
    { to: "/saved", label: "Saved Events", icon: Bookmark },
    { to: "/notifications", label: "Notifications", icon: Bell },
    { to: "/profile", label: "Profile", icon: User },
  ];

  const creatorNav = isCreator
    ? [
        { to: "/creator/dashboard", label: "Overview", icon: LayoutDashboard },
        { to: "/creator/events", label: "Events Table", icon: CalendarDays },
        { to: "/creator/events/create", label: "Create Event", icon: PlusCircle },
      ]
    : [];

  const adminNav = isAdmin
    ? [
        { to: "/admin/verify", label: "Verify Queue", icon: ShieldCheck },
        { to: "/admin/reports", label: "Reports", icon: Flag },
        { to: "/admin/platform", label: "Platform", icon: BarChart3 },
      ]
    : [];

  return (
    <aside
      aria-label="Sidebar navigation"
      className="no-print hidden md:flex flex-col fixed inset-y-0 left-0 z-30 bg-card border-r border-border transition-all duration-200 w-16 lg:w-64"
    >
      {/* Brand Header */}
      <div className="h-16 flex items-center px-3 lg:px-6 border-b border-border">
        <Link
          to="/discover"
          className="flex items-center gap-3 group rounded-xl p-1 focus-visible:ring-2 focus-visible:ring-ring"
        >
          <img
            src="/assets/logo-icon.svg"
            alt="CreatorConnect"
            width={36}
            height={36}
            className="size-9 shrink-0 transition-transform group-hover:scale-105"
          />
          <span className="hidden lg:inline font-display text-xl font-bold tracking-tight text-foreground group-hover:text-primary transition-colors">
            Creator
            <span className="bg-gradient-to-r from-brand via-primary to-rose-500 bg-clip-text text-transparent">
              Connect
            </span>
          </span>
        </Link>
      </div>

      {/* Nav List */}
      <div className="flex-1 overflow-y-auto px-2 py-4 space-y-6 no-scrollbar lg:px-4">
        {/* Explore / Attendee */}
        <div>
          <p className="hidden lg:block px-3 mb-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Explore
          </p>
          <nav className="space-y-1">
            {attendeeNav.map((item) => {
              const active =
                currentPath === item.to ||
                (item.to !== "/discover" && currentPath.startsWith(item.to));
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    active
                      ? "bg-brand text-primary-foreground shadow-brand font-semibold"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted",
                  )}
                  title={item.label}
                >
                  <item.icon className="size-5 shrink-0" />
                  <span className="hidden lg:inline truncate">{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Creator Hub */}
        {creatorNav.length > 0 && (
          <div>
            <p className="hidden lg:block px-3 mb-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Creator Hub
            </p>
            <nav className="space-y-1">
              {creatorNav.map((item) => {
                const active = currentPath === item.to || currentPath.startsWith(item.to);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      active
                        ? "bg-brand text-primary-foreground shadow-brand font-semibold"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted",
                    )}
                    title={item.label}
                  >
                    <item.icon className="size-5 shrink-0" />
                    <span className="hidden lg:inline truncate">{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        )}

        {/* Admin Portal */}
        {adminNav.length > 0 && (
          <div>
            <p className="hidden lg:block px-3 mb-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Admin Portal
            </p>
            <nav className="space-y-1">
              {adminNav.map((item) => {
                const active = currentPath === item.to || currentPath.startsWith(item.to);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      active
                        ? "bg-brand text-primary-foreground shadow-brand font-semibold"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted",
                    )}
                    title={item.label}
                  >
                    <item.icon className="size-5 shrink-0" />
                    <span className="hidden lg:inline truncate">{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        )}
      </div>

      {/* User Profile Footer */}
      {me && (
        <div className="p-2 border-t border-border lg:p-4">
          <Link
            to="/profile"
            className="flex items-center gap-3 p-2 rounded-xl hover:bg-muted transition-colors group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            title="Profile Settings"
          >
            <Avatar
              name={me.profile?.full_name ?? me.email}
              src={me.profile?.avatar_url}
              size={36}
            />
            <div className="hidden lg:block min-w-0 flex-1">
              <p className="text-sm font-semibold truncate group-hover:text-primary transition-colors">
                {me.profile?.full_name || "User Profile"}
              </p>
              <p className="text-xs text-muted-foreground truncate capitalize">
                {me.roles?.[0] || "Attendee"}
              </p>
            </div>
          </Link>
        </div>
      )}
    </aside>
  );
}

export function DesktopHeader({
  me,
  searchVal,
  setSearchVal,
  onSearchSubmit,
}: {
  me?: Me | null | undefined;
  searchVal?: string;
  setSearchVal?: (v: string) => void;
  onSearchSubmit?: (e: React.FormEvent) => void;
}) {
  const router = useRouter();
  const [localQ, setLocalQ] = useState(searchVal ?? "");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSearchSubmit) {
      onSearchSubmit(e);
    } else if (localQ.trim()) {
      router.navigate({ to: "/discover" });
    }
  };

  return (
    <header className="no-print hidden md:flex h-16 items-center justify-between border-b border-border bg-card/80 px-6 backdrop-blur sticky top-0 z-20">
      {/* Search Input */}
      <form onSubmit={handleSubmit} className="relative w-64 lg:w-96">
        <Search
          className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <input
          type="search"
          value={searchVal !== undefined ? searchVal : localQ}
          onChange={(e) => {
            if (setSearchVal) setSearchVal(e.target.value);
            else setLocalQ(e.target.value);
          }}
          placeholder="Search events, creators, venues..."
          className="w-full h-10 pl-9 pr-4 rounded-full bg-muted/60 text-sm focus:bg-background border border-transparent focus:border-ring focus:outline-none transition-all"
        />
      </form>

      {/* Right Controls */}
      <div className="flex items-center gap-3">
        {/* Location Pill */}
        <span className="inline-flex items-center gap-1.5 rounded-full bg-card border border-border px-3 py-1.5 text-xs font-semibold text-foreground shadow-xs">
          <MapPin className="size-3.5 text-primary" aria-hidden />
          Pune
        </span>

        {/* Notification Bell */}
        <Link
          to="/notifications"
          className="relative inline-flex size-10 items-center justify-center rounded-full hover:bg-muted transition-colors text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Notifications"
          title="Notifications"
        >
          <Bell className="size-5" />
          <span className="absolute top-2 right-2 size-2 rounded-full bg-destructive ring-2 ring-card" />
        </Link>

        {/* User Profile */}
        {me && (
          <Link
            to="/profile"
            className="flex items-center gap-2 rounded-full ring-2 ring-transparent hover:ring-primary/40 transition-all p-0.5 focus-visible:ring-ring"
            title="Profile & Settings"
          >
            <Avatar
              name={me.profile?.full_name ?? me.email}
              src={me.profile?.avatar_url}
              size={32}
            />
          </Link>
        )}
      </div>
    </header>
  );
}

export function Chip({
  active,
  onClick,
  children,
}: {
  active?: boolean;
  onClick?: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "min-h-11 shrink-0 rounded-full px-4 text-sm font-medium ring-1 transition",
        active
          ? "bg-foreground text-background ring-foreground"
          : "bg-card text-foreground ring-border hover:ring-primary/40",
      )}
    >
      {children}
    </button>
  );
}

export function MiniBars({
  values,
  labels,
  dark,
}: {
  values: number[];
  labels: string[];
  dark?: boolean;
}) {
  const max = Math.max(1, ...values);
  return (
    <div
      className="flex h-24 items-end gap-2"
      role="img"
      aria-label={`Bar chart: ${values.join(", ")}`}
    >
      {values.map((v, i) => (
        <div key={i} className="flex flex-1 flex-col items-center gap-1">
          <div
            className="w-full rounded-md bg-brand"
            style={{ height: `${Math.max(4, (v / max) * 72)}px`, opacity: v ? 1 : 0.3 }}
          />
          <span
            className={cn("text-[10px]", dark ? "text-ink-foreground/70" : "text-muted-foreground")}
          >
            {labels[i]}
          </span>
        </div>
      ))}
    </div>
  );
}
