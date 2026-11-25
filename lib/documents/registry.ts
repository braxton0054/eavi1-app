/** One place where document kinds meet their source reader and their renderer. */

import {
  loadFeeStructure,
  loadIdCard,
  loadInvoice,
  loadReceipt,
  loadStudentProfile,
} from "./snapshots";
import { RENDERERS } from "./renderers";
import type { DocumentDefinition } from "./types";

export const DEFINITIONS: Record<string, DocumentDefinition> = {
  ID_CARD: { load: loadIdCard, render: RENDERERS.ID_CARD },
  INVOICE: { load: loadInvoice, render: RENDERERS.INVOICE },
  RECEIPT: { load: loadReceipt, render: RENDERERS.RECEIPT },
  STUDENT_PROFILE: { load: loadStudentProfile, render: RENDERERS.STUDENT_PROFILE },
  FEE_STRUCTURE: { load: loadFeeStructure, render: RENDERERS.FEE_STRUCTURE },
};
