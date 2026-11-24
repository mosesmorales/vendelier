import type { NextConfig } from "next";

const config: NextConfig = {
  transpilePackages: ["@vendelier/api-client", "@vendelier/ui"],
};

export default config;
