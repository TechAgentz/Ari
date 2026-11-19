import type { NextConfig } from "next";

/**
 * Demo configuration.
 * Payments, subscriptions, billing and accounts are disabled in this MVP demo.
 * Any legacy commercial/account route is redirected to the dashboard in guest mode.
 */
const DISABLED_ROUTES = [
  "/pricing",
  "/billing",
  "/checkout",
  "/subscribe",
  "/subscription",
  "/subscriptions",
  "/upgrade",
  "/plans",
  "/account",
  "/login",
  "/signin",
  "/signup",
  "/register",
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async redirects() {
    return DISABLED_ROUTES.flatMap((source) => [
      { source, destination: "/?notice=demo", permanent: false },
      { source: `${source}/:path*`, destination: "/?notice=demo", permanent: false },
    ]);
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Frame-Options", value: "DENY" },
          // Microphone is needed for the voice conversation screen (same origin only).
          { key: "Permissions-Policy", value: "microphone=(self), camera=(), geolocation=(), payment=()" },
        ],
      },
      {
        source: "/api/:path*",
        headers: [{ key: "Cache-Control", value: "no-store" }],
      },
    ];
  },
};

export default nextConfig;
