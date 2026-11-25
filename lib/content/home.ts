import { campuses, phoneDirectory, type Campus } from "@/lib/campuses";

/**
 * Single source of truth for the home page. Nothing here is invented: institute name,
 * tagline, campus facts and the reason list come from the brief EAVI supplied, the
 * remaining strings are functional labels for a field, a link or a button.
 *
 * Anything the institute has not supplied yet is `null` or an empty list and renders as
 * a marked placeholder — see README.md → "Placeholders to fill".
 */

export type IconName =
  | "wallet"
  | "campuses"
  | "tutor"
  | "hands-on"
  | "calendar"
  | "results"
  | "student"
  | "shield"
  | "download"
  | "photo";

export type NavLink = { label: string; href: string };
export type TrustItem = { label: string; value: number | null };

const mainCampus = campuses[0];

/** wa.me needs the national number without the leading `+`. */
const waNumber = (tel: string) => tel.replace(/[^0-9]/g, "");

export const site = {
  name: "East Africa Vision Institute",
  shortName: "EAVI",
  tagline: "Leading the Leaders",
  location: "Eldoret, Kenya",
  logoAlt: "East Africa Vision Institute",
  description:
    "Quality and affordable education at two campuses in Eldoret, Kenya. Apply online, then use the portal for results, class cards and campus notices.",
  /** Set NEXT_PUBLIC_SITE_URL to the deployed domain; used for metadata and JSON-LD. */
  url: process.env.NEXT_PUBLIC_SITE_URL?.trim() || "http://localhost:3000",
  whatsapp: {
    tel: mainCampus.tel,
    href: `https://wa.me/${waNumber(mainCampus.tel)}`,
  },
  /** TODO: institute email address. */
  email: null as string | null,
} as const;

export const nav = {
  skipToContent: "Skip to content",
  ariaLabel: "Primary",
  links: [
    // Root-absolute anchors: the header and footer render on every public page, so a
    // bare #hash would look for the section on the page you are on and do nothing.
    { label: "Programs", href: "/#programs" },
    { label: "Campuses", href: "/#campuses" },
    { label: "Admissions", href: "/#admissions" },
    { label: "Fees", href: "/#fees" },
    { label: "About", href: "/#about" },
    { label: "Contact", href: "/#contact" },
  ] satisfies NavLink[],
  portalLogin: "Portal Login",
  apply: "Apply Now",
  menu: "Open menu",
  closeMenu: "Close menu",
} as const;

export const hero = {
  eyebrow: "Eldoret · Kenya",
  heading: site.tagline,
  headingAccent: site.name,
  subheading: `Quality and affordable education at two campuses in Eldoret, Kenya.`,
  apply: "Apply Now",
  portal: "Portal Login",
  photo: "/eavi-assets/web/hero.jpg",
  photoAlt: "The institute campus in Eldoret.",
  photoLabel: "Campus photo",
  photoPending: "Add a campus photo in public/campus-life/",
  trustHeading: "EAVI at a glance",
  // Three figures, all real: campuses come from the campus register, programmes and
  // students are counted live on the page. No invented "years leading" statistic (AIT-03).
  trust: [
    { label: "Teaching campuses", value: 2 },
    { label: "Programmes", value: null },
    { label: "Students", value: null },
  ] satisfies TrustItem[],
  pendingValue: "TODO",
} as const;

export const portalSection = {
  heading: "Portal Login",
  subheading: "Four roles, one sign-in. Pick yours.",
  roles: [
    {
      role: "STUDENT",
      label: "Student",
      line: "Results and class card.",
      icon: "results" satisfies IconName,
    },
    {
      role: "TUTOR",
      label: "Tutor",
      line: "Your classes and your students.",
      icon: "tutor" satisfies IconName,
    },
    {
      role: "CAMPUS_ADMIN",
      label: "College Admin",
      line: "Only your campus: its students and tutors.",
      icon: "campuses" satisfies IconName,
    },
    {
      role: "SUPERADMIN",
      label: "Super Admin",
      line: "Every campus in one place.",
      icon: "shield" satisfies IconName,
    },
  ],
  loginHref: (role: string) => `/login?role=${role}`,
  openPortal: "Portal Login",
} as const;

