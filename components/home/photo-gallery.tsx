"use client";

import { useEffect, useRef, useState } from "react";

import styles from "./eavi-home.module.css";

/**
 * A small selection of the college's own photographs. Every image is a real link, so
 * the gallery still works if JavaScript never loads; with JS it opens a lightbox.
 */
const PHOTOS = [
  { file: "001", caption: "Main Campus" },
  { file: "018", caption: "A college event" },
  { file: "035", caption: "Students together" },
  { file: "052", caption: "Practical training" },
  { file: "071", caption: "Learning by doing" },
  { file: "089", caption: "In the skills lab" },
  { file: "104", caption: "At work" },
  { file: "153", caption: "Students on campus" },
  { file: "171", caption: "Outside the classroom" },
  { file: "189", caption: "In class" },
  { file: "201", caption: "A lecture" },
  { file: "226", caption: "The college gate" },
] as const;

const src = (file: string) => `/eavi-assets/web/${file}.jpg`;

export function PhotoGallery() {
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
      if (event.key === "ArrowRight") setOpen((value) => (value === null ? null : (value + 1) % PHOTOS.length));
      if (event.key === "ArrowLeft") setOpen((value) => (value === null ? null : (value - 1 + PHOTOS.length) % PHOTOS.length));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <ul className={styles.galleryGrid}>
        {PHOTOS.map((photo, index) => (
          <li key={photo.file} className={index === 0 ? styles.galleryFeature : undefined}>
            <a
              href={src(photo.file)}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.galleryItem}
              onClick={(event) => {
                if (event.metaKey || event.ctrlKey || event.shiftKey) return;
                event.preventDefault();
                setOpen(index);
              }}
            >
              {/* The web copies are resized to 960px; the originals are multi-megabyte. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src(photo.file)} alt={photo.caption} loading="lazy" className={styles.galleryImage} />
            </a>
          </li>
        ))}
      </ul>

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
            <img src={src(PHOTOS[open].file)} alt={PHOTOS[open].caption} className={styles.lightboxImage} />
            <p className={styles.lightboxCaption}>
              {PHOTOS[open].caption}
              <span className={styles.lightboxCount}>
                {open + 1} of {PHOTOS.length}
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
