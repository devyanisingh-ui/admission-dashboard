import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A package-lock.json in the user's home folder otherwise confuses workspace-root detection.
  outputFileTracingRoot: process.cwd(),
};

export default nextConfig;
