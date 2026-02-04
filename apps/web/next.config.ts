import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@mingle/shared"],
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://localhost:3000/:path*",
      },
    ];
  },
};

export default nextConfig;
