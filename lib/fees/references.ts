import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

type SequenceClient = Pick<Prisma.TransactionClient, "$queryRaw">;
type Sequence = "invoice_number_seq" | "admission_number_seq" | "receipt_number_seq" | "credit_note_number_seq";

const year = () => new Date().getFullYear();
const pad = (value: string | number, width: number) => String(value).padStart(width, "0");

async function nextValue(client: SequenceClient, sequence: Sequence) {
  const rows = await client.$queryRaw<Array<{ value: string }>>(
    Prisma.sql`SELECT nextval(${sequence}::text)::text AS value`,
  );
  return rows[0]?.value ?? "0";
}

export async function nextInvoiceNumber(client: SequenceClient = prisma): Promise<string> {
  return `INV/${year()}/${pad(await nextValue(client, "invoice_number_seq"), 5)}`;
}

export async function nextInvoiceNumbers(count: number, client: SequenceClient = prisma): Promise<string[]> {
  if (!Number.isSafeInteger(count) || count < 0 || count > 1000) throw new Error("Invalid invoice number count.");
  if (count === 0) return [];
  const rows = await client.$queryRaw<Array<{ value: string }>>(
    Prisma.sql`SELECT nextval('invoice_number_seq')::text AS value FROM generate_series(1, ${count}::int)`,
  );
  return rows.map((row) => `INV/${year()}/${pad(row.value, 5)}`);
}

export async function nextAdmissionNo(client: SequenceClient = prisma): Promise<string> {
  return `EAVI/${year()}/${pad(await nextValue(client, "admission_number_seq"), 4)}`;
}

/** Keep generated admission numbers ahead of a manually accepted generated-format value. */
export async function reserveAdmissionNumber(admissionNo: string, client: SequenceClient = prisma): Promise<void> {
  const match = /^EAVI\/\d{4}\/(\d+)$/i.exec(admissionNo.trim());
  if (!match || !Number.isSafeInteger(Number(match[1]))) return;
  await client.$queryRaw(
    Prisma.sql`SELECT setval('admission_number_seq', GREATEST(
      (SELECT last_value FROM admission_number_seq), ${match[1]}::bigint
    ), true)`,
  );
}

export async function nextReceiptNumber(client: SequenceClient = prisma): Promise<string> {
  return `RCP/${year()}/${pad(await nextValue(client, "receipt_number_seq"), 4)}`;
}

export async function nextCreditNoteNumber(client: SequenceClient = prisma): Promise<string> {
  return `CRN/${year()}/${pad(await nextValue(client, "credit_note_number_seq"), 4)}`;
}
