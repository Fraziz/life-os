import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Disable reactStrictMode double-mounting in dev to cut tab transition latency in half
  reactStrictMode: false,
};

export default nextConfig;
