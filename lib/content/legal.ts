/**
 * The privacy notice and the terms of use.
 *
 * Written against what this system actually stores rather than a generic template: the fields
 * named here are the fields in `prisma/schema.prisma`, and the retention described is the
 * retention the code enforces (chat attachments carry an `expiresAt`, letters and cards are
 * issued against a student record that outlives them). A notice that promises something the
 * software does not do is worse than no notice, so each promise below traces to a line of code.
 *
 * The Kenyan statutes this rests on are the Data Protection Act, 2019 — which governs how a
 * college may collect and use personal data — and the Kenya Information and Communications Act
 * (Cap 411A) as amended, together with the Computer Misuse and Cybercrimes Act, 2018, which
 * govern the network, electronic records and unauthorised access. Section numbers are
 * deliberately not cited: they change with amendment, and a wrong number reads as authority it
 * does not have. The office should have its legal adviser confirm the wording before publication.
 */

import { site } from "@/lib/content/home";

export type LegalSection = {
  heading: string;
  /** One paragraph per entry. Nothing here is legal boilerplate for its own sake. */
  body: string[];
  /** Optional short list rendered under the paragraphs. */
  points?: string[];
};

export type LegalDocument = {
  title: string;
  /** Shown under the title; this doubles as the "last updated" the law expects. */
  updated: string;
  /** One sentence saying what the document is for, read before the sections. */
  summary: string;
  sections: LegalSection[];
};

const college = site.name;
const place = site.location;

