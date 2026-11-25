"use client";
import { useMemo, useRef, useState } from "react";
import type { IdCardStudent } from "@/components/id-card-svg";
import s from "./id-cards.white.module.css";

type CardSummary = {
  id: string;
  serial: string;
  status: string;
  issuedAt: string | null;
  expiresAt: string | null;
  expired: boolean;
};

type Props = {
  /** The signed-in student's own record, ready for the card components. */
  initial: IdCardStudent;
  /** The real merged artwork the printer uses, QR and photo filled server-side. */
  faceFront: string | null;
  faceBack: string | null;
  verifyUrl: string | null;
  cards: CardSummary[];
};

const TABS = [
  ["view", "My card"],
  ["list", "Card history"],
] as const;
type TabKey = (typeof TABS)[number][0];

const CAMPUSES = ["Main Campus", "West Campus"] as const;

const statusLabel = (row: CardSummary) =>
  row.expired
    ? "Expired"
    : { ISSUED: "Active", PENDING: "Pending", PRINTING: "Printing", LOST: "Lost", REPLACED: "Replaced" }[row.status] ?? row.status;

const statusClass = (row: CardSummary) =>
  row.expired ? s.badgeExpired : row.status === "ISSUED" ? s.badge : s.badgePending;

export default function IdCardsClient({ initial, faceFront, faceBack, verifyUrl, cards: seed }: Props) {
  const [tab, setTab] = useState<TabKey>("view");
  const [d, setD] = useState<IdCardStudent>(initial);
  const [cards, setCards] = useState<CardSummary[]>(seed);
  const [flipped, setFlipped] = useState(false);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  // Cards list: search + campus filter
  const [query, setQuery] = useState("");
  const [campusFilter, setCampusFilter] = useState("All");

  const flip = () => setFlipped((f) => !f);
  const onFlipKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      flip();
    }
  };

  // Tabs: roving tabindex + arrow keys, the standard tablist pattern.
  const onTabKey = (e: React.KeyboardEvent, i: number) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const dir = e.key === "ArrowRight" ? 1 : -1;
    const n = (i + dir + TABS.length) % TABS.length;
    setTab(TABS[n][0]);
    tabRefs.current[n]?.focus();
  };

  const openIn = (row: CardSummary, t: TabKey) => {
    setD((prev) => ({
      ...prev,
      serial: row.serial,
      validUntil: row.expiresAt ?? prev.validUntil,
      status: row.expired ? "Expired" : "Active",
    }));
    setFlipped(false);
    setTab(t);
  };

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return cards.filter(
      (x) =>
        (campusFilter === "All" || d.campus === campusFilter) &&
        (!q || `${d.name} ${d.adm} ${x.serial}`.toLowerCase().includes(q)),
    );
  }, [cards, query, campusFilter, d.name, d.adm, d.campus]);

  return (
    <main className={s.page}>
      {/* Sticky tabs */}
      <div className={s.tabs} role="tablist" aria-label="ID card steps">
        {TABS.map(([k, label], i) => (
          <button
            key={k}
            ref={(el) => {
              tabRefs.current[i] = el;
            }}
            role="tab"
            aria-selected={tab === k}
            tabIndex={tab === k ? 0 : -1}
            className={`${s.btn} ${tab === k ? s.btnPrimary : ""}`}
            onClick={() => setTab(k)}
            onKeyDown={(e) => onTabKey(e, i)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 2. STUDENT VIEW: the real card, tap to flip */}
      {tab === "view" && (
        <section className={s.panel}>
          <h2>What the student sees</h2>
          {faceFront ? (
            <div
              className={`${s.flip} ${s.printArea} ${flipped ? s.flipped : ""}`}
              role="button"
              tabIndex={0}
              aria-pressed={flipped}
              aria-label="Student ID card, activated to flip between front and back"
              onClick={flip}
              onKeyDown={onFlipKey}
            >
              <div className={s.flipInner}>
                <div className={s.face} dangerouslySetInnerHTML={{ __html: faceFront }} />
                <div className={`${s.face} ${s.back}`} dangerouslySetInnerHTML={{ __html: faceBack ?? "" }} />
              </div>
            </div>
          ) : (
            <p className={s.meta}>No card has been issued yet.</p>
          )}
          <div className={s.meta}>
            <b>{d.name}</b><br />{d.course} · {d.campus} · Valid until {d.validUntil}<br />
            {d.serial ? <>Serial {d.serial}<br /></> : null}
            {verifyUrl ? <><a href={verifyUrl}>Verify this card</a><br /></> : null}
            <br />
            <span className={`${s.badge} ${d.status === "Expired" ? s.badgeExpired : ""}`}>{d.status}</span>
          </div>
          <div className={`${s.actions} ${s.center}`}>
            <button className={`${s.btn} ${s.btnPrimary}`} onClick={flip} aria-expanded={flipped}>Flip card</button>
            <a className={s.btn} href="/student/id/card" target="_blank" rel="noopener noreferrer">View PDF</a>
            <a className={s.btn} href="/student/id/card?download=1" download>Download PDF</a>
            <button className={s.btn} onClick={() => window.print()}>Print card</button>
            {verifyUrl ? <a className={s.btn} href={verifyUrl} target="_blank" rel="noopener noreferrer">Share verification</a> : null}
          </div>
        </section>
      )}

      {/* 3. LIST: search + campus filter + status + View/Reissue */}
      {tab === "list" && (
        <section className={s.panel}>
          <h2>Issued cards</h2>
          <div className={s.filters}>
            <div>
              <label className={s.label} htmlFor="id-search">Search</label>
              <input
                id="id-search"
                className={s.input}
                type="search"
                placeholder="Name, admission no. or serial"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <div>
              <label className={s.label} htmlFor="id-filter-campus">Campus</label>
              <select
                id="id-filter-campus"
                className={s.input}
                value={campusFilter}
                onChange={(e) => setCampusFilter(e.target.value)}
              >
                <option>All</option>
                {CAMPUSES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <p className={s.count} aria-live="polite">
            Showing {visible.length} of {cards.length} card{cards.length === 1 ? "" : "s"}
          </p>
          <div className={s.tableWrap} tabIndex={0} role="region" aria-label="Issued cards, scrollable">
            <table className={s.table}>
              <thead>
                <tr>
                  <th scope="col">Student</th>
                  <th scope="col">Adm no.</th>
                  <th scope="col">Serial</th>
                  <th scope="col">Status</th>
                  <th scope="col"><span className={s.srOnly}>Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => (
                  <tr key={row.id}>
                    <td>{d.name}</td>
                    <td>{d.adm}</td>
                    <td>{row.serial}</td>
                    <td><span className={statusClass(row)}>{statusLabel(row)}</span></td>
                    <td>
                      <button className={s.btn} onClick={() => openIn(row, "view")}>
                        View
                      </button>
                    </td>
                  </tr>
                ))}
                {visible.length === 0 && (
                  <tr className={s.empty}>
                    <td colSpan={5}>
                      {cards.length === 0
                        ? "No cards issued yet — the registry issues them."
                        : `No cards match “${query || campusFilter}”. Adjust the search or campus filter.`}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}
