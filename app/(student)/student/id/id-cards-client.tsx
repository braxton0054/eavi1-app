"use client";

import { useRef, useState } from "react";
import {
  ArrowUpRight,
  Check,
  Clock3,
  Copy,
  Download,
  ExternalLink,
  IdCard,
  LifeBuoy,
  Printer,
  RotateCcw,
  Share2,
  ShieldAlert,
  ShieldCheck,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { StatusChip, type ChipTone } from "@/components/dashboard/status-chip";
import type { CardLifecycle } from "@/lib/cards/status";
import { site } from "@/lib/content/home";
import s from "./id-cards.module.css";

export type CardDetails = {
  name: string;
  admissionNo: string;
  program: string;
  campus: string;
  className: string;
  intake: string;
  validUntil: string;
  issuedAt: string | null;
  serial: string | null;
  email: string | null;
};

export type CardHistoryItem = {
  id: string;
  serial: string;
  issuedAt: string | null;
  expiresAt: string | null;
  state: CardLifecycle;
};

type Props = {
  details: CardDetails;
  lifecycle: CardLifecycle | null;
  faceFront: string | null;
  faceBack: string | null;
  previewUnavailable: boolean;
  verificationLink: string | null;
  cards: CardHistoryItem[];
  title: string;
  description: string;
};

const toneToChip: Record<CardLifecycle["tone"], ChipTone> = {
  success: "success",
  warning: "warning",
  danger: "danger",
  neutral: "neutral",
};

function StateIcon({ lifecycle }: { lifecycle: CardLifecycle }) {
  if (lifecycle.tone === "success") return <ShieldCheck aria-hidden />;
  if (lifecycle.tone === "danger") return <ShieldAlert aria-hidden />;
  return <Clock3 aria-hidden />;
}

export default function IdCardsClient({
  details,
  lifecycle,
  faceFront,
  faceBack,
  previewUnavailable,
  verificationLink,
  cards,
  title,
  description,
}: Props) {
  const [flipped, setFlipped] = useState(false);
  const [shareMode, setShareMode] = useState<"share" | "copy">("copy");
  const [sharing, setSharing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const linkInputRef = useRef<HTMLInputElement>(null);

  const openShare = () => {
    if (!verificationLink) return;
    setShareMode(typeof navigator.share === "function" ? "share" : "copy");
    setCopied(false);
    setShareError(null);
    dialogRef.current?.showModal();
  };

  const copyLink = async () => {
    if (!verificationLink) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(verificationLink);
      } else {
        linkInputRef.current?.focus();
        linkInputRef.current?.select();
        if (!document.execCommand("copy")) throw new Error("Copy was refused");
      }
      setCopied(true);
      setShareError(null);
    } catch {
      setShareError("Copy the link manually from the field above.");
    }
  };

  const shareLink = async () => {
    if (!verificationLink) return;
    setSharing(true);
    setShareError(null);
    try {
      if (shareMode === "share" && navigator.share) {
        await navigator.share({
          title: "EAVI student card verification",
          text: "Check my EAVI student card against the institute register.",
          url: verificationLink,
        });
        dialogRef.current?.close();
      } else {
        await copyLink();
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setShareError("Sharing was not completed. Copy the link manually instead.");
    } finally {
      setSharing(false);
    }
  };

  const closeShare = () => {
    setShareError(null);
    setCopied(false);
    dialogRef.current?.close();
  };

  const canPrint = Boolean(lifecycle?.canDownload && faceFront);

  return (
    <>
      <div className={s.page} data-print="record">
        <header className={s.header}>
          <div>
            <p className={s.eyebrow}>Campus identity</p>
            <h1>{title}</h1>
            <p className={s.lede}>{description}</p>
          </div>
          <div className={s.seal} aria-hidden="true">
            <ShieldCheck />
            <span>EAVI</span>
          </div>
        </header>

        {!lifecycle ? (
          <section className={s.empty} aria-labelledby="empty-title">
            <div className={s.emptyCard} aria-hidden="true">
              <IdCard />
            </div>
            <p className={s.eyebrow}>No card on record</p>
            <h2 id="empty-title">Your card will appear here</h2>
            <p>
              Cards are created automatically when you enrol. If you are enrolled and still see this,
              contact the registry so we can check your record.
            </p>
            <Button asChild size="lg" variant="outline">
              <a href={site.whatsapp.href} target="_blank" rel="noopener noreferrer">
                Contact the registry <ArrowUpRight aria-hidden />
              </a>
            </Button>
          </section>
        ) : (
          <section className={s.credentialLayout} aria-label="Your student card">
            <div className={s.stage}>
              <div className={s.stageBar}>
                <span>Card preview</span>
                {faceFront ? <span className={s.sideLabel}>{flipped ? "Back" : "Front"}</span> : null}
              </div>

              {faceFront ? (
                <button
                  type="button"
                  className={s.cardButton}
                  onClick={() => setFlipped((value) => !value)}
                  aria-label={flipped ? "Show the front of your student card" : "Show the back of your student card"}
                  aria-pressed={flipped}
                >
                  <span className={`${s.cardInner} ${flipped ? s.flipped : ""}`}>
                    <span className={s.face} aria-hidden={flipped} dangerouslySetInnerHTML={{ __html: faceFront }} />
                    <span className={`${s.face} ${s.back}`} aria-hidden={!flipped} dangerouslySetInnerHTML={{ __html: faceBack ?? "" }} />
                  </span>
                </button>
              ) : (
                <div className={s.previewPlaceholder}>
                  {previewUnavailable ? <ShieldAlert aria-hidden /> : <IdCard aria-hidden />}
                  <strong>{previewUnavailable ? "Preview unavailable" : "No preview yet"}</strong>
                  <span>
                    {previewUnavailable
                      ? "The card is issued, but its saved preview could not be loaded."
                      : lifecycle.message}
                  </span>
                  {previewUnavailable ? (
                    <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
                      Reload preview
                    </Button>
                  ) : null}
                </div>
              )}

              {faceFront ? (
                <p className={s.stageHint}>
                  <RotateCcw aria-hidden /> Select the card to turn it over
                </p>
              ) : null}
            </div>

            <aside className={s.details} aria-labelledby="card-owner-name">
              <div className={`${s.statusPanel} ${s[lifecycle.tone]}`} role="status">
                <span className={s.statusIcon}><StateIcon lifecycle={lifecycle} /></span>
                <div>
                  <div className={s.statusHeading}>
                    <h2>{lifecycle.title}</h2>
                    <StatusChip tone={toneToChip[lifecycle.tone]}>{lifecycle.label}</StatusChip>
                  </div>
                  <p>{lifecycle.message}</p>
                </div>
              </div>

              <div className={s.identity}>
                <p className={s.admissionNo}>{details.admissionNo}</p>
                <h2 id="card-owner-name">{details.name}</h2>
                <p>{details.program}</p>
              </div>

              <dl className={s.detailList}>
                <div><dt>Campus</dt><dd>{details.campus}</dd></div>
                <div><dt>Class</dt><dd>{details.className}</dd></div>
                <div><dt>Intake</dt><dd>{details.intake}</dd></div>
                <div><dt>Issued</dt><dd>{details.issuedAt ?? "Not issued"}</dd></div>
                <div><dt>Valid until</dt><dd>{details.validUntil}</dd></div>
                {details.serial ? <div><dt>Card serial</dt><dd>{details.serial}</dd></div> : null}
              </dl>

              <div className={s.actions}>
                {lifecycle.canShare && verificationLink ? (
                  <Button size="lg" onClick={openShare}>
                    <Share2 aria-hidden /> Share verification link
                  </Button>
                ) : null}
                {lifecycle.canVerify && verificationLink ? (
                  <Button asChild size="lg" variant="outline">
                    <a href={verificationLink} target="_blank" rel="noopener noreferrer">
                      View verification <ExternalLink aria-hidden />
                    </a>
                  </Button>
                ) : null}
                {lifecycle.canDownload ? (
                  <>
                    <Button asChild size="md" variant="ghost">
                      <a href="/student/id/card" target="_blank" rel="noopener noreferrer">
                        View PDF <ArrowUpRight aria-hidden />
                      </a>
                    </Button>
                    <Button asChild size="md" variant="ghost">
                      <a href="/student/id/card?download=1" download>
                        <Download aria-hidden /> Download PDF
                      </a>
                    </Button>
                    {canPrint ? (
                      <Button size="md" variant="ghost" onClick={() => window.print()}>
                        <Printer aria-hidden /> Print card
                      </Button>
                    ) : null}
                  </>
                ) : null}
              </div>

              {lifecycle.canShare && verificationLink ? (
                <p className={s.shareNote}>
                  <ShieldCheck aria-hidden />
                  The link opens EAVI’s verification page. It confirms your card status without
                  giving anyone access to your portal.
                </p>
              ) : null}
            </aside>
          </section>
        )}

        {cards.length > 0 ? (
          <section className={s.history} aria-labelledby="history-title">
            <div className={s.sectionHeading}>
              <div>
                <p className={s.eyebrow}>Your record</p>
                <h2 id="history-title">Card history</h2>
              </div>
              <span>{cards.length} {cards.length === 1 ? "card" : "cards"}</span>
            </div>
            <ul className={s.historyList}>
              {cards.map((card) => (
                <li key={card.id}>
                  <div className={s.historySerial}>
                    <span className={s.historyIcon} aria-hidden="true"><IdCard /></span>
                    <div>
                      <strong>{card.serial}</strong>
                      <span>Issued {card.issuedAt ?? "—"}</span>
                    </div>
                  </div>
                  <div className={s.historyDates}>
                    <span>Valid until</span>
                    <strong>{card.expiresAt ?? "—"}</strong>
                  </div>
                  <StatusChip tone={toneToChip[card.state.tone]}>{card.state.label}</StatusChip>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <aside className={s.help}>
          <span className={s.helpIcon} aria-hidden="true"><LifeBuoy /></span>
          <div>
            <h2>Need a replacement or an update?</h2>
            <p>Report a lost card or ask the registry to correct your name, photo, or programme.</p>
          </div>
          <Button asChild variant="outline" size="md">
            <a href={site.whatsapp.href} target="_blank" rel="noopener noreferrer">
              Contact the registry <ArrowUpRight aria-hidden />
            </a>
          </Button>
        </aside>
      </div>

      {canPrint ? (
        <div className={`print-doc ${s.printDoc}`} aria-hidden="true">
          <header>
            <strong>East Africa Vision Institute</strong>
            <span>Student identity card</span>
          </header>
          <div className={s.printIdentity}>
            <strong>{details.name}</strong>
            <span>{details.admissionNo}</span>
          </div>
          <div className={s.printFaces}>
            <div className={s.printFace} dangerouslySetInnerHTML={{ __html: faceFront ?? "" }} />
            <div className={s.printFace} dangerouslySetInnerHTML={{ __html: faceBack ?? "" }} />
          </div>
        </div>
      ) : null}

      <dialog ref={dialogRef} className={s.shareDialog} onClose={closeShare} aria-labelledby="share-title">
        <div className={s.dialogHeader}>
          <div>
            <p className={s.eyebrow}>Verification</p>
            <h2 id="share-title">Share your verification link</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={closeShare} aria-label="Close sharing dialog">
            <X aria-hidden />
          </Button>
        </div>
        <p className={s.dialogBody}>
          Anyone you send this to will see EAVI’s official verification result for your card:
          your name, programme, campus, issue date, and current status.
        </p>
        <label className={s.shareLabel} htmlFor="verification-link">Verification link</label>
        <input
          ref={linkInputRef}
          id="verification-link"
          className={s.shareInput}
          value={verificationLink ?? ""}
          readOnly
          suppressHydrationWarning
          onFocus={(event) => event.currentTarget.select()}
        />
        {shareError ? <p className={s.shareError} role="alert">{shareError}</p> : null}
        {copied ? (
          <p className={s.shareSuccess} role="status"><Check aria-hidden /> Verification link copied</p>
        ) : null}
        <div className={s.dialogActions}>
          <Button variant="outline" size="lg" onClick={copyLink} disabled={sharing}>
            {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
            {copied ? "Copied" : "Copy link"}
          </Button>
          <Button size="lg" onClick={shareLink} loading={sharing}>
            <Share2 aria-hidden /> {shareMode === "share" ? "Share link" : "Copy verification link"}
          </Button>
        </div>
      </dialog>
    </>
  );
}
