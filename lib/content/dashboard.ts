/**
 * Every string the college-admin portal shows. Components receive these as props or read
 * them from here; no screen hardcodes copy. Nothing in this file is college data — names,
 * figures and dates all come from the database.
 */

import { genderChoices } from "@/lib/content/apply";

export type DashboardIcon =
  | "overview"
  | "applications"
  | "students"
  | "enrollments"
  | "programs"
  | "tutors"
  | "timetable"
  | "calendar"
  | "exams"
  | "accounts"
  | "cards"
  | "reports"
  | "communication"
  | "chat"
  | "profile";

export type FieldType =
  | "text"
  | "password"
  | "email"
  | "tel"
  | "date"
  | "time"
  | "number"
  | "select"
  | "textarea"
  | "checkbox"
  | "file";

export type Field = {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  hint?: string;
  placeholder?: string;
  step?: string;
  /** Only for `type: "file"`: the picker filter, e.g. "application/pdf". */
  accept?: string;
  /** Rendered at full width instead of half width on wide screens. */
  wide?: boolean;
  /** Static choices, e.g. an enum. */
  options?: { value: string; label: string }[];
  /** Choices loaded from the database by the screen. */
  optionKey?:
    | "programs"
    | "students"
    | "tutors"
    | "semesters"
    | "intakes"
    | "enrollments"
    | "classes"
    | "placements"
    | "invoices"
    | "campuses"
    | "departments"
    | "bodies"
    | "programTypes"
    | "feeCadences"
    | "years";
};

export type Column = {
  key: string;
  label: string;
  align?: "end";
  /** A cell holding row controls is never truncated, or its popup would be clipped. */
  interactive?: boolean;
};

export type NavItem = { href: string; label: string; icon: DashboardIcon };
export type NavGroup = { id: string; label: string; items: NavItem[] };

export const shell = {
  brandName: "EAVI Portal",
  brandNote: "College administration",
  navLabel: "Portal sections",
  skipToContent: "Skip to content",
  openMenu: "Open section menu",
  closeMenu: "Close section menu",
  allCampuses: "All campuses",
  chooseCampus: "Choose a campus from the College overview to add records here.",
  tutorNote: "Tutor portal",
  studentNote: "Student portal",
  /** The campus switcher that a super admin works from, shown in the portal header. */
  scopeLabel: "Campus",
  account: {
    label: "Account",
    role: "Role",
    signOut: "Sign out",
    profile: "Profile and settings",
  },
  unavailable: {
    title: "Administration area",
    body: "Sign in with a college administration account to use this area.",
    unassigned: "This account has no campus assigned yet. Contact the college office.",
  },
};

export const roles = {
  SUPERADMIN: "Super admin",
  CAMPUS_ADMIN: "College admin",
  TUTOR: "Tutor",
  STUDENT: "Student",
} as const;

export const navGroups: NavGroup[] = [
  {
    id: "administration",
    label: "Administration",
    items: [
      { href: "/dashboard", label: "Overview", icon: "overview" },
      { href: "/dashboard/profile", label: shell.account.profile, icon: "profile" },
    ],
  },
  {
    id: "admissions",
    label: "Admissions",
    items: [
      { href: "/dashboard/applications", label: "Applications", icon: "applications" },
      { href: "/dashboard/students", label: "Students", icon: "students" },
      { href: "/dashboard/enrollments", label: "Enrollments", icon: "enrollments" },
      { href: "/dashboard/classes", label: "Classes", icon: "students" },
    ],
  },
  {
    id: "academics",
    label: "Academics",
    items: [
      { href: "/dashboard/programs", label: "Programmes", icon: "programs" },
      { href: "/dashboard/tutors", label: "Tutors", icon: "tutors" },
      { href: "/dashboard/timetable", label: "Timetable", icon: "timetable" },
      { href: "/dashboard/calendar", label: "Academic calendar", icon: "calendar" },
      { href: "/dashboard/exams", label: "Exams", icon: "exams" },
    ],
  },
  {
    id: "records",
    label: "Records",
    items: [
      { href: "/dashboard/accounts", label: "Accounts", icon: "accounts" },
      { href: "/dashboard/cards", label: "ID cards", icon: "cards" },
    ],
  },
  {
    id: "insights",
    label: "Insights",
    items: [
      { href: "/dashboard/reports", label: "Reports", icon: "reports" },
      { href: "/dashboard/communication", label: "Communication", icon: "communication" },
      { href: "/portal/chat", label: "Chat", icon: "chat" },
    ],
  },
];

/** A super admin keeps the same working sections as a campus office, with college-wide screens first. */
export const superNavGroups: NavGroup[] = [
  {
    id: "administration",
    label: "Administration",
    items: [
      { href: "/dashboard/scope?campus=all", label: "College overview", icon: "overview" },
      { href: "/dashboard/campuses", label: "Campuses", icon: "programs" },
      { href: "/dashboard/staff", label: "Staff approvals", icon: "tutors" },
      { href: "/dashboard/profile", label: shell.account.profile, icon: "profile" },
    ],
  },
  ...navGroups.slice(1),
];

/**
 * The tutor's own menu. It reaches only their classes, their invigilations and the marks
 * they owe — never the college-wide screens a campus office works in.
 */
export const tutorNavGroups: NavGroup[] = [
  {
    id: "teaching",
    label: "Teaching",
    items: [
      { href: "/tutor", label: "Today", icon: "overview" },
      { href: "/tutor/timetable", label: "Week timetable", icon: "timetable" },
    ],
  },
  {
    id: "assessment",
    label: "Assessment",
    items: [
      { href: "/tutor/exams", label: "My invigilations", icon: "exams" },
      { href: "/tutor/marks", label: "Marks to enter", icon: "reports" },
    ],
  },
];

/** The four links the bottom bar of any portal screen carries. */
export const mobileNav: Record<"admin" | "tutor" | "portal" | "student", NavItem[]> = {
  portal: [
    { href: "/portal/chat", label: "Chat", icon: "chat" },
  ],
  admin: [
    { href: "/dashboard", label: "Overview", icon: "overview" },
    { href: "/dashboard/applications", label: "Applications", icon: "applications" },
    { href: "/dashboard/students", label: "Students", icon: "students" },
    { href: "/dashboard/enrollments", label: "Enrollments", icon: "enrollments" },
    { href: "/dashboard/classes", label: "Classes", icon: "students" },
  ],
  student: [
    { href: "/student", label: "Overview", icon: "overview" },
    { href: "/student/units", label: "Units", icon: "programs" },
    { href: "/student/fees", label: "Fees", icon: "accounts" },
    { href: "/student/profile", label: "Details", icon: "profile" },
  ],
  tutor: [
    { href: "/tutor", label: "Today", icon: "overview" },
    { href: "/tutor/timetable", label: "Timetable", icon: "timetable" },
    { href: "/tutor/exams", label: "Exams", icon: "exams" },
    { href: "/tutor/marks", label: "Marks", icon: "reports" },
  ],
};

export const common = {
  print: "Print",
  search: "Search",
  searchPlaceholder: "Type to filter",
  clear: "Clear",
  filter: "Filter",
  allStatuses: "All statuses",
  all: "All",
  save: "Save",
  cancel: "Cancel",
  close: "Close",
  create: "Add",
  update: "Update",
  record: "Record",
  yes: "Yes",
  required: "Required",
  none: "None",
  notSet: "Not recorded",
  actions: "Actions",
  remove: "Remove",
  removed: "Removed.",
  status: "Status",
  results: "results",
  page: "Page",
  previous: "Previous",
  next: "Next",
  loading: "Loading",
  back: "Back",
  amount: "Amount",
  date: "Date",
  name: "Name",
  total: "Total",
  balance: "Balance",
  active: "Active",
  errorTitle: "Could not save",
  invalidSubmit: "Some answers are missing or in the wrong format. Nothing was saved.",
  retry: "Try again",
  loadError: "This screen could not be loaded. Try again.",
  notFoundTitle: "Record not available",
  notFoundBody: "This record is not available on your account.",
};

/** Wording for a form the administrator filled in wrongly. The field name is supplied. */
export const fieldErrors = {
  required: (label: string) => `${label} is required.`,
  number: (label: string) => `${label} must be a number.`,
  date: (label: string) => `${label} is not a valid date.`,
  choice: (label: string) => `${label} is not one of the listed choices.`,
  time: (label: string) => `${label} must be a 24-hour time such as 09:30.`,
  timeOrder: "The end time must be later than the start time.",
  dateOrder: "The end date must be later than the start date.",
  password: (label: string) => `${label} needs at least 10 characters.`,
  email: (label: string) => `${label} is not a valid email address.`,
  phone: (label: string) => `${label} is not a Kenyan phone number.`,
  duplicate: (label: string) => `That ${label} is already on file.`,
  notOnCampus: "That record is not available on your account, so nothing was changed.",
  exhausted: "A new reference number could not be issued. Contact the college office.",
  yearClosed: "That academic year is closed for changes.",
  semesterEnded: "That semester has ended, so it can no longer be changed.",
  datePast: "That date has already gone by.",
  reportingPassed: "That reporting date has passed, so it can no longer be changed.",
  dateNotInMonth: (month: string) => `The date must fall inside ${month}.`,
  semesterSlot: (label: string) => `${label} must be Semester 1, Semester 2 or Semester 3.`,
  semesterExists: (slot: string, year: number) => `${slot} ${year} is already configured.`,
  windowOverlap: (name: string) => `Those dates overlap ${name}.`,
  semesterAlreadyActive: (name: string) =>
    `${name} is still marked active. Mark it completed before making another semester active.`,
  pdf: (label: string) => `${label} must be a PDF file.`,
  image: (label: string) => `${label} must be a JPG or PNG picture.`,
  fileSize: (label: string, maxMb: number) => `${label} must be smaller than ${maxMb} MB.`,
  storageOff: "File storage is not configured, so the college office must enable it first.",
  currentPassword: "That is not your current password.",
  passwordMismatch: "The two new passwords do not match.",
};