export const privacyNotice: LegalDocument = {
  title: "Privacy notice",
  updated: "9 November 2026",
  summary: `${college} holds personal data about applicants and students in order to admit, teach, examine and account for them. This notice says what we hold, why, who can see it, how long we keep it, and what you may ask us to do with it.`,
  sections: [
    {
      heading: "The law we follow",
      body: [
        `We handle personal data under the Data Protection Act, 2019. That Act makes us a "data controller": we decide why your data is collected and what happens to it. It also gives you rights over that data, set out further down.`,
        `Our network, servers and electronic records are additionally covered by the Kenya Information and Communications Act (Cap 411A) and the Computer Misuse and Cybercrimes Act, 2018. Those Acts make it an offence to access, copy, alter or interfere with a system or its data without authority. Access to this portal is monitored, and unauthorised access is reported.`,
      ],
    },
    {
      heading: "What we collect, and why",
      body: [
        "We collect only what a college needs in order to enrol you, teach you, examine you, place you on attachment and account for fees. We do not collect data for advertising, and we do not sell or rent it to anyone.",
      ],
      points: [
        "Identity and contact: full name, phone, email, gender, date of birth, national ID where you supply it, postal or home address.",
        "Guardian: name, phone and email of the parent or guardian you name, used to reach them about your progress and fees.",
        "Academic: KCSE grade and entry grade, primary and secondary school attended, school documents you upload, your programme, intake, class, unit registrations, marks and results.",
        "Financial: invoices raised against you, payments made, the payment method (M-Pesa, cash, bank or cheque) and the reference number. We do not store card numbers, M-Pesa PINs or bank credentials — a payment is recorded as an amount against a reference.",
        "Photograph: a passport-style photograph for your student identification card, held only if you provide one.",
        "Medical: information you give us about a medical condition, so that staff know what to do in an emergency. This is optional and sensitive data; it is visible only to the campus office and is never shown to other students.",
        "Messages: content of messages sent through the portal's chat, and files shared in it, which are automatically deleted after seven days.",
      ],
    },
    {
      heading: "Sensitive data",
      body: [
        "Medical information is sensitive personal data under the Act and is treated as such: it is collected only because you chose to give it, it is restricted to the campus office and the staff who need it, and it is not used for any other purpose.",
        "A photograph is used for identification. It is served through the portal only to signed-in users who are entitled to see it, not through a public address.",
      ],
    },
    {
      heading: "Who can see your data",
      body: [
        "Access is limited to staff of the campus you belong to, and only to what their role requires. A campus administers its own students; staff at one campus do not browse the records of another.",
      ],
      points: [
        "The admissions and records office can see your application, enrolment, class and fee position.",
        "Your tutors can see the units they teach you and your marks in them.",
        "Finance staff can see invoices and payments, not your marks or your medical information.",
        "Other students can find you in the portal chat by name only. They cannot search you by admission number, phone number, email address or date of birth, and cannot see your fees.",
        "We disclose data outside the college only where the law requires it — a court order, a lawful request from a public authority, or a request from the examining or accrediting body for the purpose of examining and certifying you.",
      ],
    },
    {
      heading: "How long we keep it",
      body: [
        "Academic records — your enrolment, results and the certificate of what you studied — are kept permanently, because the college must be able to confirm a qualification years later, and because the examining body requires a permanent record.",
        "Records that are only there to run the college day to day are kept no longer than they are needed:",
      ],
      points: [
        "Applications that do not lead to enrolment are kept for the admission cycle and then closed.",
        "Files shared in the portal chat are deleted automatically seven days after they are sent.",
        "Identity-card artwork and issued cards are kept while the card is valid, and afterwards only as proof of what was issued.",
      ],
    },
    {
      heading: "Your rights",
      body: [
        "The Data Protection Act, 2019 gives you these rights. To use one, write to the campus office. We will confirm your identity first, because we will not hand one person's record to another.",
      ],
      points: [
        "To be told whether we hold data about you, and to be given a copy of it.",
        "To have data that is wrong or out of date corrected. Where the correction is to an academic record, the request goes to the examinations office, since a mark cannot be changed by the office that did not award it.",
        "To ask us to delete data we no longer have a reason to keep. This right does not override the permanent academic record above, or a retention the law requires.",
        "To object to a use, or to ask us to restrict it, where the law allows.",
        "To complain to the Office of the Data Protection Commissioner if you believe we have handled your data unlawfully. You may complain to us first, but you do not have to.",
      ],
    },
    {
      heading: "Keeping it safe",
      body: [
        "Access to this portal needs a signed-in account. Passwords are stored only as a scrypt hash with a random per-user salt, so a copy of the database does not reveal them. A session is ended on the server when you sign out, so a copied cookie stops working.",
        "Signed-in pages and downloadable documents are served to an authenticated person only; a student's letter of acknowledgement is reachable only with its own long random token, and a wrong reference and a wrong token are answered identically so that nothing can be discovered by trial.",
        "If a breach of personal data occurs that is likely to result in a risk to your rights, we will notify the Office of the Data Protection Commissioner and tell you what was affected, what we have done, and what you should do.",
      ],
    },
    {
      heading: "Children",
      body: [
        "Some applicants are under eighteen. Where a student is a minor, data is provided by, and this notice is addressed to, the parent or guardian, who may exercise the rights above on the student's behalf.",
      ],
    },
    {
      heading: "Changes, and how to reach us",
      body: [
        `This notice is reviewed when the college changes how it handles data. The date at the top of this page is the date of the current version.`,
        `Questions, requests about your data, and complaints go to the campus office at ${place}, or to the admissions office through the contact numbers published on this site.`,
        `If you are not satisfied with our answer, you may complain to the Office of the Data Protection Commissioner in Kenya.`,
      ],
    },
  ],
};

