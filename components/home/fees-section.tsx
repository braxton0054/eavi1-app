import { Button } from "@/components/ui/button";
import { ContentPlaceholder } from "@/components/home/content-placeholder";
import { Section, SectionHeader } from "@/components/home/section";
import { feesSection, mainCampus, pending } from "@/lib/content/home";

export function FeesSection() {
  return (
    <Section id={feesSection.id} labelledBy="fees-heading">
      <SectionHeader
        id="fees-heading"
        eyebrow={feesSection.eyebrow}
        heading={feesSection.heading}
        subheading={feesSection.subheading}
        action={
          <Button asChild variant="outline" className="rounded-full">
            <a href={`tel:${mainCampus.tel}`}>
              {feesSection.enquire}
              <span className="sr-only">{mainCampus.phone}</span>
            </a>
          </Button>
        }
      />

      {feesSection.items.length === 0 ? (
        <div className="mt-6 flex flex-col gap-4 sm:mt-8">
          <div className="overflow-hidden rounded-2xl border border-dashed border-border">
            <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-4">
              {feesSection.columns.map((column) => (
                <p
                  key={column}
                  className="bg-eavi-primary-soft/60 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-eavi-primary-text"
                >
                  {column}
                </p>
              ))}
            </div>
            <p className="bg-background px-4 py-6 text-center text-xs text-eavi-muted-text">
              {pending.label}
            </p>
          </div>
          <ContentPlaceholder
            label={pending.label}
            note={pending.note}
            fields={feesSection.pending}
          />
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto sm:mt-8">
          <table className="w-full min-w-[36rem] border-collapse text-sm">
            <caption className="sr-only">{feesSection.heading}</caption>
            <thead>
              <tr className="border-b border-border bg-muted text-left">
                {feesSection.columns.map((column) => (
                  <th
                    key={column}
                    scope="col"
                    className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-eavi-primary-text"
                  >
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {feesSection.items.map((row) => (
                <tr key={row.program} className="border-b border-border">
                  <th scope="row" className="px-4 py-3 text-left font-semibold">
                    {row.program}
                  </th>
                  <td className="px-4 py-3 tabular-nums">{row.tuition}</td>
                  <td className="px-4 py-3 tabular-nums">{row.otherCharges}</td>
                  <td className="px-4 py-3">{row.plan}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}
