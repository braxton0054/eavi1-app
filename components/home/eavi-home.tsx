import Image from "next/image";
import Link from "next/link";

import { PhotoGallery } from "@/components/home/photo-gallery";
import { ProgramCatalogue } from "@/components/home/program-catalogue";
import {
  admissionsSection,
  campuses,
  ctaSection,
  faqSection,
  hero,
  mainCampus,
  programsSection,
  site,
  whySection,
  type Program,
} from "@/lib/content/home";

import styles from "./eavi-home.module.css";

/**
 * The EAVI homepage: an institutional prospectus rather than a SaaS landing page.
 *
 * One bold element — the violet hero — and everything after it is quiet: hairline rules,
 * course-catalogue rows, and plain directory entries. No tracked-out caps, no middle dots,
 * no shimmering buttons, no three-identical-card grids. Copy is sentence case and says
 * exactly what each link does.
 */
export function EaviHome({
  programs,
  studentCount,
}: {
  programs: Program[];
  studentCount: number;
}) {
  return (
    <>
      <section className={styles.hero} aria-labelledby="hero-title">
        <div className={styles.heroInner}>
          <div>
            <p className={styles.heroWordmark}>
              {site.shortName}, {site.location}
            </p>
            <h1 id="hero-title" className={styles.heroTitle}>
              {hero.heading}
            </h1>
            <p className={styles.heroSub}>{hero.subheading}</p>
            <div className={styles.heroActions}>
              <Link className={styles.heroPrimary} href="/apply">
                Apply now
              </Link>
              <Link className={styles.heroSecondary} href="/login">
                Sign in
              </Link>
            </div>
          </div>
          {hero.photo ? (
            <Image
              src={hero.photo}
              alt={hero.photoAlt}
              width={1200}
              height={960}
              priority
              className={styles.heroPhoto}
            />
          ) : null}
        </div>
      </section>

      <dl className={styles.facts}>
        <div className={styles.fact}>
          <dt className={styles.factLabel}>Teaching campuses</dt>
          <dd className={styles.factValue}>2</dd>
        </div>
        <div className={styles.fact}>
          <dt className={styles.factLabel}>Programmes</dt>
          <dd className={styles.factValue}>{programs.length}</dd>
        </div>
        <div className={styles.fact}>
          <dt className={styles.factLabel}>Students enrolled</dt>
          <dd className={styles.factValue}>{studentCount}</dd>
        </div>
      </dl>

      <section id={whySection.id} className={styles.section} aria-labelledby="why-title">
        <div className={styles.wrap}>
          <div className={styles.sectionHead}>
            <p className={styles.sectionLabel}>Why EAVI</p>
            <h2 id="why-title" className={styles.sectionTitle}>
              {whySection.heading}
            </h2>
            <p className={styles.sectionIntro}>{whySection.subheading}</p>
          </div>
          <ul className={styles.reasons}>
            {whySection.reasons.map((reason) => (
              <li key={reason.title} className={styles.reason}>
                <h3 className={styles.reasonTitle}>{reason.title}</h3>
                {reason.detail ? <p className={styles.reasonDetail}>{reason.detail}</p> : null}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section id={programsSection.id} className={styles.section} aria-labelledby="programs-title">
        <div className={styles.wrap}>
          <div className={styles.sectionHead}>
            <p className={styles.sectionLabel}>Programmes</p>
            <h2 id="programs-title" className={styles.sectionTitle}>
              {programsSection.heading}
            </h2>
            <p className={styles.sectionIntro}>{programsSection.subheading}</p>
          </div>
          {programs.length > 0 ? (
            <ProgramCatalogue programs={programs} />
          ) : (
            <p className={styles.sectionIntro}>Programmes will be listed here once published.</p>
          )}
        </div>
      </section>

      <section id={admissionsSection.id} className={styles.section} aria-labelledby="admissions-title">
        <div className={styles.wrap}>
          <div className={styles.sectionHead}>
            <p className={styles.sectionLabel}>Admissions</p>
            <h2 id="admissions-title" className={styles.sectionTitle}>
              {admissionsSection.heading}
            </h2>
            <p className={styles.sectionIntro}>{admissionsSection.subheading}</p>
          </div>
          <ol className={styles.steps}>
            {admissionsSection.steps.map((step, index) => (
              <li key={step.title}>
                <span className={styles.stepNumber} aria-hidden="true">
                  {index + 1}
                </span>
                <h3 className={styles.stepTitle}>{step.title}</h3>
                <p className={styles.stepLine}>{step.line}</p>
                {"href" in step && step.href ? (
                  <Link className={styles.stepLink} href={step.href}>
                    {step.action}
                  </Link>
                ) : null}
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="fees" className={styles.section} aria-labelledby="fees-title">
        <div className={styles.wrap}>
          <div className={styles.sectionHead}>
            <p className={styles.sectionLabel}>Fees</p>
            <h2 id="fees-title" className={styles.sectionTitle}>
              Fees, explained
            </h2>
            <p className={styles.sectionIntro}>
              Fees are billed per programme and can be paid in instalments as you study.
              The current figures come with your offer letter, or you can call the campus
              you want to join.
            </p>
          </div>
          <a className={styles.stepLink} href={`tel:${mainCampus.tel}`}>
            Call {mainCampus.name} on {mainCampus.phone}
          </a>
        </div>
      </section>

      <section id="campuses" className={styles.section} aria-labelledby="campuses-title">
        <div className={styles.wrap}>
          <div className={styles.sectionHead}>
            <p className={styles.sectionLabel}>Campuses</p>
            <h2 id="campuses-title" className={styles.sectionTitle}>
              Find us in Eldoret
            </h2>
            <p className={styles.sectionIntro}>
              Two teaching campuses and one town office. Each number reaches the right desk.
            </p>
          </div>
          <ul className={styles.campuses}>
            {campuses.map((campus) => (
              <li key={campus.name} className={styles.campus}>
                <h3 className={styles.campusName}>{campus.name}</h3>
                <p className={styles.campusPlace}>{campus.place}</p>
                <a className={styles.campusPhone} href={`tel:${campus.tel}`}>
                  {campus.phone}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section id="gallery" className={styles.section} aria-labelledby="gallery-title">
        <div className={styles.wrap}>
          <div className={styles.sectionHead}>
            <p className={styles.sectionLabel}>Campus life</p>
            <h2 id="gallery-title" className={styles.sectionTitle}>
              Around EAVI
            </h2>
            <p className={styles.sectionIntro}>
              A look at the campus, the classrooms and the practical work students do here.
            </p>
          </div>
          <PhotoGallery />
        </div>
      </section>

      <section id={faqSection.id} className={styles.section} aria-labelledby="faq-title">
        <div className={styles.wrap}>
          <div className={styles.sectionHead}>
            <p className={styles.sectionLabel}>Questions</p>
            <h2 id="faq-title" className={styles.sectionTitle}>
              {faqSection.heading}
            </h2>
            <p className={styles.sectionIntro}>{faqSection.subheading}</p>
          </div>
          <div className={styles.faq}>
            {faqSection.items.map((item) => (
              <details key={item.question} className={styles.faqItem}>
                <summary className={styles.faqQuestion}>{item.question}</summary>
                <p className={styles.faqAnswer}>{item.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section id="contact" className={styles.cta} aria-labelledby="cta-title">
        <div className={styles.ctaInner}>
          <div>
            <h2 id="cta-title" className={styles.ctaTitle}>
              {ctaSection.heading}
            </h2>
            <p className={styles.ctaText}>{ctaSection.subheading}</p>
          </div>
          <div className={styles.heroActions}>
            <Link className={styles.heroPrimary} href="/apply">
              Apply now
            </Link>
            <Link className={styles.heroSecondary} href="/#campuses">
              Find a campus
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
