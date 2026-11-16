/**
 * The portal's server.
 *
 * Next.js is started in its normal mode and every HTTP request is still handled by Next; the
 * only addition is Socket.IO riding on the same port, so the chat cannot be blocked by a
 * proxy that was never told about a second port.
 *
 * This file is only used by `npm run dev` and `npm start`. The Docker image runs the Next
 * standalone server, which is why the standalone entry point is replaced there — see the
 * Dockerfile.
 */
// Must be first: it populates the environment that every following import reads at load time.
import "./load-env";

import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { createServer } from "node:http";
import next from "next";
import { Server } from "socket.io";
import { attachChat } from "./lib/chat/socket";

const dev = process.env.NODE_ENV !== "production";
const port = Number(process.env.PORT ?? 3000);
const hostname = process.env.HOSTNAME ?? "0.0.0.0";

async function main() {
  /*
   * The bundle is written to the repo root beside package.json, so the process's working
   * directory is the app directory whether this runs from a checkout or a container.
   */
  const app = next({ dev, dir: process.cwd() });
  const handle = app.getRequestHandler();
  await app.prepare();

  /*
   * Strip the framework banner at the edge of our own server.
   *
   * `poweredByHeader: false` in next.config is set and is honoured by the framework's own
   * `sendRenderResult` — but in Next 16.4.4 the header still reaches the socket on rendered
   * HTML and API responses, verified from inside the container against the origin itself.
   * Rather than wait on that, remove it here: `setHeader` on a response that has not been
   * written yet means the last writer wins, and the framework writes its headers afterwards.
   *
   * Done on the response object *before* handing over, so every path — pages, API routes,
   * error responses — is covered by one line instead of by remembering it per route.
   */
  const httpServer = createServer((req, res) => {
    const originalWriteHead = res.writeHead;
    const strip = () => {
      if (!res.headersSent) res.removeHeader("X-Powered-By");
    };
    res.writeHead = function patchedWriteHead(this: typeof res, ...args: never[]) {
      strip();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (originalWriteHead as any).apply(this, args);
    } as typeof res.writeHead;
    handle(req, res);
  });

  const io = new Server(httpServer, {
    /*
     * Room membership is decided from the database on every socket, never from a client claim,
     * so cross-origin sockets buy an attacker nothing. Same-origin is still the default and the
     * portal is served from one origin.
     */
    cors: { origin: false },
    maxHttpBufferSize: 1e5,
  });

  attachChat(io);

  startDevWorker();

  httpServer.listen(port, hostname, () => {
    console.log(`> EAVI portal ready on http://${hostname}:${port} (chat on the same port)`);
  });
}

/**
 * Runs the queue worker beside the portal in development, so `npm run dev` needs no second
 * terminal. Production is left alone: there the worker is its own container (the `worker`
 * service in docker-compose) and must not be duplicated by the web process.
 *
 * If tsx cannot be resolved the portal still starts — the message says how to run the
 * worker by hand, because a developer without a worker must not wonder why batches sit
 * pending.
 */
let workerProcess: ReturnType<typeof spawn> | undefined;

function startDevWorker() {
  if (process.env.NODE_ENV === "production") return;

  const require = createRequire(import.meta.url);
  let tsxCli: string;
  try {
    tsxCli = require.resolve("tsx/cli");
  } catch {
    console.log("> queue worker not started (tsx not found) — run `npm run worker` separately");
    return;
  }

  workerProcess = spawn(process.execPath, [tsxCli, "scripts/worker.ts"], {
    cwd: process.cwd(),
    stdio: "inherit",
  });

  workerProcess.on("error", (error) => {
    console.error("> queue worker could not start:", error);
    console.error("> run `npm run worker` separately until this is fixed");
  });

  // The child must not outlive the server that started it.
  const stop = () => workerProcess?.kill();
  process.on("exit", stop);
  for (const signal of ["SIGTERM", "SIGINT"] as const) {
    process.on(signal, () => {
      stop();
      process.exit(0);
    });
  }
}

main().catch((error) => {
  console.error("Failed to start the server:", error);
  process.exit(1);
});
