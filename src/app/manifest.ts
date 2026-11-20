import type { MetadataRoute } from "next";
import { APP } from "@/lib/config";

/** Lets the demo be installed to a phone's home screen and open full-screen like an app. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${APP.name} — talk with ${APP.companion}`,
    short_name: APP.name,
    description: `${APP.companion}, a ${APP.role} working alongside ${APP.careTeam}.`,
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0a1514",
    theme_color: "#0a1514",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
