"use client";
import { useMemo, useRef, useState } from "react";
import { IdCardBack, IdCardFront, type IdCardStudent } from "@/components/id-card-svg";
import { downloadCardPng } from "./actions";
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
  /** False when no card has been issued yet: the proof previews, but nothing prints. */
  hasCard: boolean;
  /** The real merged artwork the printer uses, QR and photo filled server-side. */
  faceFront: string | null;
  faceBack: string | null;
  verifyUrl: string | null;
  cards: CardSummary[];
};

const TABS = [
  ["gen", "1. Generate"],
  ["view", "2. Student view"],
  ["list", "3. Cards list"],
] as const;
type TabKey = (typeof TABS)[number][0];

const CAMPUSES = ["Main Campus", "West Campus", "Town Campus"] as const;

const statusLabel = (row: CardSummary) =>
  row.expired
    ? "Expired"
    : { ISSUED: "Active", PENDING: "Pending", PRINTING: "Printing", LOST: "Lost", REPLACED: "Replaced" }[row.status] ?? row.status;

const statusClass = (row: CardSummary) =>
  row.expired ? s.badgeExpired : row.status === "ISSUED" ? s.badge : s.badgePending;

export default function IdCardsClient({ initial, hasCard, faceFront, faceBack, verifyUrl, cards: seed }: Props) {
  const [tab, setTab] = useState<TabKey>("gen");
  const [d, setD] = useState<IdCardStudent>(initial);
  const [cards, setCards] = useState<CardSummary[]>(seed);
  const [flipped, setFlipped] = useState(false);

  // Cards list: search + campus filter
  const [query, setQuery] = useState("");
  const [campusFilter, setCampusFilter] = useState("All");

  // Generate runs briefly (validate + apply to the proof) so the press shows its state.
  const [issuing, setIssuing] = useState(false);
  const [flash, setFlash] = useState("");
  const [pngPending, setPngPending] = useState(false);
  const [pngError, setPngError] = useState(false);

  const previewRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const set = (k: keyof IdCardStudent) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setD((prev) => ({ ...prev, [k]: e.target.value }));

  // Data URL, so the photo travels inside the SVG preview.
  const onPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => setD((prev) => ({ ...prev, photoUrl: String(r.result) }));
    r.readAsDataURL(f);
  };

  // Generate: apply the form to the proof, with the press-state UX.
  const issue = () => {
    if (issuing) return;
    setIssuing(true);
    setFlash("");
    window.setTimeout(() => {
      setCards((prev) => {
        const row: CardSummary = {
          id: d.serial ?? `proof-${prev.length + 1}`,
          serial: d.serial ?? "PROOF",
          status: "ISSUED",
          issuedAt: d.issueDate ?? null,
          expiresAt: null,
          expired: d.status === "Expired",
        };
        const i = prev.findIndex((x) => x.serial === row.serial);
        if (i === -1) return [row, ...prev];
        const next = [...prev];
        next[i] = row;
        return next;
      });
      setIssuing(false);
      setFlash(`Card ready — ${d.name}'s card is in the list.`);
    }, 700);
  };

  // Download PNG: rendered server-side by the print pipeline at CR80/300 DPI.
  const downloadPng = async () => {
    if (!hasCard || pngPending) return;
    setPngPending(true);
    setPngError(false);
    try {
      const res = await downloadCardPng("front");
      if (!res.ok) throw new Error(res.error);
      const blob = await (await fetch(`data:image/png;base64,${res.data}`)).blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `id-card-${res.serial.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-front.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    } catch {
      setPngError(true);
    } finally {
      setPngPending(false);
    }
  };

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

      {/* 1. GENERATE: form left, live preview right */}
      {tab === "gen" && (
        <section className={s.grid}>
          <div className={s.panel} aria-busy={issuing}>
            <h2>Student details</h2>
            <label className={s.label} htmlFor="id-name">Full name</label>
            <input id="id-name" className={s.input} value={d.name} onChange={set("name")} autoComplete="off" />

            <div className={s.row}>
              <div>
                <label className={s.label} htmlFor="id-adm">Admission no.</label>
                <input id="id-adm" className={s.input} value={d.adm} onChange={set("adm")} autoComplete="off" />
              </div>
              <div>
                <label className={s.label} htmlFor="id-valid">Valid until</label>
                <input id="id-valid" className={s.input} value={d.validUntil} onChange={set("validUntil")} autoComplete="off" />
              </div>
            </div>

            <label className={s.label} htmlFor="id-course">Course</label>
            <input id="id-course" className={s.input} value={d.course} onChange={set("course")} autoComplete="off" />

            <label className={s.label} htmlFor="id-campus">Campus</label>
            <select id="id-campus" className={s.input} value={d.campus} onChange={set("campus")}>
              {CAMPUSES.map((c) => <option key={c}>{c}</option>)}
            </select>

            <label className={s.label} htmlFor="id-photo">Photo</label>
            <input id="id-photo" className={s.input} type="file" accept="image/*" onChange={onPhoto} />

            <div className={s.actions}>
              <button className={`${s.btn} ${s.btnPrimary}`} onClick={issue} disabled={issuing}>
                {issuing ? <><span className={s.spinner} aria-hidden="true" />Issuing…</> : "Generate card"}
              </button>
              <button className={s.btn} onClick={downloadPng} disabled={!hasCard || pngPending || issuing}>
                {pngPending ? <><span className={s.spinner} aria-hidden="true" />Rendering…</> : "Download PNG"}
              </button>
              <button className={s.btn} onClick={() => window.print()} disabled={issuing}>Print (CR80)</button>
            </div>
            <p className={`${s.notice} ${pngError ? s.noticeError : ""}`} aria-live="polite">
              {pngError
                ? "Could not render the PNG — try again."
                : !hasCard
                  ? "No card issued yet — the registry issues cards; this preview is a proof."
                  : flash}
            </p>
          </div>

          <div className={s.panel}>
            <h2>Live preview</h2>
            <div ref={previewRef} className={`${s.cards} ${s.printArea}`}>
              <IdCardFront student={d} />
              <IdCardBack student={d} />
            </div>
          </div>
        </section>
      )}

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
            <button className={s.btn} onClick={() => window.print()}>Download PDF</button>
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
                      <button className={s.btn} onClick={() => openIn(row, row.expired ? "gen" : "view")}>
                        {row.expired ? "Reissue" : "View"}
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
