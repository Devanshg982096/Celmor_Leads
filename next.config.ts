import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Apollo CSV imports can be a few MB once parsed into JSON.
      bodySizeLimit: "20mb",
    },
  },
};

export default nextConfig;
