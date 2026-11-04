/**
 * Every string the college-admin portal shows. Components receive these as props or read
 * them from here; no screen hardcodes copy. Nothing in this file is college data — names,
 * figures and dates all come from the database.
 */

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
  | "communication";

export type FieldType =
  | "text"
  | "email"
  | "tel"
  | "date"
  | "time"
  | "number"
  | "select"
  | "textarea"
  | "checkbox";

export type Field = {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  hint?: string;
  placeholder?: string;
  step?: string;
  /** Rendered at full width instead of half width on wide screens. */
  wide?: boolean;
  /** Static choices, e.g. an enum. */
  options?: { value: string; label: string }[];
  /** Choices loaded from the database by the screen. */
  optionKey?:
    | "programs"
    | "students"
    | "tutors"
    | "terms"
    | "intakes"
    | "enrollments"
    | "invoices"
    | "feeItems";
};

export type Column = { key: string; label: string; align?: "end" };

export const shell = {
  brandName: "EAVI Portal",
  brandNote: "College administration",
  navLabel: "Portal sections",
  skipToContent: "Skip to content",
  openMenu: "Open section menu",
  closeMenu: "Close section menu",
  campusScope: "Viewing",
  allCampuses: "All campuses",
  account: {
    label: "Account",
    signedInAs: "Signed in as",
    role: "Role",
    signOut: "Sign out",
    home: "Go to eavi.ac.ke",
  },
  unavailable: {
    title: "This portal is not open yet",
    body: "The tutor and student portals are being built. Sign in again with a college administration account to use this area.",
    unassigned:
      "This administrator account is not attached to a campus yet, so there is nothing to show. A super admin must assign the campus before signing in again.",
  },
};

export const roles = {
  SUPERADMIN: "Super admin",
  CAMPUS_ADMIN: "College admin",
  TUTOR: "Tutor",
  STUDENT: "Student",
} as const;

export const navGroups: {
  id: string;
  label: string;
  items: { href: string; label: string; icon: DashboardIcon }[];
}[] = [
  {
    id: "administration",
    label: "Administration",
    items: [{ href: "/dashboard", label: "Overview", icon: "overview" }],
  },
  {
    id: "admissions",
    label: "Admissions",
    items: [
      { href: "/dashboard/applications", label: "Applications", icon: "applications" },
      { href: "/dashboard/students", label: "Students", icon: "students" },
      { href: "/dashboard/enrollments", label: "Enrollments", icon: "enrollments" },
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
    ],
  },
];

export const common = {
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
  errorTitle: "Could not save",
  invalidSubmit:
    "Some answers are missing or in the wrong format. Check the fields and send the form again — nothing was saved.",
  retry: "Try again",
  loadError: "The portal could not read this screen from the college records.",
  notFoundTitle: "Not on this campus",
  notFoundBody: "Either the record does not exist or it belongs to another campus.",
};

/** Wording for a form the administrator filled in wrongly. The field name is supplied. */
export const fieldErrors = {
  required: (label: string) => `${label} is required.`,
  number: (label: string) => `${label} must be a number.`,
  date: (label: string) => `${label} is not a date I can read.`,
  choice: (label: string) => `${label} is not one of the listed choices.`,
  time: (label: string) => `${label} must be a 24-hour time such as 09:30.`,
  timeOrder: "The end time must be later than the start time.",
  dateOrder: "The end date must be later than the start date.",
  password: (label: string) => `${label} needs at least 10 characters.`,
  email: (label: string) => `${label} is not a valid email address.`,
  phone: (label: string) => `${label} is not a Kenyan phone number.`,
  duplicate: (label: string) => `That ${label} is already on file.`,
  notOnCampus: "That record is not on your campus, so it was not changed.",
  exhausted: "There are too many records to issue a fresh reference number. Contact the software team.",
};

