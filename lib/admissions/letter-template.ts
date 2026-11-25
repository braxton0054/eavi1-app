/**
 * EAVI acknowledgement of application, A4 portrait.
 *
 * Authored at 794 x 1123 units (3.78 units = 1 mm), the same scale as the fee and student
 * documents. Body copy is 14.5–15 units ≈ 11 pt on A4; headings are larger. Every text
 * block is a fixed zone, so a long name or programme cannot run into the next block.
 * Brand colours and the logo come from the student ID card artwork.
 */

export const ADMISSION_LETTER_SVG_TEMPLATE = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="794" height="1123" viewBox="0 0 794 1123" font-family="'Liberation Sans', Arial, Helvetica, sans-serif">
<style>
  .ink{fill:#1F2937}.brand{fill:#800080}.accent{fill:#5c005c}.muted{fill:#4B5563}.white{fill:#FFFFFF}
  .label{font-size:9.5px;fill:#6B7280;font-weight:bold;letter-spacing:1.2px}
  .body{font-size:14.5px;fill:#1F2937}
  .fine{font-size:11.5px;fill:#4B5563}
</style>
<defs>
  <clipPath id="letter-page"><rect width="794" height="1123"/></clipPath>
  <filter id="card-shadow" x="-5%" y="-5%" width="110%" height="110%">
    <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#800080" flood-opacity="0.10"/>
  </filter>
</defs>
<g clip-path="url(#letter-page)">
  <rect width="794" height="1123" fill="#FFFFFF"/>
  <rect x="16" y="16" width="762" height="1091" rx="8" fill="none" stroke="#800080" stroke-width="2"/>
  <rect x="22" y="22" width="750" height="1079" rx="6" fill="none" stroke="#5c005c" stroke-width="0.8"/>

  <!-- header, from the student ID card -->
  <polygon points="620,22 770,22 770,96 578,96" class="brand"/>
  <text x="758" y="50" text-anchor="end" font-size="13" font-weight="bold" class="white" letter-spacing="2">OFFICIAL</text>
  <text x="758" y="72" text-anchor="end" font-size="11" font-weight="bold" class="white" letter-spacing="1">ADMISSION LETTER</text>
  <image xlink:href="{{logo_url}}" href="{{logo_url}}" x="36" y="30" width="58" height="58" preserveAspectRatio="xMidYMid meet"/>
  <text x="106" y="46" font-size="19" font-weight="bold" class="ink" letter-spacing="0.5">EAST AFRICA VISION INSTITUTE</text>
  <text x="106" y="66" font-size="12" font-weight="bold" class="brand">SCHOOL OF MANAGEMENT &amp; HUMAN CAPACITY BUILDING</text>
  <text x="106" y="84" font-size="11" class="muted">ELDORET MAIN CAMPUS  |  WEST CAMPUS  |  TOWN OFFICE  |  ELDORET, KENYA</text>
  <text x="106" y="100" font-size="10.5" class="muted" font-style="italic">TVETA Reg: MOHEST/PC/1409/011  ·  KNEC Centre No. 26578004  ·  Helpline: 0726 044 022</text>
  <rect x="22" y="112" width="750" height="8" class="brand"/>

  <!-- reference / dates -->
  <rect x="36" y="132" width="722" height="60" rx="6" fill="#F9FAFB" stroke="#E5E7EB" stroke-width="1"/>
  <text x="52" y="154" class="label">REFERENCE NUMBER</text>
  <text data-slot="reference" x="52" y="179" font-size="15" font-weight="bold" class="brand">{{reference}}</text>
  <text x="300" y="154" class="label">DATE OF ISSUE</text>
  <text data-slot="issue_date" x="300" y="179" font-size="14" font-weight="bold" class="ink">{{issue_date}}</text>
  <text x="520" y="154" class="label">LETTER VALID UNTIL</text>
  <text data-slot="expiry_date" x="520" y="179" font-size="14" font-weight="bold" class="accent">{{expiry_date}}</text>

  <!-- recipient -->
  <text x="36" y="224" class="label">APPLICANT / PROSPECTIVE STUDENT</text>
  <text data-slot="full_name" x="36" y="254" font-size="24" font-weight="bold" class="ink">{{full_name}}</text>
  <rect x="36" y="262" width="200" height="4" class="brand"/>

  <rect x="36" y="278" width="722" height="32" rx="6" class="brand"/>
  <text x="397" y="300" text-anchor="middle" font-size="15" font-weight="bold" class="white" letter-spacing="2">ACKNOWLEDGEMENT OF APPLICATION</text>

  <!-- letter body -->
  <text x="36" y="348" font-size="15" font-weight="bold" class="ink">Dear {{full_name}},</text>
  <text x="36" y="374" class="body">We confirm that your application to East Africa Vision Institute has been</text>
  <text x="36" y="396" class="body">officially received and indexed. Your stated qualification has been recorded</text>
  <text x="36" y="418" class="body">and will be reviewed against the entry requirements for the programme below</text>
  <text x="36" y="440" class="body">at our <tspan font-weight="bold" class="brand">{{campus}}</tspan> for <tspan font-weight="bold" class="accent">{{intake}}</tspan>.</text>

  <!-- particulars card -->
  <g filter="url(#card-shadow)">
    <rect x="36" y="462" width="722" height="188" rx="8" fill="#FDFBFD" stroke="#800080" stroke-width="1.5"/>
    <rect x="36" y="462" width="722" height="28" rx="8" class="brand"/>
    <text x="54" y="482" font-size="12" font-weight="bold" class="white" letter-spacing="1.5">APPLICATION &amp; COURSE PARTICULARS</text>
  </g>
  <text x="54" y="516" class="label">APPLICATION REFERENCE</text>
  <text data-slot="reference" x="54" y="538" font-size="14" font-weight="bold" class="brand">{{reference}}</text>
  <text x="420" y="516" class="label">REPORTING CAMPUS</text>
  <text data-slot="campus" x="420" y="538" font-size="14" font-weight="bold" class="ink">{{campus}}</text>
  <text x="54" y="566" class="label">FULL STUDENT NAME</text>
  <text data-slot="full_name" x="54" y="588" font-size="14" font-weight="bold" class="ink">{{full_name}}</text>
  <text x="420" y="566" class="label">INTAKE / REPORTING PERIOD</text>
  <text data-slot="intake" x="420" y="588" font-size="14" font-weight="bold" class="ink">{{intake}}</text>
  <text x="54" y="616" class="label">PROGRAMME OF STUDY</text>
  <text data-slot="course" x="54" y="638" font-size="14" font-weight="bold" class="brand">{{course}}</text>
  <text x="420" y="616" class="label">PROGRAMME CODE / ENTRY</text>
  <text data-slot="course_code" x="420" y="638" font-size="13" font-weight="bold" class="ink">{{course_code}}</text>

  <!-- advice -->
  <rect x="36" y="662" width="722" height="100" rx="6" fill="#F9FAFB" stroke="#E5E7EB" stroke-width="1"/>
  <rect x="36" y="662" width="5" height="100" class="brand"/>
  <text x="54" y="688" font-size="13" font-weight="bold" class="brand">IMPORTANT ADMISSION INSTRUCTIONS</text>
  <text x="54" y="712" class="body">This acknowledgement confirms your application details in the college system. Bring it</text>
  <text x="54" y="736" class="body">when reporting. Your admission number, portal access, ID card and class placement are issued</text>
  <text x="54" y="760" class="body">after physical verification of documents and completion of registration fees at the desk.</text>

  <!-- requirements -->
  <text x="36" y="786" font-size="15" font-weight="bold" class="brand">MANDATORY REQUIREMENTS FOR REPORTING &amp; REGISTRATION</text>
  <line x1="36" y1="794" x2="758" y2="794" class="brand" stroke-width="1.5"/>
  <text x="40" y="822" class="fine"><tspan font-weight="bold" class="brand">1. Academic certificates</tspan> — certified KCSE results.</text>
  <text x="410" y="822" class="fine"><tspan font-weight="bold" class="brand">2. Identification</tspan> — ID or birth certificate.</text>
  <text x="40" y="852" class="fine"><tspan font-weight="bold" class="brand">3. Photographs</tspan> — two recent passport-size photos.</text>
  <text x="410" y="852" class="fine"><tspan font-weight="bold" class="brand">4. Leaving certificate</tspan> — from previous school.</text>
  <text x="40" y="882" class="fine"><tspan font-weight="bold" class="brand">5. Fee deposit</tspan> — bank slip or M-PESA receipt.</text>
  <text x="410" y="882" class="fine"><tspan font-weight="bold" class="brand">6. Medical &amp; bio-data</tspan> — completed forms.</text>
  <text x="40" y="910" class="fine" font-style="italic">Bursary applicants: bring a completed EAVI Bursary Support Scheme form when reporting.</text>

  <!-- campus contacts -->
  <rect x="36" y="926" width="722" height="78" rx="6" fill="#FAF5FF" stroke="#5c005c" stroke-width="1"/>
  <text x="52" y="948" font-size="13" font-weight="bold" class="accent">CAMPUS LOCATIONS &amp; ADMISSION INQUIRIES</text>
  <text x="52" y="968" class="fine"><tspan font-weight="bold" class="brand">Admissions:</tspan> Skymart Bldg, Room F45, Eldoret</text>
  <text x="52" y="988" class="fine"><tspan font-weight="bold" class="brand">Main Campus:</tspan> City Plaza · 0726 044 022</text>
  <text x="52" y="1000" class="fine"><tspan font-weight="bold" class="brand">West Campus:</tspan> Mailinne · 0748 022 044</text>
  <text x="410" y="968" class="fine"><tspan font-weight="bold" class="brand">Email:</tspan> admissions@eavi.ac.ke</text>
  <text x="410" y="988" class="fine"><tspan font-weight="bold" class="brand">Portal:</tspan> {{website}}</text>
  <text x="410" y="1000" class="fine"><tspan font-weight="bold" class="brand">Hours:</tspan> Mon–Fri 8–5 · Sat 8:30–1</text>

  <!-- registrar + verification -->
  <text x="40" y="1020" class="label">ISSUED BY THE OFFICE OF THE REGISTRAR</text>
  <image xlink:href="{{signature_url}}" href="{{signature_url}}" x="44" y="1030" width="130" height="48" preserveAspectRatio="xMidYMid meet"/>
  <image xlink:href="{{stamp_url}}" href="{{stamp_url}}" x="168" y="1024" width="100" height="60" opacity="0.9" preserveAspectRatio="xMidYMid meet"/>
  <line x1="40" y1="1076" x2="330" y2="1076" stroke="#1F2937" stroke-width="1.5"/>
  <text x="40" y="1094" font-size="13" font-weight="bold" class="ink">THE ACADEMIC REGISTRAR</text>

  <g filter="url(#card-shadow)">
    <rect x="520" y="998" width="238" height="92" rx="6" fill="#FFFFFF" stroke="#800080" stroke-width="1.5"/>
    <rect x="520" y="998" width="238" height="20" rx="6" class="brand"/>
    <text x="639" y="1013" text-anchor="middle" font-size="9.5" font-weight="bold" class="white" letter-spacing="1">OFFICIAL DOCUMENT VERIFICATION</text>
  </g>
  <g data-slot="qr" transform="translate(532, 1022)">
    <rect width="68" height="68" fill="#FFFFFF" class="ink-stroke" stroke-width="1.5" stroke-dasharray="5 4"/>
    <text x="34" y="40" text-anchor="middle" font-size="9" font-weight="bold" class="ink">QR CODE</text>
  </g>
  <text x="612" y="1038" font-size="11" font-weight="bold" class="brand">SCAN TO VERIFY</text>
  <text x="612" y="1054" class="fine">Point your camera at the code</text>
  <text x="612" y="1070" class="fine">to authenticate this letter</text>
  <text x="612" y="1082" class="label">TOKEN</text>
  <text data-slot="verify_token" x="612" y="1094" font-size="10" font-family="monospace" class="ink">{{verify_token}}</text>
  <text x="639" y="1110" text-anchor="middle" class="fine">{{verify_url}}</text>

  <rect x="22" y="1117" width="750" height="6" class="brand"/>
</g>
</svg>`;

export type AdmissionLetterSlots = {
  logo_url: string;
  signature_url: string;
  stamp_url: string;
  reference: string;
  full_name: string;
  course: string;
  course_code: string;
  campus: string;
  intake: string;
  issue_date: string;
  expiry_date: string;
  verify_token: string;
  verify_url: string;
  website: string;
};

export function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Keeps a long value inside its fixed column. */
function fit(value: string, max: number): string {
  const text = String(value ?? "").trim();
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

export function mergeAdmissionLetterTemplate(template: string, slots: Partial<AdmissionLetterSlots>): string {
  return template.replace(/\{\{([a-z_]+)\}\}/g, (match, slot: string) => {
    const value = slots[slot as keyof AdmissionLetterSlots];
    if (value === null || value === undefined || value === "") {
      if (slot.endsWith("_url")) return "";
      return escapeXml("—");
    }
    const raw = String(value);
    const key = slot as keyof AdmissionLetterSlots;
    const limit: Partial<Record<keyof AdmissionLetterSlots, number>> = {
      full_name: 38,
      course: 44,
      campus: 24,
      intake: 22,
      verify_token: 26,
      verify_url: 44,
      website: 22,
    };
    return escapeXml(limit[key] ? fit(raw, limit[key]!) : raw);
  });
}
