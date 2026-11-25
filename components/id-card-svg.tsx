/**
 * The student ID card artwork — the one the whole system uses — lives here.
 *
 * This module is the single source of truth for the card faces: the React components
 * below merge it for the screen, and the print pipeline (`lib/dal/cards.ts` →
 * `lib/cards/render.ts`) merges the same strings for the printer, so what a student
 * sees is exactly what is printed on the plastic.
 *
 * The artwork is data, not markup: brace-wrapped slots are filled by the pure merge
 * engine in `lib/cards/template.ts`, whose rules (XML escaping, missing values become
 * an em dash, text fitted to `data-max-width`) apply identically on screen and paper.
 * Edit the two template strings to change the design; CR80 landscape, 10 units = 1mm.
 */
import { mergeCardTemplate, type CardSlots } from "@/lib/cards/template";

export const CARD_TEMPLATES: { front: string; back: string } = {
  front: `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="85.6mm" height="54mm" viewBox="0 0 856 540" font-family="'Liberation Sans', Arial, Helvetica, sans-serif">
  <!-- EAVI Student ID - FRONT | CR80 85.6 x 54mm | 10 units = 1mm -->
  <!--
    Slots are the brace-wrapped tokens below. data-max-width is in template units and
    is the hard right limit the renderer shrinks or truncates against; data-slot is
    the id the merge engine targets. Corner radius is 2.8mm against the CR80 3.18mm die.
  -->
  <style>
    .ink{fill:#1F2937}
    .brand{fill:#800080}
    .accent{fill:#5c005c}
    .ink-stroke{stroke:#1F2937}
    .brand-stroke{stroke:#800080}
    .accent-stroke{stroke:#5c005c}
    .label{font-size:13px;fill:#6B7280;letter-spacing:1.5px;font-weight:bold}
    .value{font-size:24px;fill:#1F2937;font-weight:bold}
    .white{fill:#FFFFFF}
  </style>
  <defs>
    <clipPath id="fr-card"><rect width="856" height="540" rx="28"/></clipPath>
    <clipPath id="fr-photo"><rect x="40" y="140" width="200" height="250" rx="12"/></clipPath>
  </defs>

  <g clip-path="url(#fr-card)">
    <rect width="856" height="540" fill="#FFFFFF"/>

    <!-- watermark ring -->
    <circle cx="740" cy="400" r="190" fill="none" class="brand-stroke" stroke-width="40" opacity="0.05"/>

    <!-- header: diagonal accent on the right -->
    <polygon points="676,0 692,0 652,112 636,112" class="accent"/>
    <polygon points="692,0 856,0 856,112 652,112" class="brand"/>
    <rect y="112" width="856" height="6" class="brand"/>
    <rect y="118" width="856" height="3" class="accent"/>

    <!-- logo: the artwork needs a light plate, which the card face already provides -->
    <image xlink:href="{{logo_url}}" href="{{logo_url}}" x="24" y="8" width="100" height="94" preserveAspectRatio="xMidYMid meet"/>

    <text x="140" y="52" font-size="26" font-weight="bold" class="ink">EAST AFRICA VISION INSTITUTE</text>
    <text x="140" y="82" font-size="16" font-weight="bold" class="brand" letter-spacing="2">ELDORET, KENYA</text>
    <text x="820" y="64" text-anchor="end" font-size="20" font-weight="bold" class="white" letter-spacing="3">STUDENT</text>
    <text x="820" y="90" text-anchor="end" font-size="14" class="white" letter-spacing="4">ID CARD</text>

    <!-- photo -->
    <rect x="40" y="140" width="200" height="250" rx="12" fill="#E5E7EB"/>
    <circle cx="140" cy="236" r="46" fill="#CBD5E1"/>
    <path d="M58 390 C58 318 222 318 222 390 Z" fill="#CBD5E1"/>
    <image data-slot="photo_url" xlink:href="{{photo_url}}" href="{{photo_url}}" x="40" y="140" width="200" height="250" preserveAspectRatio="xMidYMid slice" clip-path="url(#fr-photo)"/>
    <rect x="40" y="140" width="200" height="250" rx="12" fill="none" class="brand-stroke" stroke-width="5"/>

    <!-- reg no: boxed left of the field column -->
    <text x="40" y="418" class="label">REG NO.</text>
    <text data-slot="reg_no" data-max-width="215" x="40" y="446" class="value">{{reg_no}}</text>

    <!-- fields -->
    <text x="275" y="152" class="label">FULL NAME</text>
    <text data-slot="full_name" data-max-width="545" x="275" y="190" font-size="30" font-weight="bold" class="ink">{{full_name}}</text>
    <rect x="275" y="202" width="70" height="4" class="brand"/>

    <text x="275" y="244" class="label">COURSE</text>
    <text data-slot="course" data-max-width="545" x="275" y="272" class="value">{{course}}</text>

    <text x="275" y="312" class="label">CAMPUS</text>
    <text data-slot="campus" data-max-width="270" x="275" y="340" class="value">{{campus}}</text>

    <!-- class occupies the free right column; it never crosses the campus or intake cells -->
    <text x="560" y="312" class="label">CLASS</text>
    <text data-slot="class_name" data-max-width="260" x="560" y="340" font-size="18" font-weight="bold" class="ink">{{class_name}}</text>

    <!-- intake and expiry share a row, so intake stops where the expiry column starts -->
    <text x="275" y="380" class="label">INTAKE</text>
    <text data-slot="intake" data-max-width="270" x="275" y="408" class="value">{{intake}}</text>
    <text x="560" y="380" class="label">VALID UNTIL</text>
    <text data-slot="expiry_date" data-max-width="260" x="560" y="408" class="value">{{expiry_date}}</text>

    <!-- signatures -->
    <line x1="275" y1="466" x2="530" y2="466" class="ink-stroke" stroke-width="1.5"/>
    <text x="275" y="484" class="label" font-size="11">HOLDER'S SIGNATURE</text>

    <line x1="580" y1="466" x2="816" y2="466" class="ink-stroke" stroke-width="1.5"/>
    <text x="580" y="484" class="label" font-size="11">REGISTRAR</text>
    <image data-slot="signature_url" xlink:href="{{signature_url}}" href="{{signature_url}}" x="596" y="414" width="180" height="48" preserveAspectRatio="xMidYMid meet"/>

    <!-- footer -->
    <rect y="500" width="856" height="40" class="brand"/>
    <rect y="500" width="856" height="4" class="accent"/>
    <text data-slot="website" data-max-width="620" x="428" y="527" text-anchor="middle" font-size="14" class="white" letter-spacing="2">{{website}}</text>
  </g>
</svg>`,
  back: `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="85.6mm" height="54mm" viewBox="0 0 856 540" font-family="'Liberation Sans', Arial, Helvetica, sans-serif">
  <!-- EAVI Student ID - BACK | CR80 85.6 x 54mm | 10 units = 1mm -->
  <!--
    The qr and barcode groups are replaced wholesale at render time. Their contents
    here are a fallback so the template still reads correctly when nothing has been
    generated. Campus addresses below are artwork, not data: a second campus prints
    from its own template row rather than sharing this one.
  -->
  <style>
    .ink{fill:#1F2937}
    .brand{fill:#800080}
    .accent{fill:#5c005c}
    .ink-stroke{stroke:#1F2937}
    .brand-stroke{stroke:#800080}
    .accent-stroke{stroke:#5c005c}
    .label{font-size:12px;fill:#6B7280;letter-spacing:1.5px;font-weight:bold}
    .head{font-size:14px;fill:#800080;font-weight:bold;letter-spacing:2px}
    .body{font-size:17px;fill:#1F2937}
    .white{fill:#FFFFFF}
  </style>
  <defs>
    <clipPath id="bk-card"><rect width="856" height="540" rx="28"/></clipPath>
  </defs>

  <g clip-path="url(#bk-card)">
    <rect width="856" height="540" fill="#FFFFFF"/>

    <!-- header -->
    <image xlink:href="{{logo_url}}" href="{{logo_url}}" x="26" y="3" width="55" height="52" preserveAspectRatio="xMidYMid meet"/>
    <text x="96" y="30" font-size="22" font-weight="bold" class="ink" letter-spacing="1">EAST AFRICA VISION INSTITUTE</text>
    <text x="96" y="49" font-size="14" font-style="italic" font-weight="bold" class="brand">Nurturing quality and affordable education</text>
    <rect y="58" width="856" height="5" class="brand"/>
    <rect y="63" width="856" height="3" class="accent"/>

    <!-- terms -->
    <text x="40" y="100" class="head">TERMS OF USE</text>
    <text x="40" y="126" class="body">This card is the property of East Africa Vision Institute.</text>
    <text x="40" y="150" class="body">It is non-transferable and must be carried while on campus.</text>
    <text x="40" y="174" class="body">If found, please return it to any EAVI campus.</text>

    <!-- campuses -->
    <text x="40" y="212" class="head">CAMPUSES - ELDORET</text>
    <text x="40" y="238" class="body" font-size="15"><tspan font-weight="bold">Admissions:</tspan> Skymart Bldg, 1st Floor, Room F45</text>
    <text x="40" y="260" class="body" font-size="15"><tspan font-weight="bold">Main:</tspan> City Plaza, next to Bandaptai Hotel  |  0726 044 022</text>
    <text x="40" y="282" class="body" font-size="15"><tspan font-weight="bold">West:</tspan> Mailinne, next to Kapyemit Dispensary  |  0748 022 044</text>

    <!-- accreditation -->
    <text x="40" y="314" class="label">ACCREDITED BY MINISTRY OF EDUCATION &amp; TVETA</text>
    <text x="40" y="334" font-size="13" fill="#1F2937">Reg. No. MOHEST/PC/1409/011   |   KNEC Centre No. 26578004</text>

    <!-- verification QR: 180 units is 18mm, which holds a version 4 code at 0.55mm modules -->
    <g data-slot="qr" transform="translate(640,86)">
      <rect width="180" height="180" fill="#FFFFFF" class="ink-stroke" stroke-width="3" stroke-dasharray="8 6"/>
      <text x="90" y="98" text-anchor="middle" font-size="18" font-weight="bold" class="ink">QR</text>
    </g>
    <text x="730" y="288" text-anchor="middle" class="label">SCAN TO VERIFY</text>
    <text data-slot="verify_token" data-max-width="180" x="730" y="304" text-anchor="middle" font-size="11" fill="#6B7280">{{verify_token}}</text>

    <!-- barcode: Code 128 of the reg no, quiet zone included in the generated group -->
    <g data-slot="barcode" transform="translate(48,368)">
      <rect width="364" height="54" fill="#FFFFFF" class="ink-stroke" stroke-width="2" stroke-dasharray="8 6"/>
      <text x="182" y="31" text-anchor="middle" font-size="15" fill="#6B7280">BARCODE (Code 128)</text>
    </g>
    <text data-slot="reg_no" data-max-width="370" x="230" y="450" text-anchor="middle" font-size="17" font-weight="bold" class="ink" letter-spacing="3">{{reg_no}}</text>

    <!-- emergency contact -->
    <text x="470" y="376" class="label">EMERGENCY CONTACT</text>
    <text data-slot="emergency_name" data-max-width="350" x="470" y="404" font-size="21" font-weight="bold" class="ink">{{emergency_name}}</text>
    <text data-slot="emergency_phone" data-max-width="350" x="470" y="428" font-size="19" fill="#1F2937">{{emergency_phone}}</text>

    <!-- footer -->
    <rect y="480" width="856" height="60" class="brand"/>
    <rect y="480" width="856" height="4" class="accent"/>
    <text x="40" y="516" font-size="15" class="white">ISSUED: <tspan data-slot="issue_date" data-max-width="227" font-weight="bold">{{issue_date}}</tspan></text>
    <text data-slot="contact_email" data-max-width="190" x="428" y="516" text-anchor="middle" font-size="13" class="white" letter-spacing="1">{{contact_email}}</text>
    <text x="620" y="516" font-size="15" class="white">EXPIRES: <tspan data-slot="expiry_date" data-max-width="129" font-weight="bold">{{expiry_date}}</tspan></text>
  </g>
</svg>`,
};

