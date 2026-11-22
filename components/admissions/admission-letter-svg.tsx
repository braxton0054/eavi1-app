/**
 * The admission letter SVG artwork and template.
 *
 * Authored in vector SVG at ISO 216 A4 size (210mm x 297mm) using the institute's
 * primary ID card branding: deep purple (#800080), accent plum (#5c005c), ink (#1F2937),
 * and official crest logo. Coordinate scale is 10 units = 1mm (viewBox 0 0 2100 2970),
 * matching the CR80 card templates.
 *
 * Includes dynamic slots for applicant details, course particulars, official registrar
 * sign-off, and a vector QR code linking to the live verification route.
 */

export const ADMISSION_LETTER_SVG_TEMPLATE = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="210mm" height="297mm" viewBox="0 0 2100 2970" font-family="'Liberation Sans', Arial, Helvetica, sans-serif">
  <!-- EAVI Official Admission Letter | A4 210 x 297mm | 10 units = 1mm -->
  <style>
    .ink { fill: #1F2937; }
    .brand { fill: #800080; }
    .accent { fill: #5c005c; }
    .ink-stroke { stroke: #1F2937; }
    .brand-stroke { stroke: #800080; }
    .accent-stroke { stroke: #5c005c; }
    .label { font-size: 15px; fill: #6B7280; font-weight: bold; letter-spacing: 1.5px; }
    .value { font-size: 22px; fill: #1F2937; font-weight: bold; }
    .white { fill: #FFFFFF; }
    .muted { fill: #4B5563; }
  </style>

  <defs>
    <clipPath id="letter-page"><rect width="2100" height="2970" rx="0"/></clipPath>
    <filter id="card-shadow" x="-5%" y="-5%" width="110%" height="110%">
      <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#800080" flood-opacity="0.08"/>
    </filter>
  </defs>

  <g clip-path="url(#letter-page)">
    <!-- Base Background -->
    <rect width="2100" height="2970" fill="#FFFFFF"/>

    <!-- Decorative Border Matching ID Card Colors -->
    <rect x="55" y="55" width="1990" height="2860" fill="none" stroke="#800080" stroke-width="3" rx="12"/>
    <rect x="67" y="67" width="1966" height="2836" fill="none" stroke="#5c005c" stroke-width="1" rx="8"/>

    <!-- Institutional Watermark (Geometric Rings & Seal in Background) -->
    <circle cx="1050" cy="1485" r="480" fill="none" class="brand-stroke" stroke-width="36" opacity="0.035"/>
    <circle cx="1050" cy="1485" r="410" fill="none" class="brand-stroke" stroke-width="12" opacity="0.035"/>
    <circle cx="1050" cy="1485" r="340" fill="none" class="brand-stroke" stroke-width="6" stroke-dasharray="24 16" opacity="0.035"/>
    <text x="1050" y="1465" font-size="76" font-weight="bold" class="brand" text-anchor="middle" letter-spacing="8" opacity="0.045">EAST AFRICA VISION</text>
    <text x="1050" y="1545" font-size="68" font-weight="bold" class="brand" text-anchor="middle" letter-spacing="8" opacity="0.045">INSTITUTE</text>

    <!-- HEADER: Diagonal Geometric Accents matching ID card -->
    <polygon points="1660,67 1715,67 1595,240 1540,240" class="accent"/>
    <polygon points="1715,67 2033,67 2033,240 1595,240" class="brand"/>
    <rect x="67" y="240" width="1966" height="10" class="brand"/>
    <rect x="67" y="250" width="1966" height="5" class="accent"/>

    <!-- Header Right Label -->
    <text x="1990" y="145" text-anchor="end" font-size="30" font-weight="bold" class="white" letter-spacing="4">OFFICIAL</text>
    <text x="1990" y="185" text-anchor="end" font-size="18" font-weight="bold" class="white" letter-spacing="5">ADMISSION LETTER</text>

    <!-- Logo: The artwork uses the official ID card logo -->
    <image xlink:href="{{logo_url}}" href="{{logo_url}}" x="105" y="86" width="138" height="134" preserveAspectRatio="xMidYMid meet"/>

    <!-- Institution Letterhead Typography -->
    <text x="268" y="130" font-size="38" font-weight="bold" class="ink" letter-spacing="1.5">EAST AFRICA VISION INSTITUTE</text>
    <text x="268" y="165" font-size="20" font-weight="bold" class="brand" letter-spacing="2">SCHOOL OF MANAGEMENT &amp; HUMAN CAPACITY BUILDING</text>
    <text x="268" y="195" font-size="16" class="muted">ELDORET MAIN CAMPUS  |  WEST CAMPUS  |  TOWN OFFICE  |  ELDORET, KENYA</text>
    <text x="268" y="220" font-size="13" fill="#6B7280" font-style="italic">TVETA Reg: MOHEST/PC/1409/011  ·  KNEC Centre No. 26578004  ·  Helpline: 0726 044 022</text>

    <!-- METADATA BAR (Ref, Issue Date, Expiry) -->
    <rect x="105" y="280" width="1890" height="85" rx="8" fill="#F9FAFB" stroke="#E5E7EB" stroke-width="2"/>
    <text x="145" y="312" class="label">REFERENCE NUMBER</text>
    <text data-slot="reference" x="145" y="345" font-size="24" font-weight="bold" class="brand">{{reference}}</text>

    <text x="800" y="312" class="label">DATE OF ISSUE</text>
    <text data-slot="issue_date" x="800" y="345" class="value">{{issue_date}}</text>

    <text x="1450" y="312" class="label">LETTER VALID UNTIL</text>
    <text data-slot="expiry_date" x="1450" y="345" font-size="22" font-weight="bold" class="accent">{{expiry_date}}</text>

    <!-- RECIPIENT BLOCK -->
    <text x="105" y="415" class="label">APPLICANT / PROSPECTIVE STUDENT</text>
    <text data-slot="full_name" x="105" y="456" font-size="34" font-weight="bold" class="ink">{{full_name}}</text>
    <rect x="105" y="470" width="180" height="5" class="brand"/>

    <!-- LETTER TITLE BANNER -->
    <rect x="105" y="505" width="1890" height="60" rx="8" class="brand"/>
    <rect x="105" y="505" width="1890" height="4" class="accent"/>
    <text x="1050" y="546" font-size="23" font-weight="bold" class="white" text-anchor="middle" letter-spacing="3">ACKNOWLEDGEMENT OF APPLICATION</text>

    <!-- OPENING STATEMENT -->
    <text x="105" y="612" font-size="22" font-weight="bold" class="ink">Dear {{full_name}},</text>
    <text x="105" y="652" font-size="19" class="ink">We confirm that your application for admission to East Africa Vision Institute has been officially received</text>
    <text x="105" y="686" font-size="19" class="ink">and indexed. Your stated qualification has been recorded and your application will be reviewed against</text>
    <text x="105" y="720" font-size="19" class="ink">the entry requirements for the programme below at our <tspan font-weight="bold" class="brand">{{campus}}</tspan> for <tspan font-weight="bold" class="accent">{{intake}}</tspan>.</text>

    <!-- ADMISSION PARTICULARS CARD (ID Card Styled) -->
    <g filter="url(#card-shadow)">
      <rect x="105" y="760" width="1890" height="395" rx="12" fill="#FDFBFD" stroke="#800080" stroke-width="2.5"/>
      <rect x="105" y="760" width="1890" height="50" rx="12" class="brand"/>
      <rect x="105" y="798" width="1890" height="12" class="brand"/>
      <text x="140" y="796" font-size="19" font-weight="bold" class="white" letter-spacing="2">APPLICATION &amp; COURSE PARTICULARS</text>
    </g>

    <!-- Row 1 -->
    <text x="145" y="852" class="label">APPLICATION REFERENCE</text>
    <text data-slot="reference" x="145" y="882" class="value brand">{{reference}}</text>

    <text x="1050" y="852" class="label">REPORTING CAMPUS</text>
    <text data-slot="campus" x="1050" y="882" class="value">{{campus}}</text>

    <!-- Row 2 -->
    <text x="145" y="932" class="label">FULL STUDENT NAME</text>
    <text data-slot="full_name" x="145" y="962" class="value">{{full_name}}</text>

    <text x="1050" y="932" class="label">INTAKE / REPORTING PERIOD</text>
    <text data-slot="intake" x="1050" y="962" class="value">{{intake}}</text>

    <!-- Row 3 -->
    <text x="145" y="1012" class="label">PROGRAMME OF STUDY</text>
    <text data-slot="course" x="145" y="1042" font-size="22" font-weight="bold" class="brand">{{course}}</text>

    <text x="1050" y="1012" class="label">PROGRAMME CODE / ENTRY</text>
    <text data-slot="course_code" x="1050" y="1042" class="value">{{course_code}}</text>

    <!-- Row 4 -->
    <text x="145" y="1092" class="label">APPLICATION STATUS</text>
    <text x="145" y="1122" font-size="21" font-weight="bold" fill="#047857">SUBMITTED &amp; ACKNOWLEDGED</text>

    <text x="1050" y="1092" class="label">INSTITUTIONAL ACCREDITATION</text>
    <text x="1050" y="1122" class="value">MOHEST/PC/1409/011  ·  KNEC 26578004</text>

    <!-- IMPORTANT ADVICE NOTICE -->
    <rect x="105" y="1190" width="1890" height="142" rx="8" fill="#F9FAFB" stroke="#E5E7EB" stroke-width="2"/>
    <polygon points="105,1190 120,1190 120,1332 105,1332" class="brand"/>
    <text x="145" y="1226" font-size="18" font-weight="bold" class="brand">IMPORTANT ADMISSION INSTRUCTIONS</text>
    <text x="145" y="1258" font-size="16.5" class="ink">This acknowledgement confirms your application details in the college system. Please bring it when reporting</text>
    <text x="145" y="1288" font-size="16.5" class="ink">to <tspan font-weight="bold">{{campus}}</tspan>. Your permanent admission number, student portal access, smart ID card, and class placement</text>
    <text x="145" y="1318" font-size="16.5" class="ink">will be issued upon physical verification of documents and completion of registration fees at the admissions desk.</text>

    <!-- MANDATORY REQUIREMENTS CHECKLIST -->
    <text x="105" y="1378" font-size="21" font-weight="bold" class="brand">MANDATORY REQUIREMENTS FOR REPORTING &amp; REGISTRATION</text>
    <line x1="105" y1="1394" x2="1995" y2="1394" stroke="#800080" stroke-width="2"/>

    <!-- Item 1 -->
    <circle cx="125" cy="1435" r="14" class="brand"/>
    <text x="125" y="1440" font-size="13" font-weight="bold" class="white" text-anchor="middle">1</text>
    <text x="155" y="1441" font-size="16" class="ink"><tspan font-weight="bold">Academic Certificates:</tspan> Original and copies of KCSE Certificate or Official Result Slip (duly certified).</text>

    <!-- Item 2 -->
    <circle cx="125" cy="1485" r="14" class="brand"/>
    <text x="125" y="1490" font-size="13" font-weight="bold" class="white" text-anchor="middle">2</text>
    <text x="155" y="1491" font-size="16" class="ink"><tspan font-weight="bold">Identification:</tspan> Original and clear copy of National Identity Card, Birth Certificate, or Valid Passport.</text>

    <!-- Item 3 -->
    <circle cx="125" cy="1535" r="14" class="brand"/>
    <text x="125" y="1540" font-size="13" font-weight="bold" class="white" text-anchor="middle">3</text>
    <text x="155" y="1541" font-size="16" class="ink"><tspan font-weight="bold">Photographs:</tspan> Two (2) recent passport-sized color photographs taken against a plain light background.</text>

    <!-- Item 4 -->
    <circle cx="125" cy="1585" r="14" class="brand"/>
    <text x="125" y="1590" font-size="13" font-weight="bold" class="white" text-anchor="middle">4</text>
    <text x="155" y="1591" font-size="16" class="ink"><tspan font-weight="bold">Leaving Certificate:</tspan> Original secondary school leaving certificate from the previous school attended.</text>

    <!-- Item 5 -->
    <circle cx="125" cy="1635" r="14" class="brand"/>
    <text x="125" y="1640" font-size="13" font-weight="bold" class="white" text-anchor="middle">5</text>
    <text x="155" y="1641" font-size="16" class="ink"><tspan font-weight="bold">Fee Schedule &amp; Deposit:</tspan> Official bank deposit slip or M-PESA paybill transaction confirmation for tuition/registration fees.</text>

    <!-- Item 6 -->
    <circle cx="125" cy="1685" r="14" class="brand"/>
    <text x="125" y="1690" font-size="13" font-weight="bold" class="white" text-anchor="middle">6</text>
    <text x="155" y="1691" font-size="16" class="ink"><tspan font-weight="bold">Medical &amp; Bio-Data:</tspan> Duly filled Student Bio-Data, Rules &amp; Regulations, and Medical Examination forms.</text>

    <!-- Note -->
    <text x="105" y="1740" font-size="15" class="muted" font-style="italic">Bursary Support Note: Applicants seeking financial aid should bring a completed EAVI Bursary Support Scheme form when reporting.</text>

    <!-- CAMPUS CONTACTS & REPORTING DESKS -->
    <rect x="105" y="1780" width="1890" height="190" rx="10" fill="#FAF5FF" stroke="#5c005c" stroke-width="1.5"/>
    <text x="140" y="1818" font-size="19" font-weight="bold" class="accent">CAMPUS LOCATIONS &amp; ADMISSION INQUIRIES</text>
    <line x1="140" y1="1832" x2="1960" y2="1832" stroke="#E9D5FF" stroke-width="1.5"/>

    <text x="140" y="1862" font-size="15" class="ink"><tspan font-weight="bold" class="brand">Admissions Office:</tspan> Skymart Bldg, 1st Floor, Room F45, Eldoret</text>
    <text x="140" y="1890" font-size="15" class="ink"><tspan font-weight="bold" class="brand">Main Campus:</tspan> City Plaza, Next to Bandaptai Hotel  |  Tel: 0726 044 022</text>
    <text x="140" y="1918" font-size="15" class="ink"><tspan font-weight="bold" class="brand">West Campus:</tspan> Mailinne, Next to Kapyemit Dispensary  |  Tel: 0748 022 044</text>

    <text x="1080" y="1862" font-size="15" class="ink"><tspan font-weight="bold" class="brand">Official Email:</tspan> admissions@eavi.ac.ke  |  info@eavi.ac.ke</text>
    <text x="1080" y="1890" font-size="15" class="ink"><tspan font-weight="bold" class="brand">Portal &amp; Web:</tspan> {{website}}</text>
    <text x="1080" y="1918" font-size="15" class="ink"><tspan font-weight="bold" class="brand">Office Hours:</tspan> Monday – Friday: 8:00 AM – 5:00 PM  |  Sat: 8:30 AM – 1:00 PM</text>

    <!-- OFFICIAL SIGN-OFF & QR VERIFICATION SECTION -->
    <!-- Left Column: Registrar Signature & Official Seal -->
    <text x="120" y="2025" class="label">ISSUED BY THE OFFICE OF THE REGISTRAR:</text>

    <!-- Signature Artwork -->
    <image xlink:href="{{signature_url}}" href="{{signature_url}}" x="130" y="2060" width="230" height="95" preserveAspectRatio="xMidYMid meet"/>

    <!-- Official Stamp (Overlapping signature for authentic official look) -->
    <image xlink:href="{{stamp_url}}" href="{{stamp_url}}" x="290" y="2045" width="280" height="130" opacity="0.9" preserveAspectRatio="xMidYMid meet"/>

    <line x1="120" y1="2195" x2="680" y2="2195" stroke="#1F2937" stroke-width="2"/>
    <text x="120" y="2232" font-size="25" font-weight="bold" class="ink">THE ACADEMIC REGISTRAR</text>
    <text x="120" y="2262" font-size="18" class="muted">East Africa Vision Institute</text>
    <text x="120" y="2290" font-size="15" font-weight="bold" class="brand">P.O. Box 7149 - 30100, Eldoret, Kenya</text>

    <!-- Right Column: Verification QR Code & Token Box -->
    <g filter="url(#card-shadow)">
      <rect x="1180" y="1995" width="815" height="350" rx="12" fill="#FFFFFF" stroke="#800080" stroke-width="2.5"/>
      <rect x="1180" y="1995" width="815" height="44" rx="12" class="brand"/>
      <rect x="1180" y="2028" width="815" height="12" class="brand"/>
      <text x="1587" y="2026" text-anchor="middle" font-size="17" font-weight="bold" class="white" letter-spacing="2">OFFICIAL DOCUMENT VERIFICATION</text>
    </g>

    <!-- Vector QR Code Slot -->
    <g data-slot="qr" transform="translate(1215, 2060)">
      <rect width="185" height="185" fill="#FFFFFF" class="ink-stroke" stroke-width="2" stroke-dasharray="8 6"/>
      <text x="92" y="100" text-anchor="middle" font-size="18" font-weight="bold" class="ink">QR CODE</text>
    </g>

    <!-- QR Explanatory Text -->
    <text x="1430" y="2090" font-size="19" font-weight="bold" class="brand">SCAN TO VERIFY</text>
    <text x="1430" y="2120" font-size="14.5" class="muted">Point your smartphone camera</text>
    <text x="1430" y="2142" font-size="14.5" class="muted">at this QR code to authenticate</text>
    <text x="1430" y="2164" font-size="14.5" class="muted">this letter with the registry.</text>

    <text x="1430" y="2200" class="label" font-size="12">TOKEN:</text>
    <text data-slot="verify_token" x="1430" y="2224" font-size="12" font-family="monospace" class="ink">{{verify_token}}</text>

    <line x1="1205" y1="2265" x2="1970" y2="2265" stroke="#E5E7EB" stroke-width="1.5"/>
    <text x="1587" y="2292" text-anchor="middle" font-size="13" class="muted">Direct Online Verification:</text>
    <text data-slot="verify_url" x="1587" y="2316" text-anchor="middle" font-size="13.5" font-weight="bold" class="brand">{{verify_url}}</text>

    <!-- FOOTER: Matching ID Card Bottom Stripes & Text -->
    <rect x="67" y="2830" width="1966" height="6" class="accent"/>
    <rect x="67" y="2836" width="1966" height="52" class="brand"/>
    <text data-slot="website" x="1050" y="2869" text-anchor="middle" font-size="16" font-weight="bold" class="white" letter-spacing="2">EAST AFRICA VISION INSTITUTE  ·  ELDORET, KENYA  ·  {{website}}</text>
    <text x="1050" y="2918" text-anchor="middle" font-size="13" fill="#6B7280">This admission acknowledgement is an official document of East Africa Vision Institute. Unauthorised alteration, duplication, or forgery is a criminal offence.</text>
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

/**
 * Escapes values for XML text nodes and attributes.
 */
export function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Merges the slot values into the SVG template string.
 */
export function mergeAdmissionLetterTemplate(template: string, slots: Partial<AdmissionLetterSlots>): string {
  return template.replace(/\{\{([a-z_]+)\}\}/g, (match, slot: string) => {
    const value = slots[slot as keyof AdmissionLetterSlots];
    if (value === null || value === undefined || value === "") {
      if (slot.endsWith("_url")) return "";
      return escapeXml("—");
    }
    return escapeXml(String(value));
  });
}
