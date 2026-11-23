import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    agentFeedback: true,
    agentUpgrade: "security",
    // A curriculum or fee-structure PDF is uploaded through a Server Action, and the
    // default 1MB body cap rejects most real ones. Files are additionally capped in
    // code at UPLOAD_MAX_BYTES, which leaves room for the multipart overhead this
    // limit counts as well.
    serverActions: { bodySizeLimit: "12mb" },
  },
  cacheComponents: false,
  /*
   * Turn off the framework advertisement.
   *
   * `X-Powered-By: Next.js` tells anyone scanning that the site runs a known stack and roughly
   * which version family, which is free information for choosing an exploit. It costs nothing
   * to omit and the framework's own release notes are public anyway.
   */
  poweredByHeader: false,
  /**
   * Browser security headers, applied to every response.
   *
   * These are the defences that do not depend on the application getting anything right: they
   * bound what a page may load, refuse to be framed, and stop a browser second-guessing the
   * Content-Type. The CSP is deliberately conservative rather than maximal: the app emits
   * inline styles throughout and the chat runs over a websocket, so a policy that forbade those
   * would break the product and get removed — a policy that holds beats a perfect one that
   * does not survive the first deploy.
   */
  async headers() {
    const scriptSrc = ["'self'", "'unsafe-inline'"];
    // Next.js dev builds eval modules; production does not, so the relaxation stays in dev.
    if (process.env.NODE_ENV !== "production") scriptSrc.push("'unsafe-eval'");

    const csp = [
      "default-src 'self'",
      `script-src ${scriptSrc.join(" ")}`,
      // Inline style attributes are used for the card and letter artwork.
      "style-src 'self' 'unsafe-inline'",
      /*
       * Card artwork inlines its images as data URIs, and the signed-in card preview draws the
       * student photograph from the object store. The host is read from the environment so a
       * deployment on another bucket does not silently lose every picture.
       */
      `img-src 'self' data: blob:${storageOrigin()}`, 
      "font-src 'self' data:",
      // The chat is same-origin; the ws: forms are needed for its socket in development.
      `connect-src 'self'${process.env.NODE_ENV === "production" ? "" : " ws: wss:"}`,
      // PDFs and card batches are rendered in an iframe from this origin.
      "frame-src 'self'",
      // The card batch's PDF viewer is an <object> whose data comes from the portal's own
      // /file route; 'none' here blocked the plugin data and broke the preview.
      "object-src 'self'",
      "base-uri 'self'",
      // No form may post to another origin, which is the cheap way to exfiltrate a session.
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join("; ");

    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          // Belt and braces with frame-ancestors, for browsers that ignore the directive.
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Nothing on this site needs a camera, a microphone or a location.
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
          },
          /*
           * HSTS for two years, subdomains included.
           *
           * Only ever sent over HTTPS, which is how browsers treat the header regardless. The
           * `preload` flag is left off on purpose: it is near-permanent and belongs to the
           * domain owner's decision, not to an application deploy.
           */
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
        ],
      },
    ];
  },
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
  /*
   * Tailwind compiles only the legacy sheet.
   *
   * The rule used to match `*.css`, which also swallowed every CSS Module: Tailwind
   * handled the file as a plain stylesheet, the module's class map came back empty, and
   * every component rendered with no class at all. Component modules are ordinary CSS
   * and must reach the bundler untouched. The entry is enough — Tailwind v4 scans the
   * source tree for the classes it needs.
   */
  turbopack: {
    rules: {
      "**/globals.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

/**
 * The object store's origin, for the CSP image list.
 *
 * Read from the same variable the storage module uses, so there is one source of truth for
 * where photographs live. Empty when unset, which leaves the policy at `'self' data: blob:`.
 */
function storageOrigin(): string {
  // The image is built in CI where S3_ENDPOINT may not be passed as a build arg.
  // This is a public bucket host in a public CSP allow-list, not a secret — keep a
  // default so a published image never silently blocks every profile photo.
  const endpoint = (process.env.S3_ENDPOINT || "https://usc1.contabostorage.com").replace(/\/$/, "");
  if (!endpoint) return "";
  try {
    return ` ${new URL(endpoint).origin}`;
  } catch {
    return "";
  }
}

export default nextConfig;
