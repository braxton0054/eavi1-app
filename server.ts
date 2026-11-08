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

  const httpServer = createServer((req, res) => handle(req, res));

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

  httpServer.listen(port, hostname, () => {
    console.log(`> EAVI portal ready on http://${hostname}:${port} (chat on the same port)`);
  });
}

main().catch((error) => {
  console.error("Failed to start the server:", error);
  process.exit(1);
});
