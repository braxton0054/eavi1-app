/**
 * Single source of truth for the application form an applicant fills in on the public
 * site. The campus office reads what arrives in the portal, so every string here is what
 * the applicant sees: a label, a hint, or the reason a submission did not go through.
 */

export type Choice = { value: string; label: string };

/**
 * The genders an applicant states, in the order they read on the form. No screen in the
 * system offers or shows a third — a record that stored one before this rule reads as
 * not stated until the office corrects it.
 */
export const genderChoices: { value: "MALE" | "FEMALE"; label: string }[] = [
  { value: "MALE", label: "Male" },
  { value: "FEMALE", label: "Female" },
];

/** The gender values a form may submit. */
export const genderValues = genderChoices.map((choice) => choice.value);

/** How a stored gender reads. A record from before the two-option rule shows nothing. */
export function genderLabel(value: string | null | undefined): string | null {
  return genderChoices.find((choice) => choice.value === value)?.label ?? null;
}

export const gradeChoices = [
  { value: "A", label: "A" },
  { value: "A_MINUS", label: "A-" },
  { value: "B_PLUS", label: "B+" },
  { value: "B", label: "B" },
  { value: "B_MINUS", label: "B-" },
  { value: "C_PLUS", label: "C+" },
  { value: "C", label: "C" },
  { value: "C_MINUS", label: "C-" },
  { value: "D_PLUS", label: "D+" },
  { value: "D", label: "D" },
  { value: "D_MINUS", label: "D-" },
  { value: "E", label: "E" },
] satisfies Choice[];

/**
 * The sentences that explain why a grade does not clear a programme's minimum.
 *
 * Kept next to the form copy because the applicant reads them at the moment they are refused, and
 * a refusal is where an applicant decides whether to bother with this college at all. So it says
 * what is wrong, what they could do about it, and where to go next — in that order.
 */
export const applyGrade = {
  /** Shown under the grade field when the chosen programme needs better. */
  belowMinimum: (theirs: string, required: string) =>
    `This course asks for KCSE ${required}, and you have ${theirs}.`,

  /** Heading above the list of courses that would take them. */
  suggestionsHeading: "Courses that accept your grade",
  suggestionsBody: "Choose one of these and submit again. Your other details stay filled in.",

  /** When their grade does not clear anything on offer. */
  noneHeading: "No course matches your grade yet",
  noneBody:
    "Nothing on offer this term takes your grade. Call the campus office — they can tell you about bridging courses and the next intake.",

  /** Labels for the suggestion list. */
  requiresMinimum: (grade: string) => `Needs ${grade}`,

  /** The note under the grade field, before anything is submitted. */
  gradeHint: "Use your KCSE result grade. Each course has a minimum.",
} as const;

export const applyPage = {
  title: "Apply — East Africa Vision Institute",
  metaDescription:
    "Apply to East Africa Vision Institute in Eldoret. Admissions run every month at two campuses.",
  eyebrow: "Admissions",
  introHeading: "Apply to East Africa Vision Institute",
  introSubheading:
    "Admission runs every month. Fill this in and we place you at the campus that teaches your course and has a place.",
  heading: "Application form",
  subheading:
    "Tell us who you are and which course you want. The campus office calls you on the number you give.",
  loading: "Loading the application form.",
  fields: {
    fullName: {
      label: "Full name",
      placeholder: "Amos Kemboi",
      empty: "Give the name we should call you by.",
    },
    phone: {
      label: "Phone",
      placeholder: "0712 345 678",
      empty: "We reach people by phone first.",
      wrong: "Use a Kenyan number, for example 0712 345 678.",
    },
    email: {
      label: "Email",
      optional: "Optional but recommended",
      placeholder: "you@example.com",
      wrong: "Enter a valid email address.",
    },
    gender: {
      label: "Gender",
      placeholder: "Choose one",
      empty: "Choose the option that fits you.",
    },
    grade: {
      label: "KCSE grade",
      hint: "Kenya Certificate of Secondary Education.",
      placeholder: "Choose one",
      empty: "Choose the grade you got.",
    },
    program: {
      label: "Programme",
      placeholder: "Choose the course you want to do",
      empty: "Choose the programme you want to do.",
      /** No campus that takes applicants teaches this course. */
      none: "No campus teaches this course right now. Call the campus office and they will tell you what is open.",
    },
  },
  submit: "Submit application",
  submitting: "Sending your application",
  /** A field bots fill in and a person never sees or touches. */
  botField: "Website",
  errors: {
    /** Anything that stopped the write for a reason the applicant cannot act on. */
    failed: "We could not send that. Try again, or call the campus office.",
    tooLong: "That answer is too long. Shorten it and try again.",
    duplicate:
      "That phone number already has an application for this programme. The campus office will call you.",
    /** Refused by the rate limit, not by anything the applicant typed. */
    tooMany:
      "You have sent several applications from this connection. Please wait a little, then try again, or call the campus office.",
  },
  applied: {
    heading: "Application received",
    body: "Download your admission letter now and keep it safe — it is your proof that you applied, and you will need it when you enrol.",
    reference: "Your reference",
    campus: "You report to",
    letter: {
      buttonSvg: "Download admission letter (SVG)",
      buttonPdf: "Download admission letter (PDF)",
      downloading: "Preparing your letter…",
      note: "Your A4 acknowledgement letter shows your course details, campus reporting instructions, and a QR code the admissions office can verify.",
      failed: "Your letter could not be prepared just now. Try again, or show the office your reference above.",
      missing: "Your letter is being prepared. Show the office your reference above and ask them to print it.",
    },
    steps: [
      "Download and keep your admission letter.",
      "The campus office checks your details.",
      "They call you on the number you gave.",
      "Admission runs every month, so a place can be confirmed in the same month.",
    ],
    stepsHeading: "What happens next",
    again: "Apply for another programme",
    home: "Back to home",
  },
  aside: {
    heading: "Rather talk to someone?",
    body: "Every campus answers its own line and registers applications over the phone.",
    call: "Call",
    whatsapp: "WhatsApp",
    portal: "Already admitted? Sign in to the portal.",
  },
} as const;
