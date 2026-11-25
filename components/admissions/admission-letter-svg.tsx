/**
 * The admission letter artwork lives with the other document templates in `lib/admissions`.
 * This module keeps the old import path working for the letter renderer.
 */
export {
  ADMISSION_LETTER_SVG_TEMPLATE,
  escapeXml,
  mergeAdmissionLetterTemplate,
  type AdmissionLetterSlots,
} from "@/lib/admissions/letter-template";
