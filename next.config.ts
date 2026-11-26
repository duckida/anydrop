import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The Anycubic client runs in Node route handlers and talks to the cloud.
  serverExternalPackages: ["@vercel/blob"],
};

export default nextConfig;