/** Enum value -> the wording a college administrator reads. */
export const labels = {
  role: roles,
  applicationStatus: {
    SUBMITTED: "Submitted",
    REVIEWING: "Under review",
    REJECTED: "Rejected",
    WITHDRAWN: "Withdrawn",
  },
  enrollmentStatus: {
    ACTIVE: "Active",
    SUSPENDED: "Suspended",
    COMPLETED: "Completed",
    WITHDRAWN: "Withdrawn",
  },
  cardStatus: {
    PENDING: "Pending",
    PRINTING: "Printing",
    ISSUED: "Issued",
    LOST: "Reported lost",
    REPLACED: "Replaced",
  },
  examStatus: {
    DRAFT: "Draft",
    SCHEDULED: "Scheduled",
    COMPLETED: "Completed",
    RELEASED: "Released",
  },
  examType: {
    CAT: "CAT",
    END_TERM: "End of term",
  },
  invoiceStatus: {
    OPEN: "Unpaid",
    PARTIAL: "Part paid",
    PAID: "Paid",
    VOID: "Void",
  },
  paymentMethod: {
    MPESA: "M-Pesa",
    CASH: "Cash",
    BANK: "Bank transfer",
    CHEQUE: "Cheque",
  },
  /** The delivery structure a programme is planned around. Never "term". */
  programStructure: {
    SEMESTER: "Semesters",
    MONTHLY: "Months",
    MODULE: "Modules",
    CUSTOM: "Custom periods",
  },
  unitStatus: {
    NOT_STARTED: "Not started",
    REGISTERED: "Registered",
    IN_PROGRESS: "In progress",
    COMPLETED: "Completed",
    FAILED: "Failed",
    DEFERRED: "Deferred",
  },
  attachmentStatus: {
    NOT_ELIGIBLE: "Not yet eligible",
    ELIGIBLE: "Eligible",
    ATTACHED: "Attached",
    IN_PROGRESS: "In progress",
    COMPLETED: "Completed",
    FAILED: "Failed",
    DEFERRED: "Deferred",
  },
  /** How a registered payment type turns the programme duration into payable periods. */
  feePeriodKind: {
    MONTHLY: "One period per month",
    SEMESTER: "One period per semester",
    ACADEMIC_YEAR: "One period per academic year",
    ONE_TIME: "A single payment",
    CUSTOM: "Custom schedule",
  },
  /** A fee period reads differently from a whole invoice: a part payment is normal here. */
  periodStatus: {
    PENDING: "Pending",
    PARTIAL: "Part paid",
    PAID: "Paid",
    OVERDUE: "Overdue",
    VOID: "Void",
  },
  audience: {
    EVERYONE: "Everyone",
    STUDENTS: "Students",
    TUTORS: "Tutors",
  },
  weekday: {
    MONDAY: "Monday",
    TUESDAY: "Tuesday",
    WEDNESDAY: "Wednesday",
    THURSDAY: "Thursday",
    FRIDAY: "Friday",
    SATURDAY: "Saturday",
  },
  /** Index 0 is January; a reporting date is stored by its calendar month. */
  months: [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ],
  calendarEventType: {
    ACADEMIC: "Academic",
    HOLIDAY: "Holiday",
    EXAMINATION: "Examination",
    ADMISSION: "Admission",
    FINANCE: "Finance",
    MEETING: "Meeting",
  },
  semesterStatus: {
    PLANNED: "Planned",
    // The calendar decides what is current from the dates, so this status only says the term
    // was opened, not that it is the one running today.
    ACTIVE: "Opened",
    COMPLETED: "Completed",
  },
  /** Kenya Certificate of Secondary Education grades, as an applicant states one. */
  entryGrade: {
    A: "A",
    A_MINUS: "A-",
    B_PLUS: "B+",
    B: "B",
    B_MINUS: "B-",
    C_PLUS: "C+",
    C: "C",
    C_MINUS: "C-",
    D_PLUS: "D+",
    D: "D",
    D_MINUS: "D-",
    E: "E",
  },
  userStatus: {
    ACTIVE: "Active",
    PENDING: "Awaiting approval",
    DISABLED: "Disabled",
  },
} as const;

/**
 * The two documents that belong to one programme. They are fields on the programme form
 * itself, so the same wording is read by the form field and by the table cell.
 */
const programmeDocuments = {
  curriculum: {
    file: "Curriculum file (PDF)",
    hint: "Optional. On an edit, leave this empty to keep the file already uploaded.",
    none: "No curriculum uploaded yet.",
    view: "View curriculum",
  },
  feeStructure: {
    file: "Fee structure file (PDF)",
    hint: "Optional. On an edit, leave this empty to keep the file already uploaded.",
    none: "No fee structure uploaded yet.",
    view: "View fee structure",
  },
};

const profilePhoto = {
  heading: "Profile photo",
  description: "Shown next to your name at the top right of the portal.",
  file: "Photo (JPG or PNG)",
  hint: "A square picture reads best.",
  button: "Save photo",
  remove: "Remove photo",
  removed: "Photo removed.",
  none: "No photo uploaded yet.",
  preview: "Your profile photo",
};

