import { prisma } from "@/lib/prisma";

const REVOKER = Symbol.for("eavi.chat.socket-revoker");

type SocketRevoker = (target: { userId?: string; sessionId?: string }) => void;

function publish(target: { userId?: string; sessionId?: string }): void {
  const revoke = (globalThis as typeof globalThis & { [REVOKER]?: SocketRevoker })[REVOKER];
  revoke?.(target);
}

export function registerSocketRevoker(revoke: SocketRevoker): void {
  (globalThis as typeof globalThis & { [REVOKER]?: SocketRevoker })[REVOKER] = revoke;
}

/** Disable/suspend an account and remove every long-lived credential in one transaction. */
export async function revokeUserAccess(userId: string, status: "PENDING" | "DISABLED"): Promise<void> {
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { status } }),
    prisma.session.deleteMany({ where: { userId } }),
    prisma.pushSubscription.deleteMany({ where: { userId } }),
  ]);
  publish({ userId });
}

export function revokeSessionSockets(sessionId: string): void {
  publish({ sessionId });
}
