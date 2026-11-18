import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/discover")({
  beforeLoad: ({ location }) => {
    // 301 Permanent Redirect for SEO from /discover to /discover/1
    if (location.pathname === "/discover" || location.pathname === "/discover/") {
      throw redirect({
        to: "/discover/1",
        statusCode: 301,
      });
    }
  },
  head: () => ({
    links: [{ rel: "canonical", href: "https://creatorconnect.app/discover/1" }],
  }),
  component: () => <Outlet />,
});