/** What a card face needs. The record fields are optional so a proof can be partial. */
export type IdCardStudent = {
  name: string;
  adm: string;
  course: string;
  campus: string;
  validUntil: string;
  photoUrl?: string;
  status: "Active" | "Expired";
  intake?: string | null;
  issueDate?: string | null;
  email?: string | null;
  emergencyName?: string | null;
  emergencyPhone?: string | null;
  website?: string | null;
  serial?: string | null;
  verifyToken?: string | null;
};

/** The same slot defaults the print merge uses, so a screen proof matches a print. */
function slotsOf(student: IdCardStudent): CardSlots {
  return {
    logo_url: "/card-logo.png",
    signature_url: "/card-signature.png",
    photo_url: student.photoUrl ?? null,
    reg_no: student.adm,
    full_name: student.name,
    course: student.course,
    campus: student.campus,
    intake: student.intake ?? null,
    expiry_date: student.validUntil,
    issue_date: student.issueDate ?? null,
    website: student.website ?? null,
    verify_token: student.verifyToken ?? null,
    emergency_name: student.emergencyName ?? null,
    emergency_phone: student.emergencyPhone ?? null,
    contact_email: student.email ?? null,
  };
}

/** Renders a merged face. The wrapper disappears from layout; the artwork's own <svg> shows. */
function Face({ svg }: { svg: string }) {
  return (
    <div
      style={{ display: "contents" }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

export function IdCardFront({ student }: { student: IdCardStudent }) {
  return <Face svg={mergeCardTemplate(CARD_TEMPLATES.front, slotsOf(student))} />;
}

export function IdCardBack({ student }: { student: IdCardStudent }) {
  return <Face svg={mergeCardTemplate(CARD_TEMPLATES.back, slotsOf(student))} />;
}
