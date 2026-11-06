import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    agentFeedback: true,
    // A curriculum or fee-structure PDF is uploaded through a Server Action, and the
    // default 1MB body cap rejects most real ones. Files are additionally capped in
    // code at UPLOAD_MAX_BYTES, which leaves room for the multipart overhead this
    // limit counts as well.
    serverActions: { bodySizeLimit: "12mb" },
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
