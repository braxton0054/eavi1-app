import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import styles from "./auth-shell.module.css";

/**
 * The chrome around every signed-out screen: the institute, one way back, and a single
 * narrow column. There is no split-screen marketing panel because the repo holds no
 * verified campus photography, and an invented image is worse than none (CPY-09).
 */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <Link href="/" className={styles.brand}>
          <span className={styles.logoPlate}>
            <Image
              src="/logo.png"
              alt=""
              width={36}
              height={34}
              sizes="36px"
              priority
            />
          </span>
          <span className={styles.wordmark}>
            <span className={styles.wordmarkShort}>EAVI</span>
            <span className={styles.wordmarkFull}>East Africa Vision Institute</span>
          </span>
        </Link>

        <Link href="/" className={styles.back}>
          Back to home
        </Link>
      </header>

      <main className={styles.main}>
        <div className={styles.panel}>{children}</div>
      </main>
    </div>
  );
}