/** Titles are EAVI's own reason list; details only where a supplied fact backs them. */
export const whySection = {
  id: "about",
  eyebrow: "Why this college",
  heading: "Why students choose the institute",
  subheading: "Quality and affordable education, led from three Eldoret campuses.",
  reasons: [
    {
      title: "Affordable fees",
      icon: "wallet" satisfies IconName,
      detail: null as string | null,
    },
    {
      title: "Two campuses in Eldoret",
      icon: "campuses" satisfies IconName,
      detail: campuses.map((campus) => campus.name).join(", "),
    },
    { title: "Qualified tutors", icon: "tutor" satisfies IconName, detail: null },
    { title: "Practical training", icon: "hands-on" satisfies IconName, detail: null },
    { title: "Flexible intakes", icon: "calendar" satisfies IconName, detail: null },
    {
      title: "Online results and class card",
      icon: "results" satisfies IconName,
      detail: null,
    },
  ],
  pendingDetail: "Add a supporting line",
} as const;

export type Program = {
  /** Stable identity, not the name: two programmes may share a display name. */
  id: string;
  title: string;
  level: string;
  duration: string;
  description: string;
};

export const programsSection = {
  id: "programs",
  eyebrow: "Programs",
  heading: "Programmes we run",
  subheading: "Course list, levels and durations come from the academic office.",
  allLevels: "All levels",
  filterLabel: "Filter programmes by level",
  learnMore: "Learn more",
  /** There is no programme detail page yet, so this points at the contact block. */
  learnMoreHref: "#contact",
  apply: "Apply",
  /** TODO: replace with the real programme list; the filter bar appears on its own. */
  items: [] as Program[],
  pending: ["Course name", "Level", "Duration", "Short description"],
} as const;

export const admissionsSection = {
  id: "admissions",
  eyebrow: "Admissions",
  heading: "Three steps to a class",
  subheading: "Apply, get admitted, start class.",
  steps: [
    {
      title: "Apply",
      line: "Fill in the application form, or call any campus and register over the phone.",
      action: "Apply online",
      href: "/apply",
    },
    {
      title: "Get admitted",
      line: "The campus confirms your placement and the class you join.",
    },
    {
      title: "Start class",
      line: "You begin at the campus you applied to.",
    },
  ],
  requirements: {
    label: "Download requirements list",
    /** TODO: drop the PDF into /public and point this at it. */
    href: null as string | null,
    pending: "Add admissions-requirements.pdf to public/",
  },
  apply: "Apply Now",
} as const;

export type FeeRow = {
  program: string;
  tuition: string;
  otherCharges: string;
  plan: string;
};

export const feesSection = {
  id: "fees",
  eyebrow: "Fees",
  heading: "Fees, out in the open",
  subheading: "Published per programme by the finance office.",
  columns: ["Programme", "Tuition per term", "Other charges", "Payment plan"],
  enquire: "Ask about fees",
  /** TODO: real figures — never publish invented numbers. */
  items: [] as FeeRow[],
  pending: ["Programme", "Tuition per term", "Other charges", "Payment plan"],
} as const;

export const campusesSection = {
  id: "campuses",
  eyebrow: "Campuses",
  heading: "Find us in Eldoret",
  subheading: `Our two teaching campuses and the town office each answer their own line.`,
  addressLabel: "Address",
  phoneLabel: "Direct line",
  alternateLabel: "Alternate line",
  call: "Call",
  whatsapp: "WhatsApp",
  directions: "Get directions",
  mapLabel: (name: string) => `Map of ${name}`,
  mapPending: "Map embed needs an API key",
  /** Main Campus is the only number the brief marks as being on WhatsApp. */
  whatsappCampusNames: ["Main Campus"] as string[],
} as const;

