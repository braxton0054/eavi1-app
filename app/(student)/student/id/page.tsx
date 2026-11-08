import { getStudentCard } from "@/lib/dal/student-portal";
import { getCardFace } from "@/lib/dal/cards";
import { studentPortal } from "@/lib/content/dashboard";
import { EmptyState, PageHeader, Panel } from "@/components/dashboard/panel";
import { formatDate } from "@/lib/format";

const copy = studentPortal.id;

export default async function StudentCardPage() {
  const { student, card } = await getStudentCard();

  // The card is read through the same scope-checked getter the office uses, so artwork and the
  // QR link are identical to what is printed on the physical card.
  const face = card ? await getCardFace(card.id, student.campusId) : null;
  // Compared on the server, once: reading the clock during render is not deterministic.
  const now = new Date();
  const expired = card?.expiresAt ? card.expiresAt.getTime() < now.getTime() : false;

  return (
    <div className="space-y-6">
      <PageHeader title={copy.title} description={copy.description} />

      {!card || !face ? (
        <EmptyState title={copy.none.title} body={copy.none.body} icon="cards" />
      ) : (
        <>
          <Panel title={copy.title}>
            <div className="flex flex-col items-center gap-4 p-4">
              {/*
                The card artwork is rendered from the same SVG the printer uses, so what a
                student sees here is what is on the plastic. It scrolls sideways on a narrow
                screen rather than shrinking the text to something unreadable.
              */}
              <div className="w-full overflow-x-auto">
                <div
                  className="mx-auto w-[220px] shrink-0"
                  dangerouslySetInnerHTML={{ __html: face.frontSvg }}
                />
              </div>
              <dl className="w-full divide-y divide-eavi-border">
                <Row label={copy.serial} value={card.serial} />
                <Row label={copy.issued} value={formatDate(card.issuedAt)} />
                {card.expiresAt ? (
                  <Row
                    label={copy.valid}
                    value={expired ? copy.expired : formatDate(card.expiresAt)}
                  />
                ) : null}
              </dl>
              <p className="text-sm text-eavi-muted-text">{copy.check}</p>
              <a
                href={face.where}
                className="text-sm font-medium break-all text-eavi-accent underline-offset-4 hover:underline"
              >
                {face.where}
              </a>
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3">
      <dt className="text-sm text-eavi-muted-text">{label}</dt>
      <dd className="font-medium text-eavi-on-bg">{value}</dd>
    </div>
  );
}
