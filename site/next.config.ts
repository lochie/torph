import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["torph", "@torph/test-cases"],
};

export default nextConfig;
