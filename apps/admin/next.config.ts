import type { NextConfig } from "next";

// Data is fetched in the browser through Supabase (RLS + realtime), so pages
// are client-rendered; Cache Components is left off on purpose.
const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  images: { unoptimized: true },
};

export default nextConfig;
