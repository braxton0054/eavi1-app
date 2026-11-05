import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: false,
  // The Docker image ships only .next/standalone plus the traced files it needs.
  output: "standalone",
  outputFileTracingIncludes: {
    // Prisma's generated client and the driver-adapter runtime are loaded through
    // dynamic requires, so static tracing cannot always see them.
    "/*": [
      "generated/**/*",
      "node_modules/@prisma/client/**/*",
      "node_modules/@prisma/adapter-pg/**/*",
      "node_modules/@prisma/client-runtime-utils/**/*",
    ],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
