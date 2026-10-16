import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CreatorConnect — Meet Creators in Person" },
      {
        name: "description",
        content:
          "Discover official creator meetups, workshops, and exclusive launches in Pune. Reserve your verified tickets today.",
      },
      { property: "og:site_name", content: "CreatorConnect" },
      { property: "og:title", content: "CreatorConnect — Meet Creators in Person" },
      {
        property: "og:description",
        content:
          "Discover official creator meetups, workshops, and exclusive launches in Pune. Reserve your verified tickets today.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://creatorconnect.app/" },
      { property: "og:image", content: "https://creatorconnect.app/assets/og-image.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "CreatorConnect — Meet Creators in Person" },
      {
        name: "twitter:description",
        content:
          "Discover official creator meetups, workshops, and exclusive launches in Pune. Reserve your verified tickets today.",
      },
      { name: "twitter:image", content: "https://creatorconnect.app/assets/og-image.png" },
    ],
    links: [{ rel: "canonical", href: "https://creatorconnect.app/" }],
  }),
  beforeLoad: () => {
    throw redirect({ to: "/discover" });
  },
});
