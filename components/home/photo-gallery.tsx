"use client";

import { useEffect, useRef, useState } from "react";

import styles from "./eavi-home.module.css";

/**
 * Every photograph the college supplied, in file order. The office has not captioned
 * them, so the captions name the collection, not a specific claimed moment.
 */
const PHOTO_COUNT = 226;
const pad = (n: number) => String(n).padStart(3, "0");
const src = (index: number) => `/eavi-assets/web/${pad(index + 1)}.jpg`;

const TITLES = ["Campus life", "Around the institute", "On campus", "Student life", "The college", "Campus scenes"];
const caption = (index: number) => TITLES[index % TITLES.length];

/** Show a manageable first batch; the rest arrive on demand. */
const BATCH = 24;

export function PhotoGallery() {
  const [shown, setShown] = useState(BATCH);
  const [open, setOpen] = useState<number | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    if (open !== null && !node.open) node.showModal();
    if (open === null && node.open) node.close();
  }, [open]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (open === null) return;
      if (event.key === "ArrowRight") setOpen((v) => (v === null ? null : (v + 1) % PHOTO_COUNT));
      if (event.key === "ArrowLeft") setOpen((v) => (v === null ? null : (v - 1 + PHOTO_COUNT) % PHOTO_COUNT));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <ul className={styles.galleryGrid}>
        {Array.from({ length: shown }, (_, index) => (
          <li key={index} className={index % 7 === 0 ? styles.galleryFeature : undefined}>
            <a
              href={src(index)}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.galleryItem}
              onClick={(event) => {
                if (event.metaKey || event.ctrlKey || event.shiftKey) return;
                event.preventDefault();
                setOpen(index);
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src(index)}
                alt={caption(index)}
                loading="lazy"
                decoding="async"
                className={styles.galleryImage}
              />
            </a>
          </li>
        ))}
      </ul>

      {shown < PHOTO_COUNT ? (
        <div className={styles.galleryMore}>
          <button
            type="button"
            className={styles.galleryMoreButton}
            onClick={() => setShown((value) => Math.min(value + BATCH, PHOTO_COUNT))}
          >
            Show more photographs
          </button>
          <span className={styles.galleryCount}>
            {shown} of {PHOTO_COUNT}
          </span>
        </div>
      ) : (
        <p className={styles.galleryCount}>All {PHOTO_COUNT} photographs shown.</p>
      )}

      <dialog
        ref={dialog}
        className={styles.lightbox}
        onClose={() => setOpen(null)}
        onClick={(event) => {
          if (event.target === dialog.current) setOpen(null);
        }}
      >
        {open !== null ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src(open)} alt={caption(open)} className={styles.lightboxImage} />
            <p className={styles.lightboxCaption}>
              {caption(open)}
              <span className={styles.lightboxCount}>
                {open + 1} of {PHOTO_COUNT}
              </span>
            </p>
            <button type="button" className={styles.lightboxClose} onClick={() => setOpen(null)}>
              Close
            </button>
          </>
        ) : null}
      </dialog>
    </>
  );
}
