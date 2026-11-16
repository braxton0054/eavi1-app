/**
 * Bundles the custom server and the queue worker to plain JavaScript.
 *
 * Next's App Router depends on AsyncLocalStorage, which breaks under `tsx`'s CJS transform,
 * and this Node build has no native TypeScript. Pre-compiling once removes both problems and
 * leaves files the production image can simply `node` — no loader, no transform at runtime.
 */
import { build } from "esbuild";

await build({
  entryPoints: ["server.ts"],
  outfile: "server.mjs",
  bundle: true,
  platform: "node",
  target: "node22",
  /*
   * ESM with our own code bundled and node_modules left external. ESM is required because
   * Next's bundle defines __dirname through `import.meta.url`, which only exists in an ES
   * module. Bundling our sources — rather than leaving them to a loader — is what lets the
   * extensionless subpaths inside our own files resolve.
   */
  format: "esm",
  /*
   * Everything in node_modules stays external and is loaded at runtime. Our own modules are
   * bundled, which is what the ES module resolver needs: the repo's `@/lib/...` imports have no
   * file extension and would otherwise fail to resolve.
   */
  packages: "external",

  sourcemap: false,
  logLevel: "info",
});

await build({
  entryPoints: ["scripts/worker.ts"],
  outfile: "worker.mjs",
  bundle: true,
  platform: "node",
  target: "node22",
  // The worker has no Next dependency, but ESM keeps the bundling rules identical: one
  // resolver configuration for both entry points, so a fix to one is a fix to both.
  format: "esm",
  packages: "external",
  sourcemap: false,
  logLevel: "info",
});
