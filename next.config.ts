import type { NextConfig } from "next";

const sections = [
  "dashboard",
  "accounts",
  "transactions",
  "finance",
  "planning",
  "notifications",
  "workspace",
  "reports",
  "profile",
] as const;

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  async rewrites() {
    return sections.map((section) => ({
      source: `/${section}`,
      destination: `/?view=${section}`,
    }));
  },
};

export default nextConfig;
