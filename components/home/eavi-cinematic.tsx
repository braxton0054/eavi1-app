"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

import { campuses } from "@/lib/campuses";
import styles from "./eavi-cinematic.module.css";

/**
 * Cinematic top of the EAVI homepage, adapted from the Orvante editorial hero:
 * a masked campus photograph, oversized display type, a floating stats frame and a
 * statement whose words fill as it enters the viewport. Every number here is real.
 */
const STATEMENT =
  "We believe a practical education should be within reach of every family in Eldoret. Our tutors teach the work, not just the theory, and our campuses stay close to the students who need them.";

export function EaviCinematic({
  programmes,
  students,
  photos,
}: {
  programmes: number;
  students: number;
  photos: number;
}) {
  const [active, setActive] = useState(0);
  const [filled, setFilled] = useState(false);
  const statementRef = useRef<HTMLDivElement>(null);
  const links = ["Programs", "Campuses", "Admissions", "Fees", "About", "Contact"];

  useEffect(() => {
    const node = statementRef.current;
    if (!node) return;
    // One scroll trigger, not scroll-jacking: the words fill once when the statement enters.
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setFilled(true);
          observer.disconnect();
        }
      },
      { threshold: 0.25 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <section className={styles.hero} aria-labelledby="cinematic-title">
        <div className={styles.heroInner}>
          <nav className={styles.nav} aria-label="Primary">
            {links.map((label, index) => (
              <a
                key={label}
                href={`/#${label.toLowerCase()}`}
                className={styles.navLink}
                data-active={active === index || undefined}
                onMouseEnter={() => setActive(index)}
                onFocus={() => setActive(index)}
              >
                {label}
              </a>
            ))}
          </nav>

          <div className={styles.topRight}>
            <span className={styles.location}>Eldoret, Kenya</span>
            <Link className={styles.applyButton} href="/apply">
              Apply now
            </Link>
          </div>

          <h1 id="cinematic-title" className={styles.title}>
            <span>Leading<sup className={styles.titleMark}>EAVI</sup></span>
            <span>the Leaders</span>
          </h1>

          <div className={styles.about}>
            <p className={styles.aboutLabel}>● (About)</p>
            <p className={styles.aboutCopy}>
              Quality and affordable education across three campuses in Eldoret.
            </p>
            <Link className={styles.aboutButton} href="/apply">
              Start your application
            </Link>
          </div>

          <div className={styles.statsFrame}>
            <div className={styles.statCard}>
              <p className={styles.statValue}>{students}</p>
              <p className={styles.statLabel}>Students enrolled</p>
              <p className={styles.statNote}>Across {campuses.length} campuses</p>
              <Link className={styles.statLink} href="/dashboard">
                See the portal
              </Link>
            </div>
            <div className={styles.photoCard}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/eavi-assets/web/018.jpg" alt="Students at an EAVI college event" loading="lazy" />
              <p className={styles.photoCaption}>
                College photographs <span>{photos}</span>
              </p>
            </div>
          </div>

          <div className={styles.photoWrap}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/eavi-assets/web/001.jpg"
              alt="The EAVI College campus building and bus in Eldoret"
              className={styles.heroPhoto}
            />
            <div className={styles.brandPlate}>
              <span className={styles.brandMark} aria-hidden="true" />
              <span className={styles.brandName}>EAVI</span>
              <span className={styles.brandMenu} aria-hidden="true" />
            </div>
            <p className={styles.photoLogos}>Main Campus · West Campus · Town Office</p>
          </div>

          <div className={styles.rightColumn}>
            <p className={styles.available}>● Available for you</p>
            <div className={styles.featureCard}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/eavi-assets/web/104.jpg" alt="A student in practical training" loading="lazy" />
              <div className={styles.featureRow}>
                <span>Practical training</span>
                <span className={styles.featureArrow} aria-hidden="true" />
              </div>
            </div>
          </div>

          <div className={styles.counts}>
            <p><strong>{programmes}</strong> programmes</p>
            <p><strong>{campuses.length}</strong> campuses</p>
          </div>
        </div>
      </section>

      <div className={styles.bar} aria-hidden="true">
        <span>EAVI College</span>
        <span>Scroll to explore</span>
        <span>Eldoret, Kenya</span>
      </div>

      <section className={styles.statementSection} aria-labelledby="statement-title">
        <h2 id="statement-title" className="sr-only">Why students choose EAVI</h2>
        <div ref={statementRef} className={styles.statement} data-filled={filled || undefined}>
          {STATEMENT.split(" ").map((word, index) => (
            <span key={`${word}-${index}`} style={{ transitionDelay: `${index * 35}ms` }}>
              {word}{" "}
            </span>
          ))}
        </div>
        <p className={styles.statementSub}>
          From your first application to your final certificate, the college stays with you.
        </p>
      </section>
    </>
  );
}
