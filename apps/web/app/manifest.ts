import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "299 RELAY",
    short_name: "299 RELAY",
    description: "Campus errands, carried by students already on the way.",
    start_url: "/",
    display: "standalone",
    background_color: "#0B1F44",
    theme_color: "#0B1F44",
    icons: [{ src: "/brand/mark.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
