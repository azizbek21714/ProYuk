import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false,
  output: "standalone",
  allowedDevOrigins: ["172.16.34.185"],
};

export default nextConfig;