export const gallerySection = {
  id: "gallery",
  eyebrow: "Campus life",
  heading: "Around campus",
  subheading: "Photographs of the campuses and their students.",
  openImage: (caption: string) => `Open image: ${caption}`,
  closeImage: "Close image",
  /** TODO: real photographs with captions and alt text. */
  items: [] as { src: string; caption: string; alt: string }[],
  pending: ["Photo file in public/campus-life/", "Caption", "Alt text"],
  placeholderAlt: "Campus life photo",
} as const;

export type Testimonial = {
  quote: string;
  name: string;
  detail: string;
};

export const testimonialsSection = {
  id: "stories",
  eyebrow: "Alumni",
  heading: "What alumni say",
  subheading: "Published only with the graduate's written consent.",
  previous: "Previous quote",
  next: "Next quote",
  slidePosition: (index: number, total: number) => `Quote ${index} of ${total}`,
  /** TODO: consented quotes only — no fabricated testimonials. */
  items: [] as Testimonial[],
  pending: ["Consent-approved quote", "Graduate name", "Year and programme"],
} as const;

export type FaqItem = { question: string; answer: string | null };

export const faqSection = {
  id: "faq",
  eyebrow: "FAQ",
  heading: "Questions we get on the phone",
  subheading: "Anything else: call or message the campus you want to join.",
  items: [
    {
      question: "How do I apply?",
      answer:
        "Fill in the application form, or call any campus and register over the phone. Admission runs every month.",
    },
    {
      question: "Which campuses can I join?",
      answer: campuses.map((campus) => `${campus.name} at ${campus.place}`).join(", "),
    },
    {
      question: "How do I sign in to the portal?",
      answer:
        "Use Portal Login and the email you registered with. Tutor and admin accounts are approved by the institute before they can sign in.",
    },
    {
      question: "When is the next intake?",
      answer:
        "New classes start at the beginning of every month. Apply now and the campus you chose confirms your exact start date.",
    },
    {
      question: "What are the fees, and can I pay in instalments?",
      answer:
        "Fees are billed per programme and you can pay in instalments as you study. The full fee structure comes with your offer letter, or call the campus for the current figures.",
    },
    {
      question: "Which certificates do you issue?",
      answer:
        "The institute is accredited by the Ministry of Education and TVETA (KNEC Centre No. 26578004). On completing your programme you receive its certificate from the examining body.",
    },
  ] satisfies FaqItem[],
  pendingAnswer: "Answer needed from the academic office",
} as const;

export const ctaSection = {
  heading: "Start your journey today",
  subheading: "Apply online, or message the campus you want to join.",
  apply: "Apply Now",
  whatsapp: (name: string) => `WhatsApp ${name}`,
} as const;

export const contactSection = {
  id: "contact",
  heading: "Talk to us",
  campusesLabel: "Campuses",
  emailLabel: "Email",
  /** TODO: institute email, once the office supplies one. */
} as const;

export const footer = {
  name: site.name,
  tagline: `${site.tagline}. Quality and affordable education in ${site.location}.`,
  quickLinks: "Quick links",
  campusesHeading: "Campuses",
  contactHeading: "Talk to us",
  socialHeading: "Follow the institute",
  /** TODO: real social profile URLs. */
  socials: [] as NavLink[],
  socialPending: "Add profile links",
  privacy: "Privacy policy",
  terms: "Terms of use",
  /** {year} is filled in on the client; Cache Components blocks Date at prerender. */
  copyrightTemplate: `© {year} ${site.name}.`,
} as const;

export const pending = {
  label: "Placeholder — needs institute data",
  note: "Fill the values in lib/content/home.ts",
} as const;

export { mainCampus, campuses, phoneDirectory };
export type { Campus };