export const pages = {
  chat: {
    title: "Chat",
    description:
      "Message anyone in the school. Find people in Contacts, or pick up a conversation you already started.",
  },
  overview: {
    title: "Overview",
    scopeNote: (campusName: string) => `Scope: ${campusName}`,
    kpis: [
      { key: "students", label: "Students", icon: "students" },
      { key: "activeEnrollments", label: "Active enrollments", icon: "enrollments" },
      { key: "applicationsOpen", label: "Applications to review", icon: "applications" },
      { key: "tutors", label: "Tutors", icon: "tutors" },
      { key: "billed", label: "Billed", icon: "accounts" },
      { key: "collected", label: "Collected", icon: "accounts" },
      { key: "outstanding", label: "Outstanding", icon: "accounts" },
      { key: "cardsPending", label: "Cards pending", icon: "cards" },
    ] as const,
    lists: {
      deadlines: "Application deadlines",
      deadlinesEmpty: "No intake deadlines on a running semester.",
      events: "Coming up on the calendar",
      eventsEmpty: "Nothing scheduled.",
      exams: "Exams ahead",
      examsEmpty: "No exams scheduled yet.",
      recentStudents: "Most recent admissions",
      recentStudentsEmpty: "No students admitted yet.",
      announcements: "Latest notices",
      announcementsEmpty: "No notices published from this campus.",
    },
  },

  /** The super admin's own screen: the whole college at once, campus by campus. */
  college: {
    title: "The college at a glance",
    description: "Every campus counted the same way.",
    campusesOne: "campus",
    campusesMany: "campuses",
    figures: {
      students: "Students",
      applicationsOpen: "Applications to review",
      activeEnrollments: "Active enrolments",
      tutors: "Tutors",
      billed: "Billed",
      collected: "Collected",
      outstanding: "Outstanding",
    },
    blocks: {
      campuses: "Campuses",
      campusesEmpty: "No campus is registered yet.",
      applications: "Applications received",
      applicationsNote: "Counted by the month the applicant sent it in.",
      programmes: "Where the enrolled students are",
      programmesEmpty: "No one is enrolled yet.",
      recent: "Latest applications",
      recentEmpty: "Nothing has come in through the public form.",
      collection: "What has been collected",
    },
    columns: [
      { key: "campus", label: "Campus" },
      { key: "students", label: "Students", align: "end" },
      { key: "applicationsOpen", label: "To review", align: "end" },
      { key: "activeEnrollments", label: "Enrolled", align: "end" },
      { key: "tutors", label: "Tutors", align: "end" },
      { key: "collected", label: "Collected of billed", align: "end" },
    ] as const,
  },

  applications: {
    title: "Applications",
    description: "Enquiries and submissions for this campus.",
    searchLabel: "Search by name, reference, email or phone",
    columns: [
      { key: "reference", label: "Reference" },
      { key: "fullName", label: "Applicant" },
      { key: "contact", label: "Contact" },
      { key: "program", label: "Programme" },
      { key: "status", label: "Status" },
      { key: "received", label: "Received" },
    ] satisfies Column[],
    /** One applicant, one card — the same treatment as programmes, students and invoices. */
    card: {
      open: "Open application",
      received: "Received",
      contact: "Contact",
      noEmail: "No email",
      enrol: "Enrol",
      decided: "Decided",
    },
    empty: {
      title: "No applications match",
      body: "Log an application or clear the filters.",
    },
    detail: {
      previousQualification: "Previous qualification",
      /** Not fields on the form: both come from the programme the applicant picked. */
      derivedHeading: "From the programme",
      awardingBody: "Awarding body",
      programmeType: "Programme type",
      decision: "Decision",
      decidedBy: "Decided by",
      decidedAt: "Decided on",
    },
    create: {
      button: "Log an application",
      title: "New application",
      fields: [
        { name: "fullName", label: "Applicant name", type: "text", required: true },
        { name: "phone", label: "Phone", type: "tel", required: true },
        { name: "email", label: "Email", type: "email" },
        {
          name: "gender",
          label: "Gender",
          type: "select",
          required: true,
          options: genderChoices,
        },
        {
          name: "grade",
          label: "KCSE grade",
          type: "select",
          required: true,
          options: toOptions(labels.entryGrade),
        },
        { name: "programId", label: "Programme", type: "select", required: true, optionKey: "programs" },
        { name: "previousQualification", label: "Previous qualification", type: "text", wide: true },
      ] satisfies Field[],
    },
    decision: {
      button: "Record decision",
      reject: "Reject",
      review: "Move to review",
      hold: "Make a decision to move this application forward.",
      status: "Decision",
      statusField: { name: "decision", label: "Decision", type: "select", required: true } satisfies Field,
      note: { name: "decisionNote", label: "Reason or note for the file", type: "textarea", wide: true },
      saved: "Decision saved.",
    },

    /** Admission runs monthly, so each campus month carries the day its students report. */
    dateSetting: {
      heading: "Application date setting",
      year: {
        select: "Year",
        show: "Show",
        previous: "Previous year",
        next: "Next year",
        heading: "Application dates for",
        closed: "Closed for changes",
        closedTitle: "Changes closed",
        closedBody: (year: number) => `Reporting dates for ${year} can no longer be changed.`,
      },
      campus: { select: "Campus" },
      months: "Months",
      notSet: "No reporting date set.",
      reported: "Reported",
      upcoming: "Upcoming",
      passedNote: (month: string) => `Reporting for ${month} has passed.`,
      set: {
        button: "Set date",
        field: { name: "date", label: "Reporting date", type: "date", required: true } satisfies Field,
        saved: "Reporting date saved.",
      },
      change: { button: "Change date" },
      remove: { button: "Clear date" },
    },
  },

  students: {
    title: "Students",
    description: "Registered students at this campus.",
    searchLabel: "Search by name, admission number or guardian",
    /** The phone/desktop card. The table is gone: one student, one card, one tap. */
    card: {
      open: "Open student",
      noProgram: "No active enrolment",
      balance: "Fee balance",
      cleared: "Fees cleared",
      owing: "Owes",
      idCard: "ID card",
      noPhone: "No phone",
      noCard: "No ID card issued",
    },
    columns: [
      { key: "admissionNo", label: "Admission no." },
      { key: "fullName", label: "Name" },
      { key: "contact", label: "Contact" },
      { key: "program", label: "Programme" },
      { key: "account", label: "Fee balance", align: "end" },
      { key: "card", label: "ID card" },
    ] satisfies Column[],
    empty: {
      title: "No students yet",
      body: "Register a student.",
    },
    create: {
      button: "Register a student",
      title: "New student",
      fields: [
        { name: "fullName", label: "Full name", type: "text", required: true },
        { name: "email", label: "Email (sign-in)", type: "email", required: true },
        { name: "phone", label: "Phone", type: "tel" },
        { name: "programId", label: "Programme", type: "select", required: true, optionKey: "programs" },
        {
          name: "intakeId",
          label: "Intake",
          type: "select",
          required: true,
          optionKey: "intakes",
          hint: "The cohort fixes which semester the student starts in.",
        },
        { name: "admissionNo", label: "Admission number", type: "text", hint: "Leave blank to issue one automatically." },
        { name: "password", label: "Temporary password", type: "text", required: true, hint: "Minimum 10 characters." },
        { name: "gender", label: "Gender", type: "select", options: genderChoices },
        { name: "dateOfBirth", label: "Date of birth", type: "date" },
        { name: "nationalId", label: "ID or birth certificate no.", type: "text" },
        { name: "guardianName", label: "Guardian name", type: "text" },
        { name: "guardianPhone", label: "Guardian phone", type: "tel" },
        { name: "guardianEmail", label: "Guardian email", type: "email" },
        { name: "address", label: "Address", type: "textarea", wide: true },
      ] satisfies Field[],
      created: "Student registered.",
    },
    profile: {
      guardian: "Guardian",
      personal: "Personal details",
      photoAlt: (name: string) => `Photograph of ${name}`,
      noPhoto: "No photo",
      /** Identity details, grouped so a reader can find a thing instead of scanning a wall. */
      groups: {
        contact: "Contact",
        academic: "Programme",
        personal: "Personal",
        guardian: "Guardian",
      },
      enrolled: "Enrolled",
      activeNow: "Currently enrolled",
      notEnrolled: "Not currently enrolled",
      missingHint: "Nothing recorded for this section yet.",
      /** Printed header and footer. A sheet on a desk has no screen around it to say what it is. */
      print: {
        title: "Student record",
        printedOn: (date: string) => `Printed ${date}`,
        confidential:
          "Confidential. Contains personal data held under the institute's student records.",
        verifiedBy: "Verified against the student register.",
        noPhoto: "No photograph on file",
        /** Section headings that only exist on paper; the screen uses panel titles. */
        identity: "Identity and enrolment",
        finance: "Fees and payments",
        schedule: "Payment schedule",
        history: "Payment history",
        outreach: "Academic progress, attachment and cards",
        /** Table heads. Short, because the print table is only 182mm wide. */
        columns: {
          period: "Period",
          invoice: "Invoice",
          due: "Due date",
          amount: "Amount",
          paid: "Paid",
          balance: "Balance",
          status: "Status",
          date: "Date",
          receipt: "Receipt",
          appliedTo: "Applied to",
          method: "Method",
          reference: "Reference",
          unit: "Unit",
          result: "Result",
          stage: "Stage",
          host: "Host",
          supervisor: "Supervisor",
          serial: "Serial",
          issued: "Issued",
          expires: "Expires",
        },
        overdueTotal: "Overdue total",
        settledLine: (settled: number, total: number, current: string) =>
          `${settled} of ${total} periods settled · Current period: ${current}`,
        noPeriod: "No period recorded",
        nothingRecorded: "Not recorded",
        pageBreak: "Fees and payments",
        downloadLabel: "Print / Download PDF",
        browserButton: "Print from browser",
        browserHint:
          "Prints this page directly. Untick \"Headers and footers\" in the print dialogue so the browser's URL and date stay off the paper.",
        failed: "The PDF could not be generated. Try printing from the browser instead.",
      },
      finance: "Fees",
      cards: "Cards",
      enrollments: "Enrollments",
      invoices: "Invoices",
      fees: {
        overview: "Fee account",
        totalFees: "Total programme fees",
        paid: "Paid",
        outstanding: "Outstanding",
        nextDue: "Next payment",
        overdue: "Overdue",
        currentPeriod: "Current period",
        progress: (settled: number, total: number) => `${settled} of ${total} periods settled`,
        obligations: "Payment schedule",
        columns: [
          { key: "period", label: "Period" },
          { key: "calendar", label: "Academic calendar" },
          { key: "dueAt", label: "Due" },
          { key: "amount", label: "Amount", align: "end" },
          { key: "paid", label: "Paid", align: "end" },
          { key: "balance", label: "Balance", align: "end" },
          { key: "status", label: "Status" },
        ] satisfies Column[],
        empty: "No fee schedule has been generated for this student yet.",
        generate: "Generate fee schedule",
        noPlan:
          "This programme has no published fee structure, so there is nothing to generate. Publish one under Programmes → Fees.",
        noEnrollment: "The student has no active enrolment to bill.",
        notStarted: "Not started",
        settled: "Settled",
        history: "Payment history",
        historyColumns: [
          { key: "paidAt", label: "Paid" },
          { key: "receipt", label: "Receipt" },
          { key: "period", label: "Against" },
          { key: "method", label: "Method" },
          { key: "reference", label: "Reference" },
          { key: "amount", label: "Amount", align: "end" },
        ] satisfies Column[],
        historyEmpty: "No payments recorded yet.",
      },
      academic: {
        title: "Academic progress",
        progress: (done: number, total: number) => `${done} of ${total} units completed`,
        currentPeriod: "Current period",
        register: "Register a period",
        registerTitle: "Open a period for this student",
        period: "Period",
        override: "Progress despite outstanding units",
        empty: "No units are placed on this programme yet.",
        columns: [
          { key: "unit", label: "Unit" },
          { key: "period", label: "Period" },
          { key: "status", label: "Status" },
          { key: "result", label: "Result", align: "end" },
          { key: "actions", label: common.actions, interactive: true },
        ] satisfies Column[],
        resultTitle: "Record a unit result",
        resultFields: [
          { name: "status", label: "Status", type: "select", required: true, options: toOptions(labels.unitStatus) },
          { name: "score", label: "Score", type: "number", step: "0.5" },
          { name: "maxScore", label: "Out of", type: "number", step: "1" },
          { name: "grade", label: "Grade", type: "text" },
          { name: "remark", label: "Remark", type: "text", wide: true },
        ] satisfies Field[],
      },
      attachment: {
        title: "Industrial attachment",
        empty: "No attachment stage applies to this programme.",
      },
    },
  },

  classes: {
    title: "Classes",
    description: "Teaching groups on this campus. A class is a grouping, not an academic stage.",
    searchLabel: "Search by class, programme or intake",
    officialMonthsOnly: "EAVI runs three intakes a year: January, May and September. Choose one of those.",
    nameTaken: "A class with that name already exists for this programme.",
    archiveWithStudents: "Move the students to another class before archiving this one.",
    confirmRequired: "Tick the confirmation box to merge these classes.",
    wrongProgramme: "That class belongs to a different programme.",
    fields: {
      program: "Programme",
      intake: "Intake",
      name: "Class name",
      note: "Note",
      stage: "Academic stage",
      class: "Class",
      year: "Academic year",
    },
    card: {
      open: "Open class",
      students: "students",
      student: "student",
      noStudents: "No students yet",
      archived: "Archived",
      placements: "Stages in this class",
      merge: "Merge",
    },
    filter: {
      allProgrammes: "All programmes",
      includeArchived: "Include archived",
    },
    create: {
      button: "Create a class",
      title: "New class",
      description:
        "A class holds the students one office teaches together. Students keep their own academic stage, so a class can hold several.",
      nameHint: "Suggested: ICT/JAN/2027. Temporary classes such as ICT/JAN-FEB/2027 are fine.",
    },
    detail: {
      membersTitle: "Students in this class",
      membersEmpty: "No students have been placed in this class yet.",
      placementsNote:
        "Students in this class sit at different academic stages. The class does not decide their stage.",
      moveTitle: "Move a student",
      moveHint:
        "Moving a student between classes changes only the grouping. Their intake, admission date, academic stage, units, results and fees are left alone.",
      historyTitle: "Class history",
      historyEmpty: "No students have left this class.",
      merged: "Classes merged. Students kept their stages, fees and results.",
      auditTitle: "Recent changes",
    },
    merge: {
      button: "Merge classes",
      title: "Merge a class into another",
      description:
        "Students move to the destination class. Their admission dates, intakes, academic stages, unit registrations, marks, results, attachments, invoices and payments all stay exactly as they are.",
      source: "Class to merge",
      target: "Destination class",
      preview: "Preview merge",
      confirm: "I have reviewed which students will move.",
      confirmButton: "Merge classes",
      blockedTitle: "These classes cannot be merged",
      alreadyInTarget: (n: number) =>
        n === 1
          ? "1 student is already in the destination class and will not be duplicated."
          : `${n} students are already in the destination class and will not be duplicated.`,
      placementsTitle: "Academic stages present",
      historyNote: (n: number) =>
        n === 1
          ? "1 past membership record is retained for audit."
          : `${n} past membership records are retained for audit.`,
      noStudents: "This class has no students to move.",
      done: "Merge complete",
    },
    empty: {
      title: "No classes yet",
      body: "Create a class for an intake, then place students in it.",
    },
  },
  enrollments: {
    title: "Enrollments",
    description: "Active and historical enrolments on this campus.",
    searchLabel: "Search by admission number or cohort",
    card: {
      open: "Open student",
      enrolled: "Enrolled",
      intake: "Intake",
      cohort: "Cohort",
      /** The student's own position, counted from their intake rather than the calendar. */
      period: "Period",
      changeStatus: "Change status",
      promote: "Move to next period",
      promoteButton: "Advance period",
      promoted: "Period advanced",
    },
    columns: [
      { key: "admissionNo", label: "Admission no." },
      { key: "student", label: "Student" },
      { key: "program", label: "Programme" },
      { key: "intake", label: "Intake" },
      { key: "cohort", label: "Cohort" },
      { key: "status", label: "Status" },
      { key: "enrolledAt", label: "Enrolled" },
    ] satisfies Column[],
    empty: {
      title: "No enrollments",
      body: "Enroll a student.",
    },
    create: {
      button: "Enroll a student",
      title: "New enrollment",
      fields: [
        { name: "studentId", label: "Student", type: "select", required: true, optionKey: "students" },
        { name: "programId", label: "Programme", type: "select", required: true, optionKey: "programs" },
        {
          name: "intakeId",
          label: "Intake",
          type: "select",
          required: true,
          optionKey: "intakes",
          hint: "The cohort fixes which semester the student starts in.",
        },
        { name: "cohort", label: "Cohort label", type: "text", placeholder: "2026/1" },
      ] satisfies Field[],
      created: "Student enrolled.",
    },
    update: {
      title: "Change status",
      statusField: { name: "status", label: "Status", type: "select", required: true, options: toOptions(labels.enrollmentStatus) } satisfies Field,
      saved: "Enrollment updated.",
    },
  },

  programs: {
    title: "Programmes",
    description: "Courses on offer at this campus.",
    curriculum: programmeDocuments.curriculum,
    feeStructure: programmeDocuments.feeStructure,
    // Code, Programme, Awarding body and Level alone were ~1058px with the Actions column
    // last, which a 1280 screen with the sidebar open cannot show. The table scrolls inside
    // its panel rather than pushing the page sideways, and the name column wraps instead of
    // forcing a width. Everything dropped here is on the programme's own screen.
    columns: [
      { key: "code", label: "Code" },
      { key: "name", label: "Programme" },
      { key: "body", label: "Body" },
      { key: "level", label: "Level" },
      { key: "students", label: "Enrolled", align: "end" },
      { key: "fees", label: "Fee", align: "end" },
      { key: "status", label: "Status" },
      { key: "actions", label: common.actions, interactive: true },
    ] satisfies Column[],
    empty: {
      title: "No programmes yet",
      body: "Add a programme.",
    },
    /**
     * The phone card. A programme has fourteen columns; a phone gets the five an
     * administrator actually scans for, and the rest live on the programme's own screen.
     */
    card: {
      code: "Code",
      level: "Level",
      duration: "Duration",
      students: "Students",
      fee: "Fee",
      status: "Status",
      noFee: "Set fees",
      curriculumMissing: "No curriculum",
      feeStructureMissing: "No fee sheet",
      open: "Open programme",
      actions: "Programme actions",
    },
    create: {
      button: "Add programme",
      title: "New programme",
      fields: [
        { name: "name", label: "Programme name", type: "text", required: true, wide: true },
        { name: "bodyId", label: "Awarding body", type: "select", required: true, optionKey: "bodies" },
        { name: "typeId", label: "Programme type", type: "select", required: true, optionKey: "programTypes" },
        { name: "departmentId", label: "Department", type: "select", required: true, optionKey: "departments" },
        { name: "cadenceId", label: "Fee payment type", type: "select", required: true, optionKey: "feeCadences" },
        {
          name: "structure",
          label: "Delivery structure",
          type: "select",
          required: true,
          options: toOptions(labels.programStructure),
          hint: "Decides how units are grouped: by semester, by month, by module, or your own periods.",
        },
        { name: "durationMonths", label: "Duration (months)", type: "number", required: true, step: "1", hint: "Whole months only. A two-year course is 24." },
        { name: "minKcseGrade", label: "Minimum KCSE grade", type: "select", required: true, options: toOptions(labels.entryGrade) },
        { name: "description", label: "Description", type: "textarea", wide: true },
        { name: "curriculum", label: programmeDocuments.curriculum.file, type: "file", accept: "application/pdf", hint: programmeDocuments.curriculum.hint, wide: true },
        { name: "feeStructure", label: programmeDocuments.feeStructure.file, type: "file", accept: "application/pdf", hint: programmeDocuments.feeStructure.hint, wide: true },
      ] satisfies Field[],
      created: "Programme saved.",
    },
    edit: {
      button: "Edit",
      title: "Edit programme",
      done: "Programme updated.",
      structureLocked:
        "This programme already has units placed against its periods, so its delivery structure can no longer change. Remove the unit plan first if it really must.",
    },
    feePlan: {
      title: "Fee structure",
      link: "Fees",
      setLink: "Set fees",
      description:
        "Split the programme fee into the periods a student pays. Publishing a version never changes the bills of students already enrolled.",
      cadence: "Payment method",
      duration: "Programme duration (months)",
      durationHint: "Changing this rebuilds the period rows below; amounts already typed are kept.",
      note: "Internal note",
      amount: "Amount",
      periodHeader: "Payment period",
      offsetHeader: "Due after start (days)",
      periodFallback: (index: number) => `Period ${index}`,
      total: "Total programme fee",
      save: "Publish this version",
      noPeriods: "Add at least one payment period.",
      zeroTotal: "The fee structure must add up to more than zero.",
      current: (version: number) => `Version ${version} is live`,
      none: "No fee structure published yet. Students enrolled before it is published are billed manually.",
      customAdd: "Add a period",
      customRemove: "Remove",
      customHint: "Custom schedules are entered by hand: label each period and its amount.",
      calendarTitle: "Academic calendar",
      calendarNote:
        "Semester periods are dated from the campus calendar when a student enrols. Two intakes starting in different months therefore follow the same schedule shifted to their own start.",
      calendarEmpty:
        "This campus has no semesters on its calendar yet, so semester periods fall back to the offsets below.",
      calendarColumns: [
        { key: "name", label: "Semester" },
        { key: "starts", label: "Starts" },
        { key: "ends", label: "Ends" },
        { key: "status", label: "Status" },
      ] satisfies Column[],
      periodsHeading: "Payable periods",
      amountsHint: "Each period is billed on its own invoice, so every amount can differ.",
    },

    detail: {
      title: "Programme",
      overview: "Programme details",
      actions: "Actions",
      view: "View programme",
      manageUnits: "Manage units",
      manageAttachment: "Manage attachment",
      manageFees: "Manage fee structure",
      archived: "Archived",
      archivedOn: (date: string) => `Archived ${date}`,
      summary: {
        units: "Units placed",
        modules: "Modules",
        attachment: "Attachment stages",
        enrolled: "Active students",
        fee: "Programme fee",
        feeVersion: (version: number) => `Fee version ${version}`,
        noFee: "Not set",
      },
      noUnits: "No units have been placed yet.",
      noAttachment: "No industrial attachment is required.",
      openUnits: "Open the unit plan",
      openAttachment: "Open attachment settings",
      back: "All programmes",
      tabsLabel: "Programme sections",
      tabOverview: "Overview",
      tabUnits: "Units",
      tabFees: "Fees",
      tabAttachment: "Attachment",
      /** The strip that answers "what is still missing" without opening another screen. */
      readiness: {
        heading: "Setup",
        placed: "Units placed",
        fee: "Fee structure",
        attachment: "Attachment",
        none: "Not set",
        set: (value: string) => `Set · ${value}`,
        noneHint: "Set the amounts students will be billed.",
        noUnitsHint: "Place the units taught in each period.",
        noAttachmentHint: "Add a stage if students leave for industry.",
        clear: "Everything a programme needs is in place.",
      },
    },
    /** Labels for the fields this page and the section tabs share. */
    fieldLabels: {
      code: "Code",
      body: "Awarding body",
      type: "Programme type",
      department: "Department",
      structure: "Delivery structure",
      duration: "Duration",
      cadence: "Fee payment type",
      minGrade: "Minimum KCSE grade",
      campuses: "Campuses",
    },
    studentsLine: (active: number, completed: number) =>
      `${active} active ${active === 1 ? "student" : "students"}${completed ? ` · ${completed} completed` : ""}`,
    /** One line on every programme screen, so a per-programme page is never a dead end. */
    sectionTabs: {
      label: "Programme sections",
      overview: "Overview",
      units: "Units",
      fees: "Fees",
      attachment: "Attachment",
    },

    unitPlan: {
      title: "Units and modules",
      description:
        "Place the units a student studies in each period of this programme. A unit is defined once and can be placed in more than one period without being duplicated.",
      unit: "Unit",
      unitCode: "Unit code",
      unitName: "Unit name",
      unitDescription: "Description",
      addUnit: "Add unit to the catalogue",
      addUnitTitle: "New unit",
      catalogue: "Unit catalogue",
      catalogueEmpty: "The catalogue is empty. Add the first unit.",
      assign: "Place a unit",
      assignTitle: "Place a unit in a period",
      period: "Period",
      customPeriod: "Period name",
      module: "Module",
      placed: "Placed units",
      sequence: "Order",
      removeUnit: "Remove",
      removeBlocked:
        "Students already have results against this unit, so it is kept for their records.",
      archived: "This programme is archived, so its teaching structure can no longer be changed.",
      moduleNeedsModuleStructure: "Modules can only be added to a module-based programme.",
      moduleCode: "Module code",
      moduleName: "Module name",
      moduleDuration: "Module duration (months)",
      moduleSequence: "Order",
      newModule: "Add module",
      newModuleTitle: "New module",
      editModule: "Edit module",
      removeModule: "Remove module",
      moduleRemoveBlocked:
        "This module still has units placed in it, so it cannot be removed until they are.",
      noUnits: "No units have been placed in this programme yet.",
      moduleEmpty: "No modules yet. A module groups the units of a module-based programme.",
      status: "Unit status",
      score: "Score",
      maxScore: "Out of",
      progressionBlocked: (outstanding: number) =>
        `${outstanding} ${outstanding === 1 ? "unit is" : "units are"} still outstanding in an earlier period. Tick the override to progress anyway.`,
      periodUnknown: "That period does not belong to this programme.",
      columns: [
        { key: "unit", label: "Unit" },
        { key: "period", label: "Period" },
        { key: "order", label: "Order", align: "end" },
        { key: "actions", label: common.actions, interactive: true },
      ] satisfies Column[],
      moduleColumns: [
        { key: "code", label: "Code" },
        { key: "name", label: "Module" },
        { key: "units", label: "Units", align: "end" },
        { key: "duration", label: "Duration" },
        { key: "actions", label: common.actions, interactive: true },
      ] satisfies Column[],
    },

    attachments: {
      title: "Industrial attachment",
      description:
        "Stages where students leave campus for industry. A stage opens automatically once the units before it are completed.",
      label: "Stage name",
      trigger: "When it happens",
      triggerRequired: "Choose when the attachment happens.",
      status: "Status",
      durationWeeks: "Duration (weeks)",
      durationMonths: "Duration (months)",
      startsAt: "Starts",
      endsAt: "Ends",
      prerequisiteNote: "Prerequisites",
      assessmentNote: "Assessment requirements",
      add: "Add attachment stage",
      addTitle: "New attachment stage",
      stages: "Stages",
      empty: "No industrial attachment is required for this programme.",
      archived: "This programme is archived, so its attachment stages can no longer be changed.",
      remove: "Remove",
      removeBlocked:
        "Students are already tracked against this stage, so it is kept for their records.",
      allPeriods: "After all academic periods",
      stageColumns: [
        { key: "label", label: "Stage" },
        { key: "when", label: "When" },
        { key: "duration", label: "Duration" },
        { key: "tracked", label: "Students tracked", align: "end" },
        { key: "actions", label: common.actions, interactive: true },
      ] satisfies Column[],
      studentTitle: "Industrial attachment",
      studentEmpty: "No attachment stage applies to this programme.",
      record: "Record attachment",
      recordTitle: "Attachment details",
      studentColumns: [
        { key: "stage", label: "Stage" },
        { key: "status", label: "Status" },
        { key: "host", label: "Host organisation" },
        { key: "dates", label: "Dates" },
        { key: "supervisor", label: "Supervisor" },
        { key: "result", label: "Result" },
        { key: "actions", label: common.actions, interactive: true },
      ] satisfies Column[],
      fields: [
        { name: "status", label: "Status", type: "select", required: true, options: toOptions(labels.attachmentStatus) },
        { name: "hostOrganization", label: "Host organisation", type: "text" },
        { name: "supervisorName", label: "Supervisor name", type: "text" },
        { name: "supervisorPhone", label: "Supervisor phone", type: "tel" },
        { name: "supervisorEmail", label: "Supervisor email", type: "email" },
        { name: "startDate", label: "Start date", type: "date" },
        { name: "expectedEndDate", label: "Expected completion", type: "date" },
        { name: "completedAt", label: "Completed on", type: "date" },
        { name: "grade", label: "Grade", type: "text" },
        { name: "assessmentNote", label: "Assessment note", type: "textarea", wide: true },
        { name: "remark", label: "Remark", type: "textarea", wide: true },
      ] satisfies Field[],
    },

    remove: {
      button: "Delete",
      active: (active: number) =>
        `This programme still has ${active} active ${active === 1 ? "student" : "students"}. Let them finish or transfer, or archive the programme instead.`,
      history:
        "This programme has enrolments, applications, exams, timetables, cards or financial records against it. Archive it instead so that history is kept.",
    },
    archive: {
      button: "Archive",
      title: "Archive programme",
      reason: "Reason (optional)",
      done: "Programme archived. It no longer takes new admissions.",
      blocked: (active: number) =>
        `This programme still has ${active} active ${active === 1 ? "student" : "students"}. It can be archived once they finish or transfer.`,
    },
    settings: {
      button: "Programme settings",
      title: "Programme settings",
      description:
        "The lists a programme is picked from. Add a body, a type or a payment type here before you create a programme.",
      bodies: {
        heading: "Awarding bodies",
        description: "The body a programme is registered and examined by, e.g. KNEC or CDAC.",
        columns: [
          { key: "code", label: "Code" },
          { key: "name", label: "Body" },
          { key: "programs", label: "Programmes", align: "end" },
        ] satisfies Column[],
        empty: "No bodies registered yet. Add one before creating a programme.",
        create: {
          button: "Add body",
          title: "New awarding body",
          fields: [
            { name: "name", label: "Body name", type: "text", required: true, placeholder: "Kenya National Examinations Council" },
            { name: "code", label: "Code", type: "text", required: true, hint: "Short letters used at the start of every programme code, e.g. KNEC." },
          ] satisfies Field[],
        },
        edit: {
          button: "Edit",
          title: "Edit awarding body",
          fields: [
            { name: "name", label: "Body name", type: "text", required: true },
            {
              name: "code",
              label: "Code",
              type: "text",
              required: true,
              hint: "Used on new programme codes only. Codes already issued keep their old letters.",
            },
          ] satisfies Field[],
          done: "Awarding body updated.",
        },
        remove: {
          button: "Delete",
          blocked: "Programmes are still registered with this body, so it cannot be deleted.",
        },
      },
      types: {
        heading: "Programme types",
        description: "Certificate, diploma, degree and any other kind of programme the college offers.",
        columns: [
          { key: "code", label: "Code" },
          { key: "name", label: "Type" },
          { key: "programs", label: "Programmes", align: "end" },
        ] satisfies Column[],
        empty: "No programme types registered yet.",
        create: {
          button: "Add programme type",
          title: "New programme type",
          fields: [
            { name: "name", label: "Type name", type: "text", required: true, placeholder: "Diploma" },
            { name: "code", label: "Code", type: "text", required: true, hint: "Short letters used in every programme code of this type, e.g. DIP." },
          ] satisfies Field[],
        },
        edit: {
          button: "Edit",
          title: "Edit programme type",
          fields: [
            { name: "name", label: "Type name", type: "text", required: true },
            {
              name: "code",
              label: "Code",
              type: "text",
              required: true,
              hint: "Used on new programme codes only. Codes already issued keep their old letters.",
            },
          ] satisfies Field[],
          done: "Programme type updated.",
        },
        remove: {
          button: "Delete",
          blocked: "Programmes of this type are already on file, so it cannot be deleted.",
        },
      },
      cadences: {
        heading: "Fee payment type",
        description:
          "The payment types a programme can be billed on. Each one says how the programme duration becomes payable periods, so new methods are registered here rather than written into the code.",
        columns: [
          { key: "name", label: "Payment type" },
          { key: "kind", label: "Billing period" },
          { key: "programs", label: "Programmes", align: "end" },
        ] satisfies Column[],
        empty: "No payment types registered yet.",
        create: {
          button: "Add payment type",
          title: "New fee payment type",
          fields: [
            { name: "name", label: "Payment type name", type: "text", required: true, wide: true, placeholder: "Per semester" },
            {
              name: "kind",
              label: "Billing period",
              type: "select",
              required: true,
              wide: true,
              options: toOptions(labels.feePeriodKind),
              hint: "Decides how many fee rows a programme gets, and whether they follow the academic calendar.",
            },
          ] satisfies Field[],
        },
        edit: {
          button: "Edit",
          title: "Edit payment type",
          fields: [
            { name: "name", label: "New name", type: "text", required: true, wide: true },
            { name: "kind", label: "Billing period", type: "select", required: true, wide: true, options: toOptions(labels.feePeriodKind) },
          ] satisfies Field[],
          done: "Payment type renamed.",
        },
        remove: {
          button: "Delete",
          blocked: "Programmes are already billed on this payment type, so it cannot be deleted.",
        },
      },
    },
    departments: {
      heading: "Departments",
      description: "Add a department once, then pick it on every programme in it.",
      columns: [
        { key: "name", label: "Department" },
        { key: "programs", label: "Programmes", align: "end" },
      ] satisfies Column[],
      empty: "No departments yet. Add one before creating a programme.",
      create: {
        button: "Add department",
        title: "New department",
        fields: [
          { name: "name", label: "Department name", type: "text", required: true, wide: true },
        ] satisfies Field[],
      },
    },
    duration: (months: number) => `${months} months`,
  },

  tutors: {
    title: "Tutors",
    searchLabel: "Search by name, staff number or department",
    columns: [
      { key: "staffNo", label: "Staff no." },
      { key: "fullName", label: "Name" },
      { key: "contact", label: "Contact" },
      { key: "department", label: "Department" },
      { key: "programs", label: "Programmes" },
      { key: "load", label: "Weekly hours", align: "end" },
      { key: "status", label: "Account" },
    ] satisfies Column[],
    empty: {
      title: "No tutors on this campus",
      body: "Add a tutor.",
    },
    create: {
      button: "Add tutor",
      title: "New tutor",
      fields: [
        { name: "fullName", label: "Full name", type: "text", required: true },
        { name: "email", label: "Email (sign-in)", type: "email", required: true },
        { name: "phone", label: "Phone", type: "tel" },
        { name: "staffNo", label: "Staff number", type: "text", hint: "Leave blank to issue one automatically." },
        { name: "password", label: "Temporary password", type: "text", required: true, hint: "Minimum 10 characters." },
        { name: "title", label: "Title", type: "text", placeholder: "Asst. Lecturer" },
        { name: "department", label: "Department", type: "text" },
        { name: "programIds", label: "Programme taught", type: "select", optionKey: "programs" },
      ] satisfies Field[],
      created: "Tutor saved.",
    },
    status: {
      approve: "Approve account",
      approved: "Account approved.",
    },
  },

  timetable: {
    title: "Timetable",
    days: Object.keys(labels.weekday) as (keyof typeof labels.weekday)[],
    create: {
      button: "Add class",
      title: "New class slot",
      fields: [
        { name: "programId", label: "Programme", type: "select", required: true, optionKey: "programs" },
        { name: "tutorId", label: "Tutor", type: "select", optionKey: "tutors" },
        { name: "day", label: "Day", type: "select", required: true, options: toOptions(labels.weekday) },
        { name: "startAt", label: "Starts", type: "time", required: true },
        { name: "endAt", label: "Ends", type: "time", required: true },
        { name: "room", label: "Room", type: "text" },
        { name: "weekOffsetLabel", label: "Weeks", type: "text", placeholder: "Alt weeks only" },
      ] satisfies Field[],
      created: "Class added.",
    },
    unassignedTutor: "No tutor set",
    emptyDay: "No classes",
    conflict: "Two classes for the same programme overlap on that day.",
  },

  calendar: {
    title: "Academic calendar",
    /**
     * The calendar is the institution's own schedule — teaching weeks, exams, holidays. It is
     * not a statement of what semester any student is in; that depends on their intake.
     */
    description:
      "The campus calendar: teaching windows, exams and events. What semester a student is in comes from their intake, not from this page.",
    year: {
      select: "Year",
      show: "Show",
      previous: "Previous year",
      next: "Next year",
      heading: "Semester windows for",
      closed: "Closed for changes",
      closedTitle: "Changes closed",
      closedBody: (year: number) => `The calendar for ${year} can no longer be changed.`,
    },
    campus: {
      select: "Campus",
    },
    semesters: {
      heading: "Semesters",
      empty: "Nothing configured for this year yet.",
      slot: "Semester",
      notConfigured: "Not configured.",
      window: "Runs",
      through: "to",
      configure: "Configure",
      endedNote: (date: string) => `Ended ${date}`,
      intakesHeading: "Intake windows",
      emptyIntakes: "No intake window on this semester.",
      examsHeading: "Exam dates",
      emptyExams: "No exam dates on this semester.",
      cardsHeading: "Cards issued",
      emptyCards: "No cards issued in this window.",
      eventsHeading: "Events",
      emptyEvents: "No events on this semester.",
      /* The timeline: one row per semester, only the current one expanded. */
      current: "Current",
      nowRunning: "Running now",
      showDetails: "Show details",
      hideDetails: "Hide details",
      nothingScheduled: "Nothing scheduled yet — no intakes, exams or events.",
      weekOf: "Week",
      of: "of",
      intakeDeadline: "Apply by",
      intakeStarts: "Classes start",
      intakeEnds: "Ends",
      summaryCount: (intakes: number, exams: number, events: number) =>
        [
          intakes ? `${intakes} intake${intakes === 1 ? "" : "s"}` : null,
          exams ? `${exams} exam${exams === 1 ? "" : "s"}` : null,
          events ? `${events} event${events === 1 ? "" : "s"}` : null,
        ]
          .filter(Boolean)
          .join(" · "),
      create: {
        button: "Add semester",
        title: "New semester",
        fields: [
          { name: "campusId", label: "Campus", type: "select", required: true, optionKey: "campuses" },
          { name: "year", label: "Year", type: "select", required: true, optionKey: "years" },
          {
            name: "semesterNo",
            label: "Semester",
            type: "select",
            required: true,
            options: [
              { value: "1", label: "Semester 1" },
              { value: "2", label: "Semester 2" },
              { value: "3", label: "Semester 3" },
            ],
          },
          { name: "startDate", label: "Semester starts", type: "date", required: true },
          { name: "endDate", label: "Semester ends", type: "date", required: true },
        ] satisfies Field[],
        created: "Semester saved.",
      },
      edit: {
        button: "Change dates",
        title: "Change the semester window",
        fields: [
          { name: "startDate", label: "Semester starts", type: "date", required: true },
          { name: "endDate", label: "Semester ends", type: "date", required: true },
          { name: "status", label: "Status", type: "select", required: true, options: toOptions(labels.semesterStatus) },
        ] satisfies Field[],
        saved: "Semester updated.",
      },
      intake: {
        button: "Add intake",
        title: "New intake",
        fields: [
          // Only a super admin sees this; a campus admin is pinned to their own campus.
          { name: "campusId", label: "Campus", type: "select", required: true, optionKey: "campuses" },
          {
            name: "name",
            label: "Name",
            type: "text",
            required: false,
            placeholder: "January 2026 intake",
            hint: "Leave blank to name it after its month and year.",
          },
          {
            name: "startsAt",
            label: "Intake begins",
            type: "date",
            required: true,
            hint: "Start of January, May or September only. This fixes the intake's month.",
          },
          {
            name: "endsAt",
            label: "Intake ends",
            type: "date",
            required: true,
            hint: "The last day of this intake. Must fall after the start.",
          },
          {
            name: "applicationDeadline",
            label: "Applications close",
            type: "date",
            required: true,
            hint: "Soonest a new applicant may no longer choose this intake on the public form.",
          },
        ] satisfies Field[],
        created: "Intake saved.",
        note:
          "There are three intakes a year — January, May and September — while admissions run every month. A student admitted in February or March still joins the January intake, so pick the intake they belong to, not the month they applied.",
        empty: "No intakes recorded for this year yet.",
        endBeforeStart: "The intake cannot end before it starts.",
        notAnOfficialMonth:
          "Intakes start in January, May or September only. Pick a start date in one of those months.",
        deadlineAfterStart:
          "Applications must close before the intake begins, otherwise a new applicant is offered a cohort that has already started.",
        chooseCampus: "Choose a campus before adding an intake — an intake belongs to one campus.",
      },
    },
    events: {
      heading: "Events",
      empty: "No events for this year.",
      create: {
        button: "Add event",
        title: "New event",
        fields: [
          { name: "title", label: "Title", type: "text", required: true, wide: true },
          { name: "type", label: "Type", type: "select", required: true, options: toOptions(labels.calendarEventType) },
          { name: "startsAt", label: "Starts", type: "date", required: true },
          { name: "endsAt", label: "Ends", type: "date" },
          { name: "description", label: "Detail", type: "textarea", wide: true },
        ] satisfies Field[],
        created: "Event saved.",
      },
      college: {
        heading: "College-wide entries",
        empty: "Nothing posted to every campus.",
        button: "Add college-wide entry",
        title: "New college-wide entry",
        fields: [
          { name: "title", label: "Title", type: "text", required: true, wide: true },
          { name: "type", label: "Type", type: "select", required: true, options: toOptions(labels.calendarEventType) },
          { name: "startsAt", label: "Starts", type: "date", required: true },
          { name: "endsAt", label: "Ends", type: "date" },
          { name: "description", label: "Detail", type: "textarea", wide: true },
        ] satisfies Field[],
        created: "Entry saved.",
      },
      collegeWide: "All campuses",
      thisCampus: "This campus",
    },
  },

  exams: {
    title: "Exams",
    searchLabel: "Search by paper title or room",
    columns: [
      { key: "title", label: "Paper" },
      { key: "program", label: "Programme" },
      { key: "type", label: "Type" },
      { key: "date", label: "Date" },
      { key: "window", label: "Time" },
      { key: "room", label: "Room" },
      { key: "invigilator", label: "Invigilator" },
      { key: "status", label: "Status" },
    ] satisfies Column[],
    empty: {
      title: "No exams scheduled",
      body: "Schedule an exam.",
    },
    create: {
      button: "Schedule exam",
      title: "New exam",
      fields: [
        { name: "title", label: "Paper title", type: "text", required: true, wide: true },
        { name: "programId", label: "Programme", type: "select", required: true, optionKey: "programs" },
        { name: "semesterId", label: "Semester", type: "select", optionKey: "semesters" },
        {
          name: "type",
          label: "Type",
          type: "select",
          required: true,
          options: toOptions(labels.examType),
        },
        { name: "date", label: "Date", type: "date", required: true },
        { name: "startAt", label: "Starts", type: "time", required: true },
        { name: "durationMinutes", label: "Duration (minutes)", type: "number", step: "15" },
        { name: "room", label: "Room", type: "text" },
        { name: "invigilatorId", label: "Invigilator", type: "select", optionKey: "tutors" },
        { name: "status", label: "Status", type: "select", required: true, options: toOptions(labels.examStatus) },
      ] satisfies Field[],
      created: "Exam saved.",
    },
    grades: {
      heading: "Marks",
      empty: "No enrollments on this programme yet.",
      columns: [
        { key: "admissionNo", label: "Admission no." },
        { key: "student", label: "Student" },
        { key: "score", label: "Score", align: "end" },
        { key: "maxScore", label: "Out of", align: "end" },
        { key: "pct", label: "%", align: "end" },
        { key: "published", label: "Published" },
      ] satisfies Column[],
      record: {
        title: "Record or update a mark",
        fields: [
          { name: "enrollmentId", label: "Enrollment", type: "select", required: true, optionKey: "enrollments" },
          { name: "score", label: "Score", type: "number", required: true, step: "0.5" },
          { name: "maxScore", label: "Out of", type: "number", required: true, step: "1" },
          { name: "remark", label: "Remark", type: "text" },
          { name: "published", label: "Publish to student", type: "checkbox" },
        ] satisfies Field[],
        saved: "Mark saved.",
      },
      publishAll: "Publish every mark on this paper",
      published: "Marks published.",
      summary: (entered: number, total: number) => `${entered} of ${total} enrollments marked`,
    },
  },

  accounts: {
    title: "Accounts",
    searchLabel: "Search by invoice number or student",
    summary: {
      billed: "Billed",
      collected: "Collected",
      outstanding: "Outstanding",
      paidCount: "Invoices settled",
    },
    invoiceColumns: [
      { key: "number", label: "Invoice" },
      { key: "student", label: "Student" },
      { key: "issued", label: "Issued" },
      { key: "dueAt", label: "Due" },
      { key: "total", label: "Total", align: "end" },
      { key: "paid", label: "Paid", align: "end" },
      { key: "balance", label: "Balance", align: "end" },
      { key: "status", label: "Status" },
    ] satisfies Column[],
    /** One invoice, one card at every width — the same treatment as programmes and students. */
    card: {
      open: "Open student",
      invoice: "Invoice",
      issued: "Issued",
      due: "Due",
      billed: "Billed",
      paid: "Paid",
      balance: "Balance",
      settled: "Settled",
      lines: "Line items",
      payments: "Payments",
      details: "Details",
      addLine: "Add an item",
      void: "Void",
      noLines: "No items on this invoice yet.",
      noPayments: "Nothing received yet.",
    },
    empty: {
      title: "No invoices match",
      body: "Raise an invoice or clear the filters.",
    },
    create: {
      button: "Raise invoice",
      title: "New invoice",
      fields: [
        { name: "studentId", label: "Student", type: "select", required: true, optionKey: "students" },
        { name: "semesterId", label: "Semester", type: "select", optionKey: "semesters" },
        { name: "dueAt", label: "Due date", type: "date" },
        { name: "note", label: "Note on the invoice", type: "textarea", wide: true },
      ] satisfies Field[],
      linesHeading: "Line items",
      copyLines: (total: number) => `Copied ${total} fee components.`,
      created: "Invoice raised.",
      lineFields: [
        { name: "label", label: "Item", type: "text", required: true },
        { name: "amount", label: "Amount (KES)", type: "number", required: true, step: "0.01" },
      ] satisfies Field[],
      lineAdd: { name: "addLine", label: "Add another item", type: "checkbox" },
    },
    payment: {
      button: "Record payment",
      title: "Record a payment",
      fields: [
        { name: "invoiceId", label: "Invoice", type: "select", required: true, optionKey: "invoices" },
        { name: "amount", label: "Amount received (KES)", type: "number", required: true, step: "0.01" },
        { name: "method", label: "Method", type: "select", required: true, options: toOptions(labels.paymentMethod) },
        { name: "reference", label: "Reference", type: "text", placeholder: "M-Pesa code, cheque no." },
        { name: "paidAt", label: "Paid on", type: "date", required: true },
      ] satisfies Field[],
      created: "Payment recorded.",
      student: {
        button: "Record a student payment",
        title: "Payment against a fee schedule",
        hint: "The money is placed on the oldest unpaid period first, then the next, so one receipt can settle several periods.",
        fields: [
          { name: "studentId", label: "Student", type: "select", required: true, optionKey: "students" },
          { name: "amount", label: "Amount received (KES)", type: "number", required: true, step: "0.01" },
          { name: "method", label: "Method", type: "select", required: true, options: toOptions(labels.paymentMethod) },
          { name: "reference", label: "Reference", type: "text", placeholder: "M-Pesa code, cheque no." },
          { name: "paidAt", label: "Paid on", type: "date", required: true },
        ] satisfies Field[],
        overpay: (outstanding: string) => `That is more than the ${outstanding} this student owes.`,
        nothingOwed: "This student has no outstanding fee periods.",
      },
    },
    finance: {
      title: "Finance overview",
      description: "What the fee schedules expect, what has come in, and what is late.",
      expected: "Expected fees",
      collected: "Collected",
      outstanding: "Outstanding",
      overdue: "Overdue",
      overdueCount: (count: number) => `${count} overdue ${count === 1 ? "period" : "periods"}`,
      byProgram: "Revenue by programme",
      byPeriod: "Revenue by academic period",
      byPeriodEmpty: "Periods appear here once fee schedules are generated.",
      columns: [
        { key: "name", label: "Programme" },
        { key: "expected", label: "Expected", align: "end" },
        { key: "collected", label: "Collected", align: "end" },
        { key: "outstanding", label: "Outstanding", align: "end" },
      ] satisfies Column[],
      periodColumns: [
        { key: "name", label: "Academic period" },
        { key: "expected", label: "Expected", align: "end" },
        { key: "collected", label: "Collected", align: "end" },
        { key: "outstanding", label: "Outstanding", align: "end" },
      ] satisfies Column[],
      empty: "No fee schedules have been generated yet.",
    },
    void: { button: "Void invoice", done: "Invoice voided." },
  },

  cards: {
    title: "ID cards",
    description: "Card requests and printing status for this campus.",
    searchLabel: "Search by serial or admission number",
    columns: [
      { key: "serial", label: "Serial" },
      { key: "student", label: "Student" },
      { key: "program", label: "Programme" },
      { key: "status", label: "Status" },
      { key: "issuedAt", label: "Issued" },
      { key: "expiresAt", label: "Expires" },
    ] satisfies Column[],
    openLabel: "Open card",
    empty: {
      title: "No cards recorded",
      body: "Request a card or generate one for a class.",
    },
    create: {
      button: "Request card",
      title: "New card request",
      fields: [
        { name: "studentId", label: "Student", type: "select", required: true, optionKey: "students" },
        { name: "programId", label: "Programme", type: "select", optionKey: "programs" },
        { name: "expiresAt", label: "Valid until", type: "date" },
        { name: "remarks", label: "Remarks", type: "text", wide: true },
      ] satisfies Field[],
      created: "Card requested.",
      /** Written on every card raised by a print run, so its origin is on the record. */
      autoRemark: "Requested from a card print run.",
    },
    move: {
      title: "Move card",
      statusField: { name: "status", label: "Status", type: "select", required: true, options: toOptions(labels.cardStatus) } satisfies Field,
      saved: "Card updated.",
    },
    generate: {
      title: "Print cards",
      hint: "Every enrolled student already holds a card, issued the day they enrolled. Choose who to print for and download the sheets.",
      targetLegend: "Print for",
      kinds: {
        student: "One student",
        class: "A class",
        intake: "An intake",
      },
      studentLabel: "Student",
      classLabel: "Class",
      intakeLabel: "Intake",
      previewEmpty: "Choose a target to see who will be printed.",
      preview: (count: number) => `${count} ${count === 1 ? "card" : "cards"} will be printed.`,
      noPhoto: "no photo",
      button: "Create PDF",
      sheetCaption: (page: number, total: number) => `EAVI student ID cards · sheet ${page} of ${total}`,
      frontLabel: "FRONT",
      backLabel: "BACK",
      limits: {
        empty: "Nobody matches that choice, so there is nothing to print.",
        tooMany: "That is more than 400 cards in one run. Choose a class or an intake instead.",
        saved: "The cards were generated. Card files are kept in the campus's own storage.",
      history: "Recent print runs",
      },
    },
    detail: {
      title: "ID card",
      openStudent: "Open student",
      details: "Card record",
      student: "Student",
      serial: "Serial",
      status: "Status",
      issued: "Issued",
      expires: "Expires",
      requested: "Requested",
      remarks: "Remarks",
      face: "Card face",
      faceHint: "Exactly what will print, front and back.",
      missingTitle: "Missing from the record",
      missing: (slots: string) => `No value for: ${slots}. Those fields print as a dash.`,
      history: "History",
      noHistory: "Nothing has happened to this card yet.",
    },
    history: "Recent print runs",
    batch: {
      title: "Card print run",
      summary: "What this run covers",
      target: "Target",
      cards: "Cards",
      sheets: "Sheets",
      created: "Generated",
      generatedBy: "Generated by",
      back: "Back to cards",
      preview: "Preview",
      previewTitle: "Card sheets",
      previewHint: (sheets: number) => `${sheets} ${sheets === 1 ? "sheet" : "sheets"}, fronts and backs. Check before printing.`,
      download: "Download PDF",
      fileName: (date: Date) => `eavi-id-cards-${date.toISOString().slice(0, 10)}.pdf`,
      noViewer: "This browser cannot show PDFs in the page.",
      verifyHint: "The QR on the back opens this link: it is checked against the register, so a copied card fails.",
      noFileTitle: "The file was not kept",
      noFileBody: "Card storage is not configured, so this run cannot be reopened. Generate the cards again to print them.",
      emptyTitle: "No cards in this run",
      emptyBody: "Nobody was included, so there is nothing to print.",
    },
    print: {
      heading: "Card face",
      institution: "East Africa Vision Institute",
      studentLabel: "Student",
      programmeLabel: "Programme",
      validLabel: "Valid until",
      serialLabel: "Serial",
      campusLabel: "Campus",
      open: "Print view",
      closed: "Hide print view",
      /** Shown on a proof when the record is missing something the artwork needs. */
      missing: (slots: string) => `The record has no value for: ${slots}.`,
    },
  },

  reports: {
    title: "Reports",
    generated: (date: string) => `Generated ${date}`,
    blocks: {
      admissions: {
        title: "Applications by outcome",
        empty: "No applications to report on.",
        columns: [
          { key: "status", label: "Outcome" },
          { key: "count", label: "Applications", align: "end" },
          { key: "share", label: "Share", align: "end" },
        ] satisfies Column[],
      },
      enrollment: {
        title: "Enrollments by programme",
        empty: "No active enrollments to report on.",
        columns: [
          { key: "program", label: "Programme" },
          { key: "type", label: "Programme type" },
          { key: "count", label: "Students", align: "end" },
        ] satisfies Column[],
      },
      fees: {
        title: "Fee position",
        empty: "No invoices raised yet.",
        lines: {
          billed: "Billed",
          collected: "Collected",
          outstanding: "Outstanding",
          collectionRate: "Collection rate",
        },
      },
      debt: {
        title: "Largest outstanding balances",
        empty: "Nothing outstanding.",
        columns: [
          { key: "student", label: "Student" },
          { key: "admissionNo", label: "Admission no." },
          { key: "balance", label: "Balance", align: "end" },
          { key: "invoices", label: "Open invoices", align: "end" },
        ] satisfies Column[],
      },
      results: {
        title: "Marks recorded",
        empty: "No marks entered yet.",
        columns: [
          { key: "exam", label: "Paper" },
          { key: "entered", label: "Marked", align: "end" },
          { key: "average", label: "Average %", align: "end" },
          { key: "published", label: "Published", align: "end" },
        ] satisfies Column[],
      },
      tutors: {
        title: "Teaching load",
        empty: "No timetable slots recorded.",
        columns: [
          { key: "tutor", label: "Tutor" },
          { key: "slots", label: "Weekly classes", align: "end" },
          { key: "hours", label: "Weekly hours", align: "end" },
        ] satisfies Column[],
      },
      cards: {
        title: "Card pipeline",
        empty: "No cards requested.",
        columns: [
          { key: "status", label: "Stage" },
          { key: "count", label: "Cards", align: "end" },
        ] satisfies Column[],
      },
    },
    print: "Print",
  },

  communication: {
    title: "Communication",
    scopeCampus: "This campus",
    scopeCollege: "All campuses",
    publishedOn: "Published",
    author: "Posted by",
    pinned: "Pinned",
    empty: {
      title: "No notices yet",
      body: "Write a notice.",
    },
    create: {
      button: "Write a notice",
      title: "New notice",
      fields: [
        { name: "title", label: "Headline", type: "text", required: true, wide: true },
        { name: "body", label: "Message", type: "textarea", required: true, wide: true },
        { name: "audience", label: "Audience", type: "select", required: true, options: toOptions(labels.audience) },
        { name: "scope", label: "Where it appears", type: "select", options: [{ value: "campus", label: "This campus" }, { value: "college", label: "All campuses" }] },
        { name: "pinned", label: "Keep at the top", type: "checkbox" },
      ] satisfies Field[],
      created: "Notice published.",
    },
    remove: { button: "Withdraw", done: "Notice withdrawn." },
  },

  campuses: {
    title: "Campuses",
    heading: "Campus register",
    description: "Every campus the college runs. Edits apply to every portal screen at once.",
    yes: "Yes",
    no: "No",
    columns: [
      { key: "code", label: "Code" },
      { key: "name", label: "Campus" },
      { key: "place", label: "Address" },
      { key: "phone", label: "Phone" },
      { key: "applicants", label: "Takes applicants" },
      { key: "students", label: "Students", align: "end" },
      { key: "tutors", label: "Tutors", align: "end" },
      { key: "actions", label: "Edit", interactive: true },
    ] satisfies Column[],
    empty: { title: "No campuses yet", body: "Add the first campus." },
    create: {
      button: "Add campus",
      title: "New campus",
      fields: [
        { name: "code", label: "Campus code", type: "text", required: true, placeholder: "MAIN" },
        { name: "name", label: "Name", type: "text", required: true },
        { name: "place", label: "Address", type: "text", required: true, wide: true },
        { name: "phone", label: "Phone", type: "tel" },
        { name: "takesApplicants", label: "Takes applicants", type: "checkbox" },
      ] satisfies Field[],
      created: "Campus saved.",
    },
    edit: {
      button: "Edit",
      fields: [
        { name: "name", label: "Name", type: "text", required: true },
        { name: "place", label: "Address", type: "text", required: true, wide: true },
        { name: "phone", label: "Phone", type: "tel" },
        { name: "takesApplicants", label: "Takes applicants", type: "checkbox" },
      ] satisfies Field[],
    },
  },

  staff: {
    title: "Staff approvals",
    heading: "Staff accounts",
    description: "Tutors and college admins who registered themselves wait here until you approve them.",
    ownAccount: "You cannot change your own account here.",
    noRecord: "Teaching record missing",
    approve: "Approve",
    disable: "Disable",
    enable: "Enable",
    yes: "Yes",
    columns: [
      { key: "name", label: "Name" },
      { key: "role", label: "Role" },
      { key: "campus", label: "Campus" },
      { key: "record", label: "Teaching record" },
      { key: "status", label: "Account" },
      { key: "actions", label: "Action", interactive: true },
    ] satisfies Column[],
    empty: { title: "No staff accounts", body: "Staff who register appear here." },
  },

  profile: {
    title: "Profile and settings",
    description: "Your own picture, the address you sign in with and your password.",
    photo: {
      ...profilePhoto,
      fields: [
        {
          name: "photo",
          label: profilePhoto.file,
          type: "file",
          accept: "image/*",
          required: true,
          hint: profilePhoto.hint,
          wide: true,
        },
      ] satisfies Field[],
    },
    email: {
      heading: "Sign-in email",
      description: "This is the address you type at the sign-in screen.",
      current: "Current email",
      fields: [
        { name: "email", label: "New sign-in email", type: "email", required: true, wide: true },
      ] satisfies Field[],
      button: "Change email",
      done: "Sign-in email updated.",
    },
    password: {
      heading: "Login password",
      description: "Your current password proves it is you; the new one is typed twice.",
      fields: [
        { name: "currentPassword", label: "Current password", type: "password", required: true },
        { name: "password", label: "New password", type: "password", required: true },
        { name: "confirmPassword", label: "Confirm new password", type: "password", required: true },
      ] satisfies Field[],
      button: "Change password",
      done: "Password changed.",
    },
    signedInAs: (name: string, role: string) => `${name} · ${role}`,
  },
} as const;