/** Enum value -> the wording a college administrator reads. */
export const labels = {
  role: roles,
  programLevel: {
    CERTIFICATE: "Certificate",
    DIPLOMA: "Diploma",
    HIGHER_DIPLOMA: "Higher diploma",
    DEGREE: "Degree",
    SHORT_COURSE: "Short course",
  },
  applicationStatus: {
    SUBMITTED: "Submitted",
    REVIEWING: "Under review",
    APPROVED: "Approved",
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
  calendarEventType: {
    ACADEMIC: "Academic",
    HOLIDAY: "Holiday",
    EXAMINATION: "Examination",
    ADMISSION: "Admission",
    FINANCE: "Finance",
    MEETING: "Meeting",
  },
  termStatus: {
    PLANNED: "Planned",
    ACTIVE: "Running",
    COMPLETED: "Completed",
  },
  gender: {
    MALE: "Male",
    FEMALE: "Female",
    OTHER: "Other",
    UNDECLARED: "Prefer not to say",
  },
  userStatus: {
    ACTIVE: "Active",
    PENDING: "Awaiting approval",
    DISABLED: "Disabled",
  },
} as const;

export const pages = {
  overview: {
    title: "Overview",
    description: "The numbers your campus is sitting on right now.",
    scopeNote: (campusName: string) => `Figures cover ${campusName} only.`,
    kpis: [
      { key: "students", label: "Students", icon: "students", hint: "Admitted profiles" },
      { key: "activeEnrollments", label: "Active enrollments", icon: "enrollments", hint: "Currently studying" },
      { key: "applicationsOpen", label: "Applications to review", icon: "applications", hint: "Submitted or in review" },
      { key: "tutors", label: "Tutors", icon: "tutors", hint: "Attached to this campus" },
      { key: "billed", label: "Billed", icon: "accounts", hint: "Invoice totals" },
      { key: "collected", label: "Collected", icon: "accounts", hint: "Payments recorded" },
      { key: "outstanding", label: "Outstanding", icon: "accounts", hint: "Billed minus collected" },
      { key: "cardsPending", label: "Cards pending", icon: "cards", hint: "Not yet issued" },
    ] as const,
    lists: {
      deadlines: "Application deadlines",
      deadlinesEmpty: "No intake deadlines on a running term.",
      events: "Coming up on the calendar",
      eventsEmpty: "Nothing scheduled. Add entries under Academic calendar.",
      exams: "Exams ahead",
      examsEmpty: "No exams scheduled yet.",
      recentStudents: "Most recent admissions",
      recentStudentsEmpty: "No students admitted yet. Use Students to add the first one.",
      announcements: "Latest notices",
      announcementsEmpty: "No notices published from this campus.",
    },
  },

  applications: {
    title: "Applications",
    description: "Prospective students, in the order they arrived.",
    searchLabel: "Search by name, reference, email or phone",
    columns: [
      { key: "reference", label: "Reference" },
      { key: "fullName", label: "Applicant" },
      { key: "contact", label: "Contact" },
      { key: "program", label: "Programme" },
      { key: "status", label: "Status" },
      { key: "received", label: "Received" },
    ] satisfies Column[],
    empty: {
      title: "No applications match",
      body: "Log a walk-in application with the form above, or clear the filters.",
    },
    detail: {
      previousQualification: "Previous qualification",
      notes: "Notes",
      decision: "Decision",
      decidedBy: "Decided by",
      decidedAt: "Decided on",
      student: "Admitted student",
      admit: "Admit to this campus",
      enrollNote: "Approving creates the student record and an active enrollment.",
    },
    create: {
      button: "Log an application",
      title: "New application",
      fields: [
        { name: "fullName", label: "Applicant name", type: "text", required: true },
        { name: "email", label: "Email", type: "email", required: true },
        { name: "phone", label: "Phone", type: "tel", required: true },
        { name: "programId", label: "Programme", type: "select", required: true, optionKey: "programs" },
        { name: "previousQualification", label: "Previous qualification", type: "text", wide: true },
        { name: "notes", label: "Notes", type: "textarea", wide: true },
      ] satisfies Field[],
    },
    decision: {
      button: "Record decision",
      approve: "Approve and admit",
      reject: "Reject",
      review: "Move to review",
      status: "Decision",
      statusField: { name: "decision", label: "Decision", type: "select", required: true } satisfies Field,
      note: { name: "decisionNote", label: "Reason or note for the file", type: "textarea", wide: true },
      admitted: "Application approved and the student record created.",
      saved: "Decision saved.",
    },
  },

  students: {
    title: "Students",
    description: "Every student admitted to this campus.",
    searchLabel: "Search by name, admission number or guardian",
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
      body: "Admit an approved application, or register a student directly with the form above.",
    },
    create: {
      button: "Register a student",
      title: "New student",
      fields: [
        { name: "fullName", label: "Full name", type: "text", required: true },
        { name: "email", label: "Email (sign-in)", type: "email", required: true },
        { name: "phone", label: "Phone", type: "tel" },
        { name: "programId", label: "Programme", type: "select", required: true, optionKey: "programs" },
        { name: "intakeId", label: "Intake", type: "select", optionKey: "intakes" },
        { name: "admissionNo", label: "Admission number", type: "text", hint: "Leave blank to have the system issue one." },
        { name: "password", label: "Temporary password", type: "text", required: true, hint: "Minimum 10 characters. The student changes it after signing in." },
        { name: "gender", label: "Gender", type: "select", options: toOptions(labels.gender) },
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
      academic: "Academic",
      finance: "Fees",
      cards: "Cards",
      enrollments: "Enrollments",
      invoices: "Invoices",
    },
  },

  enrollments: {
    title: "Enrollments",
    description: "Which student is studying which programme, and in which cohort.",
    searchLabel: "Search by admission number or cohort",
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
      body: "Approving an application creates one automatically, or enroll an existing student here.",
    },
    create: {
      button: "Enroll a student",
      title: "New enrollment",
      fields: [
        { name: "studentId", label: "Student", type: "select", required: true, optionKey: "students" },
        { name: "programId", label: "Programme", type: "select", required: true, optionKey: "programs" },
        { name: "intakeId", label: "Intake", type: "select", optionKey: "intakes" },
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
    description: "The catalogue your campus teaches.",
    columns: [
      { key: "code", label: "Code" },
      { key: "name", label: "Programme" },
      { key: "level", label: "Level" },
      { key: "duration", label: "Duration" },
      { key: "students", label: "Enrolled", align: "end" },
      { key: "feeTotal", label: "Fees per term", align: "end" },
    ] satisfies Column[],
    empty: {
      title: "No programmes yet",
      body: "Add the programmes this campus runs before admissions can be logged.",
    },
    create: {
      button: "Add programme",
      title: "New programme",
      fields: [
        { name: "code", label: "Code", type: "text", required: true, placeholder: "DIT-101" },
        { name: "name", label: "Name", type: "text", required: true, wide: true },
        { name: "level", label: "Level", type: "select", required: true, options: toOptions(labels.programLevel) },
        { name: "durationMonths", label: "Duration (months)", type: "number", required: true, step: "1" },
        { name: "description", label: "Description", type: "textarea", wide: true },
      ] satisfies Field[],
      created: "Programme saved.",
    },
    duration: (months: number) => `${months} months`,
    feeItems: {
      heading: "Fee components",
      description: "What a student on each programme is billed for. Invoices copy these lines.",
      columns: [
        { key: "program", label: "Programme" },
        { key: "label", label: "Item" },
        { key: "amount", label: "Amount", align: "end" },
        { key: "term", label: "Term" },
        { key: "optional", label: "Optional" },
      ] satisfies Column[],
      empty: "No fee components for this programme.",
      create: {
        button: "Add fee component",
        title: "New fee component",
        fields: [
          { name: "programId", label: "Programme", type: "select", required: true, optionKey: "programs" },
          { name: "termId", label: "Term (blank = any)", type: "select", optionKey: "terms" },
          { name: "label", label: "What it pays for", type: "text", required: true, placeholder: "Tuition, lab, exam fee" },
          { name: "amount", label: "Amount (KES)", type: "number", required: true, step: "0.01" },
          { name: "isOptional", label: "Optional item", type: "checkbox" },
        ] satisfies Field[],
      },
    },
  },

  tutors: {
    title: "Tutors",
    description: "Teaching staff attached to this campus.",
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
      body: "Tutors register themselves and wait for approval, or create the account here.",
    },
    create: {
      button: "Add tutor",
      title: "New tutor",
      fields: [
        { name: "fullName", label: "Full name", type: "text", required: true },
        { name: "email", label: "Email (sign-in)", type: "email", required: true },
        { name: "phone", label: "Phone", type: "tel" },
        { name: "staffNo", label: "Staff number", type: "text", hint: "Leave blank to have the system issue one." },
        { name: "password", label: "Temporary password", type: "text", required: true, hint: "Minimum 10 characters." },
        { name: "title", label: "Title", type: "text", placeholder: "Asst. Lecturer" },
        { name: "department", label: "Department", type: "text" },
        { name: "programIds", label: "Programmes taught", type: "select", optionKey: "programs", hint: "Pick one; add more after saving." },
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
    description: "Weekly class grid for this campus.",
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
    description: "Terms, intake windows and dated events.",
    terms: {
      heading: "Terms",
      columns: [
        { key: "name", label: "Term" },
        { key: "window", label: "Dates" },
        { key: "status", label: "Status" },
        { key: "intakes", label: "Intakes" },
      ] satisfies Column[],
      empty: "No terms recorded. Add one before scheduling events.",
      create: {
        button: "Add term",
        title: "New term",
        fields: [
          { name: "name", label: "Name", type: "text", required: true, placeholder: "2026 Long Semester 1", wide: true },
          { name: "startDate", label: "Starts", type: "date", required: true },
          { name: "endDate", label: "Ends", type: "date", required: true },
          { name: "status", label: "Status", type: "select", required: true, options: toOptions(labels.termStatus) },
        ] satisfies Field[],
        created: "Term saved.",
      },
      intake: {
        button: "Add intake",
        title: "New intake",
        fields: [
          { name: "termId", label: "Term", type: "select", required: true, optionKey: "terms" },
          { name: "name", label: "Name", type: "text", required: true, placeholder: "September 2026" },
          { name: "applicationDeadline", label: "Applications close", type: "date", required: true },
          { name: "commenceAt", label: "Classes start", type: "date", required: true },
        ] satisfies Field[],
        created: "Intake saved.",
      },
    },
    events: {
      heading: "Events",
      empty: "No events for this month.",
      create: {
        button: "Add event",
        title: "New event",
        fields: [
          { name: "termId", label: "Term", type: "select", required: true, optionKey: "terms" },
          { name: "title", label: "Title", type: "text", required: true, wide: true },
          { name: "type", label: "Type", type: "select", required: true, options: toOptions(labels.calendarEventType) },
          { name: "startsAt", label: "Starts", type: "date", required: true },
          { name: "endsAt", label: "Ends", type: "date" },
          { name: "scope", label: "Applies to", type: "select", options: [{ value: "campus", label: "This campus" }, { value: "college", label: "All campuses" }] },
          { name: "description", label: "Detail", type: "textarea", wide: true },
        ] satisfies Field[],
        created: "Event saved.",
      },
      collegeWide: "All campuses",
      thisCampus: "This campus",
    },
  },

  exams: {
    title: "Exams",
    description: "Assessment schedule and the marks behind it.",
    searchLabel: "Search by paper title or room",
    columns: [
      { key: "title", label: "Paper" },
      { key: "program", label: "Programme" },
      { key: "date", label: "Date" },
      { key: "window", label: "Time" },
      { key: "room", label: "Room" },
      { key: "invigilator", label: "Invigilator" },
      { key: "status", label: "Status" },
    ] satisfies Column[],
    empty: {
      title: "No exams scheduled",
      body: "Schedule a paper, then record marks against the enrollments on it.",
    },
    create: {
      button: "Schedule exam",
      title: "New exam",
      fields: [
        { name: "title", label: "Paper title", type: "text", required: true, wide: true },
        { name: "programId", label: "Programme", type: "select", required: true, optionKey: "programs" },
        { name: "termId", label: "Term", type: "select", optionKey: "terms" },
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
      empty: "No enrollments on this programme yet, so there is nothing to mark.",
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
    description: "Fee invoices and the payments recorded against them.",
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
    empty: {
      title: "No invoices match",
      body: "Bill a student from an approved fee structure, or import the term's bills.",
    },
    create: {
      button: "Raise invoice",
      title: "New invoice",
      fields: [
        { name: "studentId", label: "Student", type: "select", required: true, optionKey: "students" },
        { name: "termId", label: "Term", type: "select", optionKey: "terms" },
        { name: "dueAt", label: "Due date", type: "date" },
        { name: "note", label: "Note on the invoice", type: "textarea", wide: true },
      ] satisfies Field[],
      linesHeading: "Line items",
      linesHint: "Copy the fee components for the student's programme, then edit this invoice if needed.",
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
    },
    void: { button: "Void invoice", done: "Invoice voided." },
  },

  cards: {
    title: "ID cards",
    description: "Issue, track and replace student identification cards.",
    searchLabel: "Search by serial or admission number",
    columns: [
      { key: "serial", label: "Serial" },
      { key: "student", label: "Student" },
      { key: "program", label: "Programme" },
      { key: "status", label: "Status" },
      { key: "issuedAt", label: "Issued" },
      { key: "expiresAt", label: "Expires" },
    ] satisfies Column[],
    empty: {
      title: "No cards recorded",
      body: "Request a card for a student, then move it through printing to issued.",
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
    },
    move: {
      title: "Move card",
      statusField: { name: "status", label: "Status", type: "select", required: true, options: toOptions(labels.cardStatus) } satisfies Field,
      issuedAtNote: "Marking a card issued stamps today's date.",
      saved: "Card updated.",
    },
    print: {
      heading: "Card face",
      institution: "East Africa Vision Institute",
      studentLabel: "Student",
      programmeLabel: "Programme",
      validLabel: "Valid until",
      serialLabel: "Serial",
      campusLabel: "Campus",
      note: "Photographs are not stored yet. The layout prints with the name, programme, serial and validity only.",
      open: "Print view",
      closed: "Hide print view",
    },
  },

  reports: {
    title: "Reports",
    description: "Counts drawn from the records on this campus.",
    scope: (campusName: string, generated: string) => `${campusName} · drawn from live records on ${generated}`,
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
          { key: "level", label: "Level" },
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
    exportNote: "Print this page from the browser to hand a copy to the finance or academic office.",
    print: "Print",
  },

  communication: {
    title: "Communication",
    description: "Notices for your students and tutors.",
    scopeCampus: "This campus",
    scopeCollege: "All campuses",
    publishedOn: "Published",
    author: "Posted by",
    pinned: "Pinned",
    empty: {
      title: "No notices yet",
      body: "Publish an announcement and it appears in the student and tutor portals as soon as they open.",
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
} as const;

/** Builds the static select choices from an enum label map. */
function toOptions(map: Record<string, string>) {
  return Object.entries(map).map(([value, label]) => ({ value, label }));
}

export const pagination = {
  window: 20,
  label: (page: number, shown: number, total: number) =>
    `Page ${page} · showing ${shown} of ${total}`,
};
