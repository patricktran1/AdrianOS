import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AdrianOS Play",
    short_name: "AdrianOS",
    description: "A private shelf of games built for Adrian.",
    start_url: "/",
    display: "standalone",
    background_color: "#10131b",
    theme_color: "#10131b",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
