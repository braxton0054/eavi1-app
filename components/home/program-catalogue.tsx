"use client";

import { useMemo, useState } from "react";

import type { Program } from "@/lib/content/home";
import { programsSection } from "@/lib/content/home";

import styles from "./eavi-home.module.css";

/** A searchable-by-level course catalogue — rows, not a wall of identical cards. */
export function ProgramCatalogue({ programs }: { programs: Program[] }) {
  const levels = useMemo(
    () => [programsSection.allLevels, ...Array.from(new Set(programs.map((p) => p.level)))],
    [programs],
  );
  const [active, setActive] = useState<string>(programsSection.allLevels);
  const visible =
    active === programsSection.allLevels
      ? programs
      : programs.filter((p) => p.level === active);

  return (
    <>
      <div className={styles.filters} role="group" aria-label={programsSection.filterLabel}>
        {levels.map((level) => (
          <button
            key={level}
            type="button"
            className={styles.filter}
            aria-pressed={level === active}
            onClick={() => setActive(level)}
          >
            {level}
          </button>
        ))}
      </div>
      <ul className={styles.catalogue}>
        {visible.map((program) => (
          <li key={program.id} className={styles.catalogueRow}>
            <div>
              <h3 className={styles.programName}>{program.title}</h3>
              <p className={styles.programMeta}>{program.description}</p>
            </div>
            <p className={styles.programMeta}>{program.level}</p>
            <a className={styles.programLink} href={programsSection.learnMoreHref}>
              {programsSection.learnMore}
            </a>
          </li>
        ))}
      </ul>
    </>
  );
}