/** Builds the static select choices from an enum label map. */
function toOptions(map: Record<string, string>) {
  return Object.entries(map).map(([value, label]) => ({ value, label }));
}

/** Every string the tutor portal shows. */
export const tutorPortal = {
  home: {
    title: "Today",
    greeting: "Hello,",
    description: "Your classes today and the papers you invigilate.",
    classes: "Classes today",
    noClasses: "No classes timetabled for today.",
    sunday: "Sunday: no classes are timetabled.",
    papers: "Invigilating ahead",
    noPapers: "No papers ahead of you.",
    open: "Papers open for marks",
    room: "Room not set",
  },
  timetable: {
    title: "Week timetable",
    description: "Your recurring classes, day by day.",
    emptyDay: "No classes",
  },
  exams: {
    title: "My invigilations",
    description: "Papers where you are the invigilator.",
    empty: { title: "No papers yet", body: "You are not assigned to invigilate any paper." },
    columns: [
      { key: "title", label: "Paper" },
      { key: "program", label: "Programme" },
      { key: "date", label: "Date" },
      { key: "window", label: "Time" },
      { key: "room", label: "Room" },
      { key: "status", label: "Status" },
    ] satisfies Column[],
  },
  marks: {
    title: "Marks to enter",
    description: "Open a paper to record marks for its students. Only papers you invigilate appear here.",
    entered: (marked: number, total: number) => `${marked} of ${total} marked`,
    empty: { title: "No papers to mark", body: "Papers you invigilate will appear here." },
    columns: [
      { key: "title", label: "Paper" },
      { key: "program", label: "Programme" },
      { key: "date", label: "Date" },
      { key: "marked", label: "Marked" },
      { key: "status", label: "Status" },
    ] satisfies Column[],
  },
  entry: {
    back: "Back to marks",
    publish: "Publish all marks on this paper",
    published: "Marks published.",
    saved: "Mark saved.",
    empty: "No active students on this programme yet.",
    yes: "Yes",
    no: "No",
    defaultMaxScore: "100",
    columns: [
      { key: "admissionNo", label: "Admission no." },
      { key: "student", label: "Student" },
      { key: "score", label: "Score", align: "end" },
      { key: "maxScore", label: "Out of", align: "end" },
      { key: "pct", label: "%", align: "end" },
      { key: "published", label: "Published" },
      { key: "actions", label: "Mark", interactive: true },
    ] satisfies Column[],
    fields: [
      { name: "score", label: "Score", type: "number", required: true, step: "0.5" },
      { name: "maxScore", label: "Out of", type: "number", required: true, step: "1" },
      { name: "remark", label: "Remark", type: "text" },
      { name: "published", label: "Publish to student", type: "checkbox" },
    ] satisfies Field[],
  },
  profile: {
    title: "My profile",
    description: "Your teaching record. The college office changes it.",
    staffNo: "Staff number",
    department: "Department",
    campus: "Campus",
    email: "Sign-in email",
    programmes: "Programmes taught",
    noProgrammes: "None assigned yet",
    weeklyHours: "Weekly hours",
  },
} as const;