export const termsOfUse: LegalDocument = {
  title: "Terms and conditions",
  updated: "9 November 2026",
  summary: `These terms govern your use of the ${college} website and portal. By using either, you accept them. They apply alongside the college's academic rules, which govern admission, progression and examinations.`,
  sections: [
    {
      heading: "Who we are",
      body: [
        `${college} is a tertiary college operating campuses in ${place} and elsewhere in Kenya as listed on this site. In these terms, "we" and "the college" mean the institute, and "you" means the person visiting the site or signed into the portal.`,
      ],
    },
    {
      heading: "Your account",
      body: [
        "An account is personal. You must keep your password to yourself, and you must not let anyone else use your account or use anyone else's. You are responsible for what is done with your account until you tell us it has been taken.",
        "Staff accounts are created only after the college approves them. Approval can be withdrawn, and access to the portal with it.",
        "We may suspend an account where we believe it is being used to break these terms or to interfere with the portal. We will tell you why.",
      ],
    },
    {
      heading: "Acceptable use",
      body: [
        "The portal exists so that students, tutors and administrators can do college work. Use it for that. In particular, you must not:",
      ],
      points: [
        "Try to reach data that does not belong to you, or that your role does not give you. This includes guessing at another person's record, editing a form to reach another campus, and using a link meant for someone else.",
        "Probe, scan or test the security of the site, or attempt to break into it. If you believe you have found a weakness, report it to the campus office — we want to hear about it, and we will not act against you for reporting it honestly.",
        "Upload a file that contains malware, or that is unlawful, abusive, or someone else's confidential material.",
        "Use the portal chat to harass, threaten, defame or discriminate against anyone, to send bulk or unsolicited messages, or to share another person's photograph or personal information without their agreement.",
        "Copy, scrape or reuse the portal's content or data for any purpose other than your own college work.",
      ],
    },
    {
      heading: "What you upload",
      body: [
        "You keep whatever rights you have in the documents and messages you upload. By uploading, you allow the college to store, copy and show that material to the staff who need it for your admission, teaching, examination or account.",
        "You must have the right to send what you send. Do not upload another person's identity document, certificate or photograph without their agreement.",
      ],
    },
    {
      heading: "Information on this site",
      body: [
        "We work to keep programme details, fees and dates accurate, and we correct errors when we find them. What is published here is information, not a contract: an offer of a place is made only through the admission letter issued against a submitted application, and the terms of any admission are those in that letter and the college's academic rules.",
        "A fee published on this site may be changed before an intake begins. The amount that applies to you is the one in force when your invoices are raised.",
      ],
    },
    {
      heading: "Portal availability",
      body: [
        "We try to keep the portal available, but we do not promise it will always be. Maintenance, a fault, or a failure at a supplier may interrupt it. Where an interruption stops you meeting a published deadline, tell the campus office and they will deal with it; do not rely on the portal being available in the last minutes before a deadline.",
      ],
    },
    {
      heading: "Our material",
      body: [
        `The name, logo, card artwork, letter templates, learning materials and software of ${college} belong to the college. You may print or download your own records — your letter, your identification card, your results, your statement of fees — and use them for their intended purpose. You may not otherwise copy, publish or sell the college's material without written permission.`,
      ],
    },
    {
      heading: "Misuse of the system",
      body: [
        "Unauthorised access to a computer system, and interference with data, are criminal offences in Kenya under the Computer Misuse and Cybercrimes Act, 2018 and the Kenya Information and Communications Act (Cap 411A). We record access to this portal and will report what we find to the police where the law has been broken, in addition to any action under the college's own disciplinary rules.",
      ],
    },
    {
      heading: "Liability",
      body: [
        "Nothing in these terms excludes liability that cannot lawfully be excluded, including liability for death or personal injury caused by negligence, or for fraud.",
        "Beyond that, the college is not liable for indirect or consequential loss arising from your use of the site — for example lost time, lost opportunity, or a loss caused by a service being unavailable — except where the law says otherwise.",
      ],
    },
    {
      heading: "Changes to these terms",
      body: [
        "We may change these terms as the portal and the law change. The date at the top of this page is the date of the current version, and a change applies from the moment it is published here.",
      ],
    },
    {
      heading: "Which law applies",
      body: [
        "These terms are governed by the laws of Kenya, and the courts of Kenya have jurisdiction over any dispute arising from them.",
        `Questions about these terms go to the campus office at ${place}.`,
      ],
    },
  ],
};

export const legal = {
  privacy: privacyNotice,
  terms: termsOfUse,
  /** Shared page chrome, kept here so both pages read identically. */
  backHome: "Back to the home page",
  contactHeading: "Contact",
  contactBody: (address: string) =>
    `Write to the campus office at ${address}, or use the phone numbers published on this site.`,
  updatedLabel: "Last updated",
} as const;
