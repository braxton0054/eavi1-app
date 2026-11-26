import { randomUUID } from "node:crypto";

import { CardStatus, type Prisma } from "@/generated/prisma/client";
import { expiryForProgram } from "@/lib/cards/validity";

/** The serial is reserved before the transaction; every other value is derived here. */
export function createIssuedCard(
  tx: Prisma.TransactionClient,
  input: {
    serial: string;
    studentId: string;
    campusId: number;
    programId: string | null;
    startedAt: Date | null;
    durationMonths: number | null;
    issuedAt?: Date;
    remarks?: string;
  },
) {
  return tx.idCard.create({
    data: {
      serial: input.serial,
      verifyToken: randomUUID(),
      studentId: input.studentId,
      campusId: input.campusId,
      programId: input.programId,
      status: CardStatus.ISSUED,
      issuedAt: input.issuedAt ?? new Date(),
      expiresAt: input.startedAt ? expiryForProgram(input.startedAt, input.durationMonths) : null,
      remarks: input.remarks,
    },
    select: { id: true },
  });
}