export const pagination = {
  window: 20,
  label: (page: number, shown: number, total: number) =>
    `Page ${page} · showing ${shown} of ${total}`,
};

export const studentNavGroups: NavGroup[] = [
  {
    id: "study",
    label: "My studies",
    items: [
      { href: "/student", label: "Overview", icon: "overview" },
      { href: "/student/units", label: "My units", icon: "programs" },
      { href: "/student/classes", label: "My class", icon: "students" },
    ],
  },
  {
    id: "account",
    label: "My account",
    items: [
      { href: "/student/fees", label: "Fees", icon: "accounts" },
      { href: "/student/id", label: "Student card", icon: "cards" },
      { href: "/student/profile", label: "My details", icon: "profile" },
    ],
  },
];

/**
 * The student portal. Everything here is read-only and belongs to the signed-in student: a
 * student never edits marks, fees or their own programme from this side.
 */
export const studentPortal = {
  home: {
    title: "My dashboard",
    greeting: "Hello,",
    description: "Where you are in your programme, what you are studying, and what is due.",
    noEnrolment: {
      title: "No enrolment yet",
      body: "Your account is active but you have not been enrolled on a programme. Visit the admissions office with your acknowledgement letter and they will complete your enrolment.",
    },
    course: "My programme",
    place: "Where I am",
    year: "Year",
    semester: "Semester",
    intake: "Intake",
    class: "My class",
    noClass: "Not placed in a class yet",
    fees: "Fees",
    balance: "Balance due",
    cleared: "Fully paid",
    nextDue: "Next due",
    noDue: "Nothing due",
    units: "My units this semester",
    noUnits: "No units registered for this semester yet.",
    seeAll: "See all units",
    seeFees: "See fees",
    unitCount: "units",
  },
  units: {
    title: "My units",
    description: "Every unit in your programme, and how you are doing on each.",
    empty: "Your programme has no units on record yet.",
    thisSemester: "This semester",
    other: "Other semesters",
  },
  classes: {
    title: "My class",
    description: "The class you currently belong to, and any you belonged to before.",
    current: "Current class",
    note: "Note",
    previous: "Previous classes",
    none: {
      title: "Not placed in a class",
      body: "You are enrolled but have not been added to a class group. Your timetable and class chat will appear here once the office places you.",
    },
    tutor: "Class tutor",
    members: "Classmates",
    room: "Room",
    joined: "Joined",
    left: "Left",
  },
  fees: {
    title: "Fees",
    description: "What you have been billed and what you have paid.",
    empty: "No fees have been billed to you yet.",
    total: "Billed",
    paid: "Paid",
    balance: "Balance",
    columns: [
      { key: "invoice", label: "Invoice" },
      { key: "period", label: "Period" },
      { key: "due", label: "Due" },
      { key: "amount", label: "Amount" },
      { key: "status", label: "Status" },
    ] satisfies Column[],
    paymentsTitle: "Payments received",
    paymentsEmpty: "No payments recorded yet.",
    paymentColumns: [
      { key: "date", label: "Date" },
      { key: "reference", label: "Reference" },
      { key: "amount", label: "Amount" },
    ] satisfies Column[],
  },
  id: {
    title: "Student card",
    description: "Your campus identity card, and how to check that it is genuine.",
    none: {
      title: "No card issued yet",
      body: "Once your card has been printed and issued it will appear here, with a code anyone can scan to confirm it is genuine.",
    },
    issued: "Issued",
    serial: "Serial",
    valid: "Valid until",
    expired: "Expired",
    check: "Anyone can confirm this card is genuine by scanning the code on it.",
  },
  profile: {
    title: "My details",
    description: "The information the college holds for you.",
    admissionNo: "Admission number",
    campus: "Campus",
    email: "Email",
    phone: "Phone",
    gender: "Gender",
    dob: "Date of birth",
    guardian: "Guardian",
    guardianPhone: "Guardian phone",
    address: "Address",
    notSet: "Not recorded",
    changeNote: "To change any of these details, contact the admissions office.",
    genderLabel: {
      MALE: "Male",
      FEMALE: "Female",
      OTHER: "Other",
      UNDECLARED: "Not stated",
    } as Record<string, string>,
  },
};
