import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CreatorConnect — Find creator events in Pune" },
      {
        name: "description",
        content:
          "Meet your favourite creators in person. Find official meetups, workshops and launches.",
      },
      { property: "og:title", content: "CreatorConnect — Find creator events in Pune" },
      {
        property: "og:description",
        content:
          "Meet your favourite creators in person. Find official meetups, workshops and launches.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  beforeLoad: () => {
    throw redirect({ to: "/discover" });
  },
});
