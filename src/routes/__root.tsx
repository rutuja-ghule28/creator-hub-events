import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { Toaster } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { initSessionGuard } from "@/lib/session";

function NotFoundComponent() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">This page doesn't exist or has moved.</p>
        <div className="mt-6">
          <Link
            to="/discover"
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-brand px-5 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
          >
            Go to Discover
          </Link>
        </div>
      </div>
    </main>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error("Runtime error caught:", error);
  const router = useRouter();
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong. Try again or go back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-brand px-5 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
          >
            Try again
          </button>
          <a
            href="/discover"
            className="inline-flex min-h-11 items-center justify-center rounded-xl border bg-card px-5 text-sm font-semibold text-foreground transition hover:bg-muted"
          >
            Go to Discover
          </a>
        </div>
      </div>
    </main>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "CreatorConnect — Meet Creators in Person" },
      {
        name: "description",
        content:
          "Discover official creator meetups, exclusive workshops, live podcasts, and launches near you in Pune.",
      },
      { property: "og:site_name", content: "CreatorConnect" },
      { property: "og:title", content: "CreatorConnect — Meet Creators in Person" },
      {
        property: "og:description",
        content:
          "Discover official creator meetups, exclusive workshops, live podcasts, and launches near you in Pune.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://creatorconnect.app" },
      { property: "og:image", content: "https://creatorconnect.app/assets/og-image.png" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      {
        property: "og:image:alt",
        content: "CreatorConnect — Meet your favourite creators in person",
      },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "CreatorConnect — Meet Creators in Person" },
      {
        name: "twitter:description",
        content:
          "Discover official creator meetups, exclusive workshops, live podcasts, and launches near you in Pune.",
      },
      { name: "twitter:image", content: "https://creatorconnect.app/assets/og-image.png" },
      {
        name: "twitter:image:alt",
        content: "CreatorConnect — Meet your favourite creators in person",
      },
      { name: "theme-color", content: "#0F172A" },
    ],
    links: [
      { rel: "canonical", href: "https://creatorconnect.app" },
      { rel: "icon", href: "/favicon.ico", sizes: "any" },
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
      { rel: "icon", type: "image/png", sizes: "32x32", href: "/favicon-32x32.png" },
      { rel: "icon", type: "image/png", sizes: "16x16", href: "/favicon-16x16.png" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png" },
      { rel: "manifest", href: "/site.webmanifest" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700&family=Sora:wght@500;600;700&display=swap",
      },
      { rel: "stylesheet", href: appCss },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

const themeScript = `try{var t=localStorage.getItem('cc-theme');if(t==='dark'||(!t&&matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark')}catch(e){}`;

const jsonLdSchema = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://creatorconnect.app/#organization",
      name: "CreatorConnect",
      url: "https://creatorconnect.app",
      logo: {
        "@type": "ImageObject",
        url: "https://creatorconnect.app/assets/logo.svg",
        width: 320,
        height: 80,
      },
      description:
        "CreatorConnect is the premier platform for discovering and attending verified in-person creator meetups, workshops, and exclusive launches.",
    },
    {
      "@type": "WebSite",
      "@id": "https://creatorconnect.app/#website",
      url: "https://creatorconnect.app",
      name: "CreatorConnect",
      publisher: {
        "@id": "https://creatorconnect.app/#organization",
      },
      potentialAction: {
        "@type": "SearchAction",
        target: "https://creatorconnect.app/discover?q={search_term_string}",
        "query-input": "required name=search_term_string",
      },
    },
  ],
};

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdSchema) }}
        />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  useEffect(() => {
    initSessionGuard();
  }, []);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      router.invalidate();
      if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
    });
    return () => data.subscription.unsubscribe();
  }, [router, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-background text-foreground antialiased">
        <Outlet />
      </div>
      <Toaster position="top-center" />
    </QueryClientProvider>
  );
}
