import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/school",
    name: "AdrianOS Learning",
    short_name: "AdrianOS",
    description: "A parent-managed learning playground with personalized child profiles, educational games, and School Mode.",
    start_url: "/school?source=installed-app",
    scope: "/",
    display: "standalone",
    background_color: "#10131b",
    theme_color: "#10131b",
    orientation: "portrait-primary",
    lang: "en-US",
    categories: ["education", "kids", "games"],
    icons: [
      { src: "/icons/adrianos-192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/adrianos-512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/adrianos-512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Start School Mode", short_name: "School", description: "Open the active learner's guided route.", url: "/school?source=app-shortcut", icons: [{ src: "/icons/adrianos-192", sizes: "192x192", type: "image/png" }] },
      { name: "Choose a game", short_name: "Games", description: "Open the AdrianOS learning game shelf.", url: "/?source=app-shortcut", icons: [{ src: "/icons/adrianos-192", sizes: "192x192", type: "image/png" }] },
      { name: "Parent Mode", short_name: "Parent", description: "Open family progress and settings.", url: "/parent?source=app-shortcut", icons: [{ src: "/icons/adrianos-192", sizes: "192x192", type: "image/png" }] },
    ],
  };
}
