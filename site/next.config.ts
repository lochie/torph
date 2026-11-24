import createMDX from "@next/mdx";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  pageExtensions: ["ts", "tsx", "mdx"],
  transpilePackages: ["torph", "@torph/test-cases"],
};

// By name, not import: Turbopack only takes serialisable loader options.
const withMDX = createMDX({ options: { remarkPlugins: [["remark-gfm"]] } });

export default withMDX(nextConfig);
