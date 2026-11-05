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
    | "semesters"
    | "intakes"
    | "enrollments"
    | "invoices"
    | "campuses"
    | "departments"
    | "years";
};

export type Column = { key: string; label: string; align?: "end" };

export const shell = {
  brandName: "EAVI Portal",
  brandNote: "College administration",
  navLabel: "Portal sections",
  skipToContent: "Skip to content",
  openMenu: "Open section menu",
  closeMenu: "Close section menu",
  allCampuses: "All campuses",
  account: {
    label: "Account",
    role: "Role",
    signOut: "Sign out",
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
      { href: "/dashboard/students/enrol", label: "Enrolment", icon: "students" },
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
  feeFrequency: {
    SEMESTER: "Per semester",
    TERM: "Per term",
    MODULE: "Per module",
    MONTH: "Monthly",
  },
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
    ACTIVE: "Running",
    COMPLETED: "Completed",
  },
  gender: {
    MALE: "Male",
    FEMALE: "Female",
    OTHER: "Other",
    UNDECLARED: "Prefer not to say",
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

export const pages = {
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
    empty: {
      title: "No applications match",
      body: "Log an application or clear the filters.",
    },
    detail: {
      previousQualification: "Previous qualification",
      notes: "Notes",
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
          options: toOptions(labels.gender),
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
        { name: "notes", label: "Notes", type: "textarea", wide: true },
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
      description: "Set monthly reporting dates for admitted students.",
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
        { name: "intakeId", label: "Intake", type: "select", optionKey: "intakes" },
        { name: "admissionNo", label: "Admission number", type: "text", hint: "Leave blank to issue one automatically." },
        { name: "password", label: "Temporary password", type: "text", required: true, hint: "Minimum 10 characters." },
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
      finance: "Fees",
      cards: "Cards",
      enrollments: "Enrollments",
      invoices: "Invoices",
    },
  },

  enrollments: {
    title: "Enrollments",
    description: "Active and historical enrolments on this campus.",
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
      body: "Enroll a student.",
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
    description: "Courses on offer at this campus.",
    curriculum: {
      heading: "Curriculum upload",
      program: "Programme",
      file: "Curriculum file (PDF)",
      button: "Upload curriculum",
      saved: "Curriculum uploaded.",
      none: "No curriculum uploaded yet.",
    },
    feeStructure: {
      heading: "Fee structure upload",
      program: "Programme",
      file: "Fee structure file (PDF)",
      button: "Upload fee structure",
      saved: "Fee structure uploaded.",
      none: "No fee structure uploaded yet.",
    },
    columns: [
      { key: "code", label: "Code" },
      { key: "name", label: "Programme" },
      { key: "department", label: "Department" },
      { key: "level", label: "Programme type" },
      { key: "duration", label: "Duration" },
      { key: "minKcseGrade", label: "Min KCSE" },
      { key: "feeFrequency", label: "Fee payment type" },
      { key: "students", label: "Enrolled", align: "end" },
      { key: "curriculum", label: "Curriculum" },
      { key: "feeStructure", label: "Fee structure" },
    ] satisfies Column[],
    empty: {
      title: "No programmes yet",
      body: "Add a programme.",
    },
    create: {
      button: "Add programme",
      title: "New programme",
      fields: [
        { name: "departmentId", label: "Department", type: "select", required: true, optionKey: "departments" },
        { name: "name", label: "Programme name", type: "text", required: true, wide: true },
        { name: "code", label: "Code", type: "text", required: true },
        { name: "level", label: "Programme type", type: "select", required: true, options: toOptions(labels.programLevel) },
        { name: "durationMonths", label: "Duration (months)", type: "number", required: true, step: "1" },
        { name: "minKcseGrade", label: "Minimum KCSE grade", type: "select", required: true, options: toOptions(labels.entryGrade) },
        { name: "feeFrequency", label: "Fee payment type", type: "select", required: true, options: toOptions(labels.feeFrequency) },
        { name: "description", label: "Description", type: "textarea", wide: true },
      ] satisfies Field[],
      created: "Programme saved.",
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
          { name: "name", label: "Name", type: "text", required: true, placeholder: "September 2026" },
          { name: "applicationDeadline", label: "Applications close", type: "date", required: true },
          { name: "commenceAt", label: "Classes start", type: "date", required: true },
        ] satisfies Field[],
        created: "Intake saved.",
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
    empty: {
      title: "No cards recorded",
      body: "Request a card.",
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
      open: "Print view",
      closed: "Hide print view",
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
          { key: "level", label: "Programme type" },
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
